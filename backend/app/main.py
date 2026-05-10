import os
import asyncio
import secrets
import smtplib
import traceback
import time
import io
import zipfile
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from passlib.context import CryptContext

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Form, Header, BackgroundTasks, Request, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import case, text, inspect
from jose import jwt, JWTError

from . import models, schemas, logic, database, cloud_scan_service
from . import forecast_service
from .alert_service import check_and_send_alert
from .database import engine, get_db
from .disease_labels import normalize_disease_type as normalize_disease_label

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Ensure training samples directory exists
import pathlib
TRAINING_SAMPLES_DIR = pathlib.Path(__file__).parent.parent / "training_samples"
TRAINING_SAMPLES_DIR.mkdir(parents=True, exist_ok=True)


def ensure_user_settings_columns():
    """Backfill user preference columns for existing databases without migrations."""
    inspector = inspect(engine)
    user_columns = {column["name"] for column in inspector.get_columns("users")}

    with engine.begin() as connection:
        if "notification_emails_enabled" not in user_columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN notification_emails_enabled BOOLEAN DEFAULT TRUE")
            )
            connection.execute(
                text("UPDATE users SET notification_emails_enabled = TRUE WHERE notification_emails_enabled IS NULL")
            )

        if "disease_confidence_threshold" not in user_columns:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN disease_confidence_threshold INTEGER DEFAULT 70")
            )
            connection.execute(
                text("UPDATE users SET disease_confidence_threshold = 70 WHERE disease_confidence_threshold IS NULL")
            )


def ensure_inference_result_source_column():
    """Backfill detection source metadata for existing databases without migrations."""
    inspector = inspect(engine)
    inference_columns = {column["name"] for column in inspector.get_columns("inference_results")}

    with engine.begin() as connection:
        if "source" not in inference_columns:
            connection.execute(
                text("ALTER TABLE inference_results ADD COLUMN source VARCHAR DEFAULT 'gateway'")
            )

        connection.execute(
            text("UPDATE inference_results SET source = 'gateway' WHERE source IS NULL OR source = ''")
        )


ensure_user_settings_columns()
ensure_inference_result_source_column()

APP_STARTED_AT = time.time()
REQUEST_SLOW_MS = float(os.getenv("REQUEST_SLOW_MS", "800"))
NOTIFICATION_DEDUPE_MINUTES = int(os.getenv("NOTIFICATION_DEDUPE_MINUTES", "0"))

def _send_email(to: str, subject: str, html: str, text: str, *, label: str) -> bool:
    """
    Shared email transport for all MangoGuard alerts.
    Exclusively uses Brevo API (HTTPS / port 443 — works on Render).
    """
    
    brevo_api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("BREVO_SENDER_EMAIL") or "ariavixen0@gmail.com"

    if not brevo_api_key:
        print(f"[{label}] SKIPPED — missing BREVO_API_KEY env var.")
        return False

    print(f"[{label}] Sending via Brevo API to {to!r}...")
    try:
        import requests as _requests
        response = _requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": brevo_api_key,
                "Content-Type": "application/json"
            },
            json={
                "sender": {"name": "MangoGuard", "email": sender_email},
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": html,
                "textContent": text
            },
            timeout=20
        )
        if response.status_code in (200, 201, 202):
            print(f"[{label}] SUCCESS via Brevo — API Response: {response.json()}")
            return True
        else:
            print(f"[{label}] ❌ ERROR via Brevo API! ❌")
            print(f"[{label}] Status: {response.status_code}")
            print(f"[{label}] Response: {response.text}")
            return False
    except Exception as e:
        print(f"[{label}] ❌ UNEXPECTED ERROR via Brevo! ❌")
        print(f"[{label}] Error details: {type(e).__name__}: {e}")
        traceback.print_exc()
        return False



def send_disease_alert_email(recipient: str, disease_name: str, confidence_pct: float, treatment: str):
    """
    RED urgent alert — sent when a disease is detected above the user's confidence threshold.
    """
    print(f"\n{'='*60}")
    print(f"[DISEASE EMAIL] send_disease_alert_email CALLED")
    print(f"  recipient    = {recipient!r}")
    print(f"  disease      = {disease_name!r}")
    print(f"  confidence   = {confidence_pct:.1f}%")
    print(f"{'='*60}")

    subject = f"MangoGuard Alert: {disease_name} Detected"
    text = (
        f"MangoGuard Disease Alert\n\n"
        f"Disease: {disease_name}\n"
        f"Confidence: {confidence_pct:.1f}%\n\n"
        f"Recommended Treatment:\n{treatment}\n\n"
        f"Open your MangoGuard dashboard for full details."
    )
    html = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style="margin:0;padding:0;background:#0d1117;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e6edf3;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
          <tr><td align="center">
            <table role="presentation" width="100%" style="max-width:620px;background:#161b22;border-radius:16px;overflow:hidden;border:1px solid #30363d;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
              <tr>
                <td style="padding:28px 32px;background:linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%);color:#fff;">
                  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;margin-bottom:8px;font-weight:600;">MangoGuard &middot; Disease Alert</div>
                  <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;">&#x1F6A8; {disease_name} Detected</h1>
                  <p style="margin:10px 0 0;font-size:14px;opacity:0.9;">Immediate attention may be required.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px 0;">
                  <table role="presentation" width="100%" style="background:#1c2128;border:1px solid #7f1d1d;border-radius:12px;padding:16px 20px;">
                    <tr>
                      <td>
                        <div style="font-size:12px;color:#f87171;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-weight:600;">Detection Confidence</div>
                        <div style="font-size:36px;font-weight:700;color:#ef4444;">{confidence_pct:.1f}%</div>
                      </td>
                      <td align="right">
                        <div style="background:#7f1d1d;color:#fca5a5;font-size:13px;padding:6px 14px;border-radius:20px;font-weight:600;border:1px solid #991b1b;">Above Threshold</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px 0;">
                  <div style="font-size:13px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600;">Recommended Treatment</div>
                  <div style="background:#0d1117;border:1px solid #30363d;border-left:4px solid #ef4444;border-radius:12px;padding:16px 18px;font-size:14px;color:#c9d1d9;line-height:1.7;">{treatment}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px;">
                  <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.6;">Open your <strong style="color:#e6edf3;font-weight:600;">MangoGuard dashboard</strong> for the full scan history and management recommendations.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px;background:#0d1117;border-top:1px solid #21262d;font-size:11px;color:#484f58;">You received this because disease email alerts are enabled in your MangoGuard profile.</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>"""

    return _send_email(recipient, subject, html, text, label="DISEASE EMAIL")


def send_forecast_alert_email(recipient: str, forecast_date_label: str, risk_name: str, advice: str):
    """
    AMBER proactive warning — sent when the weather forecast predicts high disease risk on an upcoming day.
    """
    print(f"\n{'='*60}")
    print(f"[FORECAST EMAIL] send_forecast_alert_email CALLED")
    print(f"  recipient    = {recipient!r}")
    print(f"  date         = {forecast_date_label!r}")
    print(f"  risk         = {risk_name!r}")
    print(f"{'='*60}")

    subject = f"MangoGuard Forecast: High {risk_name} Risk on {forecast_date_label}"
    text = (
        f"MangoGuard Forecast Alert\n\n"
        f"High {risk_name} risk is predicted for {forecast_date_label}.\n\n"
        f"Preventive Advice:\n{advice}\n\n"
        f"Open your MangoGuard dashboard to view the full 5-day forecast."
    )
    html = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style="margin:0;padding:0;background:#0d1117;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e6edf3;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
          <tr><td align="center">
            <table role="presentation" width="100%" style="max-width:620px;background:#161b22;border-radius:16px;overflow:hidden;border:1px solid #30363d;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
              <tr>
                <td style="padding:28px 32px;background:linear-gradient(135deg, #9a3412 0%, #c2410c 50%, #ea580c 100%);color:#fff;">
                  <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;margin-bottom:8px;font-weight:600;">MangoGuard &middot; Forecast Alert</div>
                  <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:700;">&#x26A0;&#xFE0F; High {risk_name} Risk Forecast</h1>
                  <p style="margin:10px 0 0;font-size:14px;opacity:0.9;">Predicted for <strong style="font-weight:600;">{forecast_date_label}</strong> &mdash; consider preventive action now.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px 0;">
                  <table role="presentation" width="100%" style="background:#1c2128;border:1px solid #9a3412;border-radius:12px;padding:16px 20px;">
                    <tr>
                      <td>
                        <div style="font-size:12px;color:#fbbf24;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-weight:600;">Forecast Date</div>
                        <div style="font-size:28px;font-weight:700;color:#f59e0b;">{forecast_date_label}</div>
                        <div style="font-size:14px;color:#d97706;margin-top:4px;font-weight:500;">{risk_name} &middot; High Risk</div>
                      </td>
                      <td align="right">
                        <div style="background:#9a3412;color:#fde68a;font-size:13px;padding:6px 14px;border-radius:20px;font-weight:600;border:1px solid #c2410c;">Upcoming Risk</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px 0;">
                  <div style="font-size:13px;color:#8b949e;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600;">Preventive Action</div>
                  <div style="background:#0d1117;border:1px solid #30363d;border-left:4px solid #f59e0b;border-radius:12px;padding:16px 18px;font-size:14px;color:#c9d1d9;line-height:1.7;">{advice}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px;">
                  <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.6;">Check the <strong style="color:#e6edf3;font-weight:600;">5-day forecast</strong> on your MangoGuard dashboard for the full risk outlook.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px;background:#0d1117;border-top:1px solid #21262d;font-size:11px;color:#484f58;">You received this because forecast email alerts are enabled in your MangoGuard profile.</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>"""

    return _send_email(recipient, subject, html, text, label="FORECAST EMAIL")


def send_alert_email(email: str, subject: str, message: str):
    """
    Send an alert email via Resend API.
    """
    print(f"\n{'='*60}")
    print(f"[FORECAST EMAIL DEBUG] send_alert_email CALLED")
    print(f"  recipient = {email!r}")
    print(f"  subject   = {subject!r}")
    print(f"  message   = {message[:120]!r}...")
    print(f"{'='*60}")

    html_content = f"""
        <!DOCTYPE html>
        <html>
          <head>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
          </head>
          <body style="margin:0;padding:24px;background:#0d1117;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e6edf3;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" style="max-width:640px;background:#161b22;border-radius:16px;overflow:hidden;border:1px solid #30363d;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
                    <tr>
                      <td style="padding:24px 28px;background:linear-gradient(90deg, #2563eb, #2f81f7);color:#ffffff;">
                        <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.9;font-weight:600;">MangoGuard System</div>
                        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;font-weight:700;">{subject}</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px;">
                        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#c9d1d9;">{message}</p>
                        <div style="margin-top:20px;padding:16px 18px;background:#0d1117;border:1px solid #30363d;border-left:4px solid #2f81f7;border-radius:12px;">
                          <div style="font-size:13px;color:#8b949e;line-height:1.6;">
                            This alert was generated by your mango monitoring system based on recent device data.
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:18px 28px;background:#0d1117;font-size:12px;color:#8b949e;border-top:1px solid #30363d;">
                        Review your dashboard for the latest disease status, forecast, and recommendations.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
    """
    
    _send_email(email, subject, html_content, message, label="FORECAST EMAIL")

app = FastAPI(title="Intelligent Plant Health Monitoring API")


@app.on_event("startup")
def load_models_on_startup():
    # Disease detection model
    cloud_scan_service.load_cloud_scan_model()
    model_status = cloud_scan_service.get_cloud_model_status()
    if model_status["loaded"]:
        print(
            f"[cloud_scan] loaded model at {model_status['path']} "
            f"with input_shape={model_status['input_shape']}"
        )
    else:
        print(f"[cloud_scan] unavailable: {model_status['error']}")

    # Forecasting model
    forecast_service.load_forecast_model()
    fc_status = forecast_service.get_forecast_model_status()
    if fc_status["loaded"]:
        print(f"[forecast] loaded model from {fc_status['path']}")
    else:
        print(f"[forecast] using placeholder — {fc_status['error']}")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT config
SECRET_KEY = os.getenv("SECRET_KEY", "mangoguard-plant-health-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Default user credentials (for backward compatibility)
DEFAULT_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

@app.on_event("startup")
def ensure_admin_user_exists():
    db = database.SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.username == DEFAULT_USERNAME).first()
        if not user:
            print(f"[setup] Creating default admin user: {DEFAULT_USERNAME}")
            user = models.User(
                username=DEFAULT_USERNAME,
                password=pwd_context.hash(DEFAULT_PASSWORD),
                email="",
                notification_emails_enabled=False,
                disease_confidence_threshold=70
            )
            db.add(user)
            db.commit()
    except Exception as e:
        print(f"[setup] Failed to ensure admin user: {e}")
    finally:
        db.close()

@app.on_event("startup")
def ensure_default_settings_exist():
    db = database.SessionLocal()
    try:
        defaults = [
            {"key": "maintenance_mode", "value": "false", "description": "Put the system in a read-only state for users."},
            {"key": "global_alerts_enabled", "value": "true", "description": "Enable or disable all outgoing email alerts."},
            {"key": "registration_enabled", "value": "true", "description": "Allow new users to create accounts."},
        ]
        for d in defaults:
            exists = db.query(models.SystemSetting).filter(models.SystemSetting.key == d["key"]).first()
            if not exists:
                print(f"[setup] Creating default setting: {d['key']}")
                setting = models.SystemSetting(**d)
                db.add(setting)
        db.commit()
    except Exception as e:
        print(f"[setup] Failed to ensure default settings: {e}")
    finally:
        db.close()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Active WebSocket connections ---
connected_clients: list[dict] = []


def format_duration_ms(start_time: float) -> float:
    return round((time.perf_counter() - start_time) * 1000, 2)


def log_request_timing(method: str, path: str, status_code: int, duration_ms: float, request_id: str):
    speed = "slow" if duration_ms >= REQUEST_SLOW_MS else "ok"
    print(
        f"[request_timing] id={request_id} method={method} path={path} "
        f"status={status_code} duration_ms={duration_ms} speed={speed}"
    )


@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    start_time = time.perf_counter()
    request_id = secrets.token_hex(4)

    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = format_duration_ms(start_time)
        log_request_timing(request.method, request.url.path, 500, duration_ms, request_id)
        raise exc

    duration_ms = format_duration_ms(start_time)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    log_request_timing(request.method, request.url.path, response.status_code, duration_ms, request_id)
    return response


def scoped_device_id(device: models.Device) -> str:
    """Build a stable internal device id used for user-scoped data storage."""
    return f"device:{device.id}"


def web_app_device_id(user_id: int) -> str:
    """Build a stable virtual device id for scans triggered from the web app."""
    return f"user:{user_id}:web_app"


def is_virtual_device_id(device_id: Optional[str]) -> bool:
    return bool(device_id and device_id.startswith("user:"))


def get_authenticated_device(db: Session, x_device_key: Optional[str]) -> models.Device:
    if not x_device_key:
        raise HTTPException(status_code=401, detail="X-Device-Key header is required")

    device = db.query(models.Device).filter(models.Device.api_key == x_device_key).first()
    if not device:
        raise HTTPException(status_code=401, detail="Invalid device API key")

    return device


def get_user_scoped_device_ids(db: Session, user_id: int) -> list[str]:
    """Return all internal device ids that belong to a user."""
    devices = db.query(models.Device).filter(models.Device.user_id == user_id).all()
    device_ids = [scoped_device_id(d) for d in devices]
    device_ids.append(web_app_device_id(user_id))
    return list(dict.fromkeys(device_ids))


def ensure_aware_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if not value:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def serialize_device_brief(device: Optional[models.Device]) -> Optional[dict]:
    if not device:
        return None

    return {
        "id": device.id,
        "device_name": device.device_name,
        "last_seen": ensure_aware_datetime(device.last_seen).isoformat() if device.last_seen else None,
    }


def get_preferred_user_device(db: Session, user_id: int) -> Optional[models.Device]:
    devices = db.query(models.Device).filter(models.Device.user_id == user_id).all()
    if not devices:
        return None

    minimum = datetime.min.replace(tzinfo=timezone.utc)

    def sort_key(device: models.Device):
        return (
            ensure_aware_datetime(device.last_seen) or minimum,
            ensure_aware_datetime(device.created_at) or minimum,
            device.id or 0,
        )

    return max(devices, key=sort_key)


def decode_user_from_token(token: str, db: Session) -> Optional[models.User]:
    """Decode JWT token and return the matching user if valid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            return None
        return db.query(models.User).filter(models.User.username == username).first()
    except JWTError:
        return None


async def broadcast_to_clients(message: dict, owner_id: Optional[int] = None):
    """Send a message only to the owner's active WebSocket clients."""
    dead = []
    for client in connected_clients:
        ws = client["ws"]
        ws_owner_id = client["user_id"]

        if owner_id is not None and ws_owner_id != owner_id:
            continue

        try:
            await ws.send_json(message)
        except Exception:
            dead.append(client)

    for client in dead:
        if client in connected_clients:
            connected_clients.remove(client)


def serialize_recommendation_record(record: models.Recommendation) -> dict:
    return {
        "id": record.id,
        "title": record.title,
        "description": record.description,
        "desc": record.description,
        "title_am": record.title_am,
        "description_am": record.description_am,
        "timestamp": record.timestamp.isoformat() if record.timestamp else None,
    }


def get_latest_recommendations_for_device(db: Session, device_id: str, limit: int = 5) -> list[dict]:
    recommendations = db.query(models.Recommendation).filter(
        models.Recommendation.device_id == device_id
    ).order_by(models.Recommendation.timestamp.desc()).limit(limit).all()
    return [serialize_recommendation_record(r) for r in recommendations]


def parse_forecast_date(raw_value, fallback: datetime) -> datetime:
    if isinstance(raw_value, datetime):
        return raw_value if raw_value.tzinfo else raw_value.replace(tzinfo=timezone.utc)

    if isinstance(raw_value, str):
        normalized = raw_value.strip()
        if normalized:
            try:
                parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                pass

    return fallback


def normalize_forecast_day_index(raw_value, fallback_index: int) -> int:
    try:
        parsed = int(raw_value)
    except (TypeError, ValueError):
        return fallback_index

    return parsed - 1 if parsed > 0 else parsed


def format_forecast_date_label(value: datetime) -> str:
    normalized = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return f"{normalized.strftime('%a')}, {normalized.strftime('%b')} {normalized.day}"


def get_sorted_forecast_records(db: Session, context_id: int) -> list[models.ForecastData]:
    records = db.query(models.ForecastData).filter(
        models.ForecastData.context_id == context_id
    ).order_by(models.ForecastData.id.asc()).all()

    return records


def serialize_forecast_days(forecasts: list[models.ForecastData]) -> list[dict]:
    return [
        {
            "day": index + 1,
            "risk_level": forecast.risk_level,
            "date": forecast.forecast_date.isoformat() if forecast.forecast_date else None,
            "created_at": forecast.created_at.isoformat() if forecast.created_at else None,
        }
        for index, forecast in enumerate(forecasts)
    ]


def normalize_disease_type(raw_value: Optional[str]) -> str:
    return normalize_disease_label(raw_value)


def normalize_detection_source(raw_value: Optional[str]) -> str:
    normalized = (raw_value or "").strip().lower()
    if normalized in {"web", "web_app", "cloud", "app"}:
        return "web_app"
    return "gateway"


def should_reuse_user_sensor_fallback(detection: models.InferenceResult) -> bool:
    if normalize_detection_source(getattr(detection, "source", None)) == "web_app":
        return False
    return not is_virtual_device_id(getattr(detection, "device_id", None))


def get_sensor_for_detection(
    db: Session,
    detection: models.InferenceResult,
    *,
    fallback_device_ids: Optional[list[str]] = None,
) -> Optional[models.SensorData]:
    sensor = db.query(models.SensorData).filter(
        models.SensorData.timestamp <= detection.timestamp,
        models.SensorData.device_id == detection.device_id,
    ).order_by(models.SensorData.timestamp.desc()).first()

    if sensor or not fallback_device_ids or not should_reuse_user_sensor_fallback(detection):
        return sensor

    # Return the most recent sensor reading from any of the user's devices
    return db.query(models.SensorData).filter(
        models.SensorData.device_id.in_(fallback_device_ids)
    ).order_by(models.SensorData.timestamp.desc()).first()


def serialize_scan_request(
    scan_request: Optional[models.ScanRequest],
    device: Optional[models.Device] = None,
) -> Optional[dict]:
    if not scan_request:
        return None

    return {
        "id": scan_request.id,
        "user_id": scan_request.user_id,
        "device_id": scan_request.device_id,
        "status": (scan_request.status or "pending").lower(),
        "source": scan_request.source or "edge_impulse",
        "model_name": scan_request.model_name or "Edge Impulse EfficientNet",
        "requested_at": ensure_aware_datetime(scan_request.requested_at).isoformat() if scan_request.requested_at else None,
        "completed_at": ensure_aware_datetime(scan_request.completed_at).isoformat() if scan_request.completed_at else None,
        "result_inference_id": scan_request.result_inference_id,
        "result_disease_type": (
            normalize_disease_type(scan_request.result_disease_type)
            if scan_request.result_disease_type
            else None
        ),
        "result_confidence_score": scan_request.result_confidence_score,
        "device": serialize_device_brief(device),
    }


def get_latest_scan_request_record(db: Session, user_id: int) -> Optional[models.ScanRequest]:
    return db.query(models.ScanRequest).filter(
        models.ScanRequest.user_id == user_id
    ).order_by(models.ScanRequest.requested_at.desc(), models.ScanRequest.id.desc()).first()


def get_requested_scan_for_upload(
    db: Session,
    *,
    device: models.Device,
    request_id: Optional[int],
) -> Optional[models.ScanRequest]:
    if request_id is None:
        return None

    scan_request = db.query(models.ScanRequest).filter(
        models.ScanRequest.id == request_id,
        models.ScanRequest.user_id == device.user_id,
        models.ScanRequest.device_id == device.id,
    ).first()

    if not scan_request:
        raise HTTPException(status_code=404, detail="Pending scan request was not found for this device")

    if (scan_request.status or "").lower() != "pending":
        raise HTTPException(status_code=409, detail="Scan request is no longer pending")

    return scan_request


def complete_scan_request(
    scan_request: Optional[models.ScanRequest],
    *,
    detection: models.InferenceResult,
    timestamp: datetime,
) -> Optional[models.ScanRequest]:
    if not scan_request:
        return None

    scan_request.status = "completed"
    scan_request.completed_at = timestamp
    scan_request.result_inference_id = detection.id
    scan_request.result_disease_type = normalize_disease_type(detection.disease_type)
    scan_request.result_confidence_score = detection.confidence_score
    return scan_request


def get_latest_forecast_for_device(db: Session, device_id: str) -> Optional[dict]:
    forecast_context = db.query(models.ForecastContext).filter(
        models.ForecastContext.device_id == device_id
    ).order_by(models.ForecastContext.timestamp.desc()).first()

    if not forecast_context:
        return None

    forecast_days = serialize_forecast_days(get_sorted_forecast_records(db, forecast_context.id))

    return {
        "context": {
            "id": forecast_context.id,
            "timestamp": forecast_context.timestamp.isoformat() if forecast_context.timestamp else None,
        },
        "days": forecast_days,
        "created_at": forecast_context.timestamp.isoformat() if forecast_context.timestamp else None,
    }


def resolve_ingest_recommendations(payload, disease_type: str, risk_level: str) -> list[dict]:
    payload_recommendations = getattr(payload, "recommendations", None)
    if payload_recommendations:
        return [
            {
                "title": rec.title,
                "description": rec.description,
                "title_am": rec.title_am,
                "description_am": rec.description_am,
            }
            for rec in payload_recommendations
        ]

    title_am = getattr(payload, "title_am", None)
    action_am = getattr(payload, "action_am", None)
    if title_am or action_am:
        bilingual_recommendation = logic.get_recommendation_bilingual(disease_type, risk_level)
        return [{
            "title": bilingual_recommendation["title_en"],
            "description": bilingual_recommendation["description_en"],
            "title_am": title_am or bilingual_recommendation["title_am"],
            "description_am": action_am or bilingual_recommendation["description_am"],
        }]

    return []


def create_notification_if_due(
    db: Session,
    *,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    timestamp: datetime,
) -> Optional[models.Notification]:
    if NOTIFICATION_DEDUPE_MINUTES > 0:
        cutoff = timestamp - timedelta(minutes=NOTIFICATION_DEDUPE_MINUTES)
        recent_match = db.query(models.Notification).filter(
            models.Notification.user_id == user_id,
            models.Notification.type == notification_type,
            models.Notification.title == title,
            models.Notification.timestamp >= cutoff,
        ).order_by(models.Notification.timestamp.desc()).first()

        if recent_match:
            return None

    notification = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        timestamp=timestamp,
    )
    db.add(notification)
    db.flush()
    return notification


def apply_notification_rules(
    db: Session,
    *,
    owner_id: int,
    disease_type: str,
    confidence_score: float,
    forecast: Optional[list[dict]],
    background_tasks: Optional[BackgroundTasks],
    timestamp: datetime,
):
    print(f"\n[NOTIFY DEBUG] apply_notification_rules called")
    print(f"  owner_id={owner_id}, disease={disease_type!r}, conf={confidence_score}, forecast_count={len(forecast or [])}")

    user = db.query(models.User).filter(models.User.id == owner_id).first()
    if not user:
        print(f"[NOTIFY DEBUG] User {owner_id} not found — skipping.")
        return

    confidence_threshold = max(50, min(95, int(user.disease_confidence_threshold or 70))) / 100.0
    email_enabled = bool(user.notification_emails_enabled)
    print(f"[NOTIFY DEBUG] User settings: email={user.email!r}, emails_enabled={email_enabled}, threshold={confidence_threshold}")

    # ── Disease detection alert ───────────────────────────────────
    if disease_type != "Healthy" and confidence_score >= confidence_threshold:
        disease_title = f"{disease_type} Detected"
        disease_message = f"{disease_type} detected with {confidence_score * 100:.1f}% confidence. Check your mango plants."
        notification = create_notification_if_due(
            db,
            user_id=user.id,
            title=disease_title,
            message=disease_message,
            notification_type="disease_alert",
            timestamp=timestamp,
        )
        if notification:
            print(f"[NOTIFY DEBUG] Disease notification CREATED (id={notification.id}).")
            if background_tasks and user.email and email_enabled:
                rec = logic.get_recommendation_bilingual(disease_type, "HIGH RISK")
                treatment = rec["description_en"]
                print(f"[NOTIFY DEBUG] Queuing disease email to {user.email!r}")
                background_tasks.add_task(
                    send_disease_alert_email,
                    user.email,
                    disease_type,
                    confidence_score * 100,
                    treatment,
                )
            else:
                print(f"[NOTIFY DEBUG] NOT queuing disease email: bg_tasks={bool(background_tasks)}, email={user.email!r}, enabled={email_enabled}")
        else:
            print(f"[NOTIFY DEBUG] Disease notification DEDUPLICATED (skipped).")
    else:
        print(f"[NOTIFY DEBUG] Disease gate failed: disease={disease_type!r}, conf={confidence_score} vs threshold={confidence_threshold}")

    # ── Forecast alerts ───────────────────────────────────────────
    for i, day_forecast in enumerate(forecast or []):
        risk_level = (day_forecast.get("risk_level") or "Stable")
        if "high" not in risk_level.lower():
            continue

        if "Anthracnose" in risk_level:
            risk_name = "Anthracnose"
        elif "Mildew" in risk_level:
            risk_name = "Powdery Mildew"
        else:
            risk_name = "Disease"

        forecast_date = parse_forecast_date(day_forecast.get("date"), timestamp + timedelta(days=i + 1))
        forecast_date_label = format_forecast_date_label(forecast_date)
        title = f"Forecast for {forecast_date_label}: High {risk_name} Risk"
        message = f"Forecast predicts high {risk_name.lower()} risk on {forecast_date_label}. Consider preventive measures."
        notification = create_notification_if_due(
            db,
            user_id=user.id,
            title=title,
            message=message,
            notification_type="forecast_alert",
            timestamp=timestamp,
        )
        if notification:
            print(f"[NOTIFY DEBUG] Forecast notification CREATED for day {i+1} (id={notification.id}).")
            if background_tasks and user.email and email_enabled:
                print(f"[NOTIFY DEBUG] Queuing forecast email to {user.email!r}")
                background_tasks.add_task(
                    send_forecast_alert_email,
                    user.email,
                    forecast_date_label,
                    risk_name,
                    message,
                )
            else:
                print(f"[NOTIFY DEBUG] NOT queuing forecast email: bg_tasks={bool(background_tasks)}, email={user.email!r}, enabled={email_enabled}")
        else:
            print(f"[NOTIFY DEBUG] Forecast notification DEDUPLICATED for day {i+1}")


def persist_payload_records(
    db: Session,
    *,
    internal_device_id: str,
    payload,
    disease_type: str,
    risk_level: str,
    server_now: datetime,
) -> dict:
    new_sensor = models.SensorData(
        device_id=internal_device_id,
        temperature=payload.temperature,
        humidity=payload.humidity,
        timestamp=server_now,
    )
    db.add(new_sensor)
    db.flush()

    new_detection = models.InferenceResult(
        device_id=internal_device_id,
        disease_type=disease_type,
        confidence_score=payload.confidence_score,
        source="gateway",
        timestamp=server_now,
    )
    db.add(new_detection)
    db.flush()

    recommendation_ids = []
    recs_data = resolve_ingest_recommendations(payload, disease_type, risk_level)
    for r_data in recs_data:
        new_rec = models.Recommendation(
            device_id=internal_device_id,
            title=r_data["title"],
            description=r_data["description"],
            title_am=r_data["title_am"],
            description_am=r_data["description_am"],
            timestamp=server_now,
        )
        db.add(new_rec)
        db.flush()
        recommendation_ids.append(new_rec.id)

    forecast_ids = []
    context_id = None
    if payload.forecast:
        context = db.query(models.ForecastContext).filter(
            models.ForecastContext.device_id == internal_device_id
        ).first()

        if not context:
            context = models.ForecastContext(
                device_id=internal_device_id,
                timestamp=server_now,
            )
            db.add(context)
            db.flush()
        else:
            context.timestamp = server_now
            
        context_id = context.id

        for idx, day in enumerate(payload.forecast):
            day_index = normalize_forecast_day_index(day.get("day"), idx)
            fallback_date = server_now + timedelta(days=idx + 1)
            new_forecast = models.ForecastData(
                device_id=internal_device_id,
                day_index=day_index,
                risk_level=day.get("risk_level", ""),
                forecast_date=parse_forecast_date(day.get("date"), fallback_date),
                context_id=context_id,
            )
            db.add(new_forecast)
            db.flush()
            forecast_ids.append(new_forecast.id)

        records_to_keep = db.query(models.ForecastData).filter(
            models.ForecastData.context_id == context_id
        ).order_by(models.ForecastData.id.desc()).limit(5).all()
        
        keep_ids = [r.id for r in records_to_keep]
        
        if keep_ids:
            db.query(models.ForecastData).filter(
                models.ForecastData.context_id == context_id,
                ~models.ForecastData.id.in_(keep_ids)
            ).delete(synchronize_session=False)

    return {
        "sensor": new_sensor,
        "detection": new_detection,
        "recommendation_ids": recommendation_ids,
        "forecast_ids": forecast_ids,
        "context_id": context_id,
    }


async def ingest_device_payload(
    payload,
    *,
    db: Session,
    x_device_key: Optional[str],
    background_tasks: Optional[BackgroundTasks] = None,
) -> dict:
    device = get_authenticated_device(db, x_device_key)

    owner_id = device.user_id
    server_now = datetime.now(timezone.utc)
    device.last_seen = server_now
    internal_device_id = scoped_device_id(device)
    requested_scan = get_requested_scan_for_upload(
        db,
        device=device,
        request_id=getattr(payload, "request_id", None),
    )

    disease_type = normalize_disease_type(getattr(payload, "disease_type", None))
    risk = logic.evaluate_risk(disease_type, payload.temperature, payload.humidity)
    forecast_alert = logic.get_forecast_alert(payload.temperature, payload.humidity)

    persisted = persist_payload_records(
        db,
        internal_device_id=internal_device_id,
        payload=payload,
        disease_type=disease_type,
        risk_level=risk["risk_level"],
        server_now=server_now,
    )
    completed_scan_request = complete_scan_request(
        requested_scan,
        detection=persisted["detection"],
        timestamp=server_now,
    )

    apply_notification_rules(
        db,
        owner_id=owner_id,
        disease_type=disease_type,
        confidence_score=payload.confidence_score,
        forecast=getattr(payload, "forecast", None),
        background_tasks=background_tasks,
        timestamp=server_now,
    )

    # ── Auto-forecast from stored sensor history ────────────────────────────
    # After every ingest, check if we have ≥ 24 sensor readings for this device.
    # If yes, pull the last 24 and run the TFLite forecasting model.
    _maybe_auto_forecast(db, internal_device_id=internal_device_id, server_now=server_now)

    db.commit()

    dashboard_payload = build_dashboard_payload(
        persisted["sensor"],
        persisted["detection"],
        db,
        scan_recommendation_ids=persisted["recommendation_ids"],
    )
    await broadcast_to_clients(dashboard_payload, owner_id=owner_id)

    return {
        "status": "success",
        "owner_id": owner_id,
        "device_id": internal_device_id,
        "data_id": persisted["sensor"].id,
        "sensor_id": persisted["sensor"].id,
        "inference_id": persisted["detection"].id,
        "detection_id": persisted["detection"].id,
        "recommendation_id": persisted["recommendation_ids"][0] if persisted["recommendation_ids"] else None,
        "recommendation_ids": persisted["recommendation_ids"],
        "forecast_ids": persisted["forecast_ids"],
        "context_id": persisted["context_id"],
        "risk_level": risk["risk_level"],
        "recommendation": risk["recommendation"],
        "recommendation_am": risk.get("recommendation_am"),
        "forecast_alert": forecast_alert,
        "title_am": getattr(payload, "title_am", None),
        "action_am": getattr(payload, "action_am", None),
        "forecast": getattr(payload, "forecast", None),
        "scan_request": serialize_scan_request(completed_scan_request, device),
        "disease_type": disease_type,
        "confidence_score": payload.confidence_score,
        "timestamp": server_now.isoformat(),
        "dashboard_payload": dashboard_payload,
        "message": "Data ingested successfully",
    }


def build_dashboard_payload(
    sensor,
    inference,
    db: Session,
    *,
    scan_recommendation_ids: Optional[list[int]] = None,
) -> dict:
    """
    Build the JSON payload the frontend Dashboard expects.

    scan_recommendation_ids — IDs of Recommendation rows just persisted from the
    Nano's serial payload. When provided, the Nano's text is used verbatim as
    scan_recommendation. The backend never regenerates recommendation text.
    """
    normalized_disease_type = normalize_disease_type(inference.disease_type)
    risk = logic.evaluate_risk(normalized_disease_type, sensor.temperature, sensor.humidity)
    forecast_alert = logic.get_forecast_alert(sensor.temperature, sensor.humidity)

    # Compute a simple stability score (0-100) from confidence + env risk
    stability = round(inference.confidence_score * 100)
    if risk["risk_level"] == "HIGH RISK":
        stability = max(0, stability - 30)
    elif risk["risk_level"] == "MEDIUM RISK":
        stability = max(0, stability - 15)

    # Map risk level to health status
    health_map = {"LOW RISK": "OPTIMAL", "MEDIUM RISK": "WARNING", "HIGH RISK": "CRITICAL"}
    health = health_map.get(risk["risk_level"], "OPTIMAL")

    # ── Scan-specific recommendation ─────────────────────────────────────────
    # Use the recommendation the Nano already computed and stored in the DB.
    # The backend does NOT regenerate or override this text.
    scan_recommendation = None
    if scan_recommendation_ids:
        rec_record = db.query(models.Recommendation).filter(
            models.Recommendation.id == scan_recommendation_ids[0]
        ).first()
        if rec_record:
            scan_recommendation = {
                "title":          rec_record.title,
                "description":    rec_record.description,
                "desc":           rec_record.description,
                "title_am":       rec_record.title_am,
                "description_am": rec_record.description_am,
                "timestamp":      rec_record.timestamp.isoformat() if rec_record.timestamp else None,
            }
    elif normalized_disease_type != "Healthy":
        # Fallback only when no Nano recommendation was stored (legacy / web-scan path)
        latest_stored = db.query(models.Recommendation).filter(
            models.Recommendation.device_id == inference.device_id
        ).order_by(models.Recommendation.timestamp.desc()).first()
        if latest_stored:
            scan_recommendation = {
                "title":          latest_stored.title,
                "description":    latest_stored.description,
                "desc":           latest_stored.description,
                "title_am":       latest_stored.title_am,
                "description_am": latest_stored.description_am,
                "timestamp":      latest_stored.timestamp.isoformat() if latest_stored.timestamp else None,
            }

    # ── General tips for the dashboard Recommendations panel ─────────────────
    now_str = (inference.timestamp if inference.timestamp else datetime.now(timezone.utc)).isoformat()
    latest_recommendations = [
        {
            "id": i,
            "title": tip["en"]["title"],
            "description": tip["en"]["description"],
            "title_am": tip["am"]["title"],
            "description_am": tip["am"]["description"],
            "timestamp": now_str
        }
        for i, tip in enumerate(logic.GENERAL_TIPS)
    ][:5]

    latest_forecast = get_latest_forecast_for_device(db, inference.device_id)

    return {
        "temperature":       sensor.temperature,
        "humidity":          sensor.humidity,
        "moisture":          round(sensor.humidity * 0.85, 1),  # derived estimate
        "health":            health,
        "stability":         stability,
        "disease_type":      normalized_disease_type,
        "confidence_score":  inference.confidence_score,
        "risk_level":        risk["risk_level"],
        "scan_recommendation": scan_recommendation,   # Nano-computed, verbatim
        "recommendations":   latest_recommendations,  # general tips panel
        "forecast_alert":    forecast_alert if (forecast_alert and "High Risk" in forecast_alert) else None,
        "forecast":          latest_forecast,
        "timestamp":         inference.timestamp.isoformat() if inference.timestamp else None,
    }


def build_analysis_summary(
    detections: list[models.InferenceResult],
    sensors: list[models.SensorData],
    recommendations: list[models.Recommendation],
    forecasts: list[models.ForecastData],
) -> dict:
    localized_recommendations = [
        {
            "title": r.title,
            "title_am": r.title_am,
        }
        for r in recommendations
        if r.title or r.title_am
    ]

    if not detections:
        return {
            "total_scans": 0,
            "healthy_rate": 0,
            "top_disease_label": None,
            "disease_count": 0,
            "healthy_count": 0,
            "healthy_temp_avg": None,
            "healthy_humidity_avg": None,
            "diseased_temp_avg": None,
            "diseased_humidity_avg": None,
            "risk_level": "LOW",
            "risk_score": 0,
            "disease_rate": 0,
            "average_confidence": 0,
            "recommendation_count": len(recommendations),
            "latest_recommendation": localized_recommendations[0] if localized_recommendations else None,
            "high_risk_days": 0,
            "stable_days": 0,
            "sensor_sample_count": len(sensors),
            "confidence_trend": [],
            "temperature_trend": [],
            "disease_breakdown": [],
            "forecast_risk_trend": [],
            "top_recommendations": localized_recommendations[:3],
        }

    disease_frequency = {}
    healthy_count = 0
    disease_count = 0
    healthy_temp_total = 0
    healthy_humidity_total = 0
    healthy_with_env_count = 0
    diseased_temp_total = 0
    diseased_humidity_total = 0
    diseased_with_env_count = 0
    confidence_total = 0

    for entry in detections:
        disease_type = normalize_disease_type(entry.disease_type)
        is_healthy = disease_type.lower() == "healthy"
        has_temperature = isinstance(getattr(entry, "temperature", None), (int, float))
        has_humidity = isinstance(getattr(entry, "humidity", None), (int, float))

        confidence_total += float(entry.confidence_score or 0)

        if is_healthy:
            healthy_count += 1
            if has_temperature and has_humidity:
                healthy_temp_total += entry.temperature
                healthy_humidity_total += entry.humidity
                healthy_with_env_count += 1
            continue

        disease_count += 1
        disease_frequency[disease_type] = (disease_frequency.get(disease_type, 0) + 1)
        if has_temperature and has_humidity:
            diseased_temp_total += entry.temperature
            diseased_humidity_total += entry.humidity
            diseased_with_env_count += 1

    top_disease_label = None
    max_count = 0
    for disease, count in disease_frequency.items():
        if count > max_count:
            max_count = count
            top_disease_label = disease

    healthy_rate = (healthy_count / len(detections)) * 100
    recent_window = detections[: min(25, len(detections))]
    recent_diseased = len([
        d for d in recent_window if normalize_disease_type(d.disease_type).lower() != "healthy"
    ])
    disease_rate = (recent_diseased / len(recent_window)) * 100 if recent_window else 0
    average_confidence = (confidence_total / len(detections)) * 100 if detections else 0

    risk_score = round(disease_rate * 0.7 + average_confidence * 0.3)
    risk_level = "LOW"
    if risk_score >= 65:
        risk_level = "HIGH"
    elif risk_score >= 40:
        risk_level = "MEDIUM"

    high_risk_days = len([f for f in forecasts if "HIGH" in (f.risk_level or "").upper()])
    stable_days = max(0, len(forecasts) - high_risk_days)

    confidence_trend = [
        max(0, min(100, round((d.confidence_score or 0) * 100)))
        for d in reversed(detections[:12])
    ]

    temperature_values = [
        s.temperature for s in sensors[-12:]
        if isinstance(s.temperature, (int, float))
    ]
    if temperature_values:
        min_temp = min(temperature_values)
        max_temp = max(temperature_values)
        temp_range = max(1, max_temp - min_temp)
        temperature_trend = [round(((value - min_temp) / temp_range) * 100) for value in temperature_values]
    else:
        temperature_trend = []

    total_diseased = max(1, disease_count)
    disease_breakdown = [
        {
            "name": name,
            "count": count,
            "pct": round((count / total_diseased) * 100),
        }
        for name, count in sorted(disease_frequency.items(), key=lambda item: item[1], reverse=True)[:4]
    ]

    forecast_risk_trend = []
    for forecast in forecasts:
        risk = (forecast.risk_level or "").upper()
        if "HIGH" in risk:
            forecast_risk_trend.append(90)
        elif "MEDIUM" in risk:
            forecast_risk_trend.append(60)
        else:
            forecast_risk_trend.append(30)

    return {
        "total_scans": len(detections),
        "healthy_rate": healthy_rate,
        "top_disease_label": top_disease_label,
        "disease_count": disease_count,
        "healthy_count": healthy_count,
        "healthy_temp_avg": (healthy_temp_total / healthy_with_env_count) if healthy_with_env_count else None,
        "healthy_humidity_avg": (healthy_humidity_total / healthy_with_env_count) if healthy_with_env_count else None,
        "diseased_temp_avg": (diseased_temp_total / diseased_with_env_count) if diseased_with_env_count else None,
        "diseased_humidity_avg": (diseased_humidity_total / diseased_with_env_count) if diseased_with_env_count else None,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "disease_rate": disease_rate,
        "average_confidence": average_confidence,
        "recommendation_count": len(recommendations),
        "latest_recommendation": localized_recommendations[0] if localized_recommendations else None,
        "high_risk_days": high_risk_days,
        "stable_days": stable_days,
        "sensor_sample_count": len(sensors),
        "confidence_trend": confidence_trend,
        "temperature_trend": temperature_trend,
        "disease_breakdown": disease_breakdown,
        "forecast_risk_trend": forecast_risk_trend,
        "latest_scan_timestamp": detections[0].timestamp if detections else None,
        "top_recommendations": localized_recommendations[:3],
    }


# ------------------------------------------------------------------
# Auto-forecast helper (called from ingest)
# ------------------------------------------------------------------

FORECAST_MIN_READINGS = 24  # need at least 24 sensor rows to forecast


def _maybe_auto_forecast(db: Session, *, internal_device_id: str, server_now: datetime) -> None:
    """
    Pull the last FORECAST_MIN_READINGS sensor rows for the device and run the
    TFLite forecast model.  Persists the result into ForecastContext / ForecastData
    using the same shape the frontend already reads from /forecast/latest.
    """
    # Find the timestamp of the last generated forecast
    last_forecast = db.query(models.ForecastData).filter(
        models.ForecastData.device_id == internal_device_id
    ).order_by(models.ForecastData.id.desc()).first()

    # Count how many sensor readings have come in since the last forecast
    if last_forecast:
        new_scans_count = db.query(models.SensorData).filter(
            models.SensorData.device_id == internal_device_id,
            models.SensorData.timestamp > last_forecast.created_at
        ).count()
    else:
        new_scans_count = db.query(models.SensorData).filter(
            models.SensorData.device_id == internal_device_id
        ).count()

    # For Defense Day Demo: Only generate a forecast every 3 scans
    if new_scans_count < 3:
        return

    # Fetch up to the last 3 sensor readings
    sensor_rows = (
        db.query(models.SensorData)
        .filter(models.SensorData.device_id == internal_device_id)
        .order_by(models.SensorData.timestamp.desc())
        .limit(3)
        .all()
    )

    if not sensor_rows:
        return

    # Calculate average temperature and humidity of the last scans
    avg_temp = sum(row.temperature for row in sensor_rows) / len(sensor_rows)
    avg_humidity = sum(row.humidity for row in sensor_rows) / len(sensor_rows)

    # Pad to 24 readings using the average values for the demo
    readings = [{"temperature": avg_temp, "humidity": avg_humidity}] * FORECAST_MIN_READINGS

    result = forecast_service.run_forecast(readings)
    label = result["label"]
    confidence = result["confidence"]
    model_loaded = result["model_loaded"]

    print(
        f"[forecast_auto] {internal_device_id}: {label} ({confidence*100:.1f}%) "
        f"model_loaded={model_loaded} (using avg temp {avg_temp:.1f}, hum {avg_humidity:.1f})"
    )

    context = db.query(models.ForecastContext).filter(
        models.ForecastContext.device_id == internal_device_id
    ).first()

    if not context:
        context = models.ForecastContext(
            device_id=internal_device_id,
            timestamp=server_now,
        )
        db.add(context)
        db.flush()
    else:
        context.timestamp = server_now

    # Use the actual timestamp for the log instead of a fake future day
    new_forecast = models.ForecastData(
        device_id=internal_device_id,
        day_index=0,
        risk_level=label,
        forecast_date=server_now,
        context_id=context.id,
    )
    db.add(new_forecast)
    db.flush()

    # Maintain a rolling window of the last 5 forecasts for this context (queue behavior)
    records_to_keep = (
        db.query(models.ForecastData)
        .filter(models.ForecastData.context_id == context.id)
        .order_by(models.ForecastData.id.desc())
        .limit(5)
        .all()
    )
    
    keep_ids = [r.id for r in records_to_keep]
    if keep_ids:
        db.query(models.ForecastData).filter(
            models.ForecastData.context_id == context.id,
            ~models.ForecastData.id.in_(keep_ids)
        ).delete(synchronize_session=False)

    # Maintain day_index for UI mapping (0 to N), but DO NOT rewrite the forecast_date
    records_to_keep.reverse() # Oldest first
    for idx, rec in enumerate(records_to_keep):
        rec.day_index = idx

    db.flush()


# ------------------------------------------------------------------
# POST /api/forecast  —  direct inference endpoint
# ------------------------------------------------------------------

class _ForecastReading(schemas.BaseModel):
    temperature: float
    humidity: float


class _ForecastRequest(schemas.BaseModel):
    readings: list[_ForecastReading]


@app.post("/api/forecast")
def run_forecast_endpoint(payload: _ForecastRequest):
    """
    Run the TFLite forecasting model against a caller-supplied list of readings.
    Requires exactly 24 {temperature, humidity} entries.
    """
    if len(payload.readings) != 24:
        raise HTTPException(
            status_code=422,
            detail=f"Exactly 24 readings are required, received {len(payload.readings)}.",
        )

    readings = [
        {"temperature": r.temperature, "humidity": r.humidity}
        for r in payload.readings
    ]
    result = forecast_service.run_forecast(readings)
    return result


# ------------------------------------------------------------------
# Auth endpoint
# ------------------------------------------------------------------

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_current_user(authorization: Optional[str] = Header(None), token: Optional[str] = None, db: Session = Depends(get_db)):
    """Extract user from JWT Bearer token."""
    raw_token = token
    if authorization:
        raw_token = authorization.replace("Bearer ", "")
    if not raw_token:
        raise HTTPException(status_code=401, detail="Missing token")
        
    try:
        payload = jwt.decode(raw_token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.post("/register")
async def register(
    username: str = Form(...),
    password: str = Form(...),
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    """Register a new user with email."""
    if not username or not password or not email:
        raise HTTPException(status_code=400, detail="Username, password, and email are required")

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    existing_email = db.query(models.User).filter(models.User.email == email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user
    hashed_password = get_password_hash(password)
    new_user = models.User(username=username, email=email, password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate token
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    """Login user with username and password."""
    # Try to find user in database
    user = db.query(models.User).filter(models.User.username == username).first()

    if user and verify_password(password, user.password):
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        token = jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
        return {"access_token": token, "token_type": "bearer"}

    # Fallback to default credentials for backward compatibility
    if username == DEFAULT_USERNAME and password == DEFAULT_PASSWORD:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        token = jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
        return {"access_token": token, "token_type": "bearer"}

    raise HTTPException(status_code=401, detail="Invalid credentials")


# ------------------------------------------------------------------
# Profile endpoints
# ------------------------------------------------------------------

@app.get("/me", response_model=schemas.UserProfileOut)
def get_current_user_profile(user: models.User = Depends(get_current_user)):
    """Get the current user's profile information."""
    return user

@app.put("/profile", response_model=schemas.UserProfileOut)
def update_profile(
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Update the current user's profile."""
    # Check email uniqueness if changing
    if payload.email and payload.email != user.email:
        existing = db.query(models.User).filter(
            models.User.email == payload.email,
            models.User.id != user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")

    # Update fields
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.email is not None:
        user.email = payload.email
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    if payload.notification_emails_enabled is not None:
        user.notification_emails_enabled = payload.notification_emails_enabled
    if payload.disease_confidence_threshold is not None:
        threshold = max(50, min(95, int(payload.disease_confidence_threshold)))
        user.disease_confidence_threshold = threshold

    db.commit()
    db.refresh(user)
    return user

@app.put("/profile/password")
def change_password(
    payload: schemas.PasswordChangeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Change the current user's password."""
    # Verify current password
    if not verify_password(payload.current_password, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Validate new password
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    # Update password
    user.password = get_password_hash(payload.new_password)
    db.commit()

    return {"status": "success", "message": "Password updated successfully"}


# ------------------------------------------------------------------
# WebSocket endpoint  —  streams latest data to the frontend
# ------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=1008)
        return

    db = database.SessionLocal()
    user = decode_user_from_token(token, db)
    if not user:
        db.close()
        await websocket.close(code=1008)
        return

    user_device_ids = get_user_scoped_device_ids(db, user.id)

    await websocket.accept()
    client_entry = {"ws": websocket, "user_id": user.id}
    connected_clients.append(client_entry)
    try:
        # Send current state immediately on connect
        try:
            inference_query = db.query(models.InferenceResult)
            if user_device_ids:
                inference_query = inference_query.filter(models.InferenceResult.device_id.in_(user_device_ids))
            inference = inference_query.order_by(models.InferenceResult.timestamp.desc()).first()
            if inference:
                # Get sensor data at the time of detection (to match dashboard/logs)
                sensor = get_sensor_for_detection(
                    db,
                    inference,
                    fallback_device_ids=user_device_ids,
                )
                if sensor:
                    payload = build_dashboard_payload(sensor, inference, db)
                    await websocket.send_json(payload)
        finally:
            db.close()

        # Keep connection alive and listen for any client messages
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if client_entry in connected_clients:
            connected_clients.remove(client_entry)


# ------------------------------------------------------------------
# Existing endpoints
# ------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"message": "Welcome to the Intelligent Plant Health Monitoring API"}


@app.get("/health")
def health_check():
    """Lightweight health and database connectivity probe."""
    db_start = time.perf_counter()
    db_ok = False
    db_error = None

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        db_error = str(exc)

    db_duration_ms = format_duration_ms(db_start)
    uptime_seconds = round(time.time() - APP_STARTED_AT, 2)
    overall_status = "ok" if db_ok else "degraded"

    payload = {
        "status": overall_status,
        "service": "backend",
        "uptime_seconds": uptime_seconds,
        "database": {
            "ok": db_ok,
            "duration_ms": db_duration_ms,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if db_error:
        payload["database"]["error"] = db_error

    if db_ok:
        return payload

    return JSONResponse(status_code=503, content=payload)


@app.post("/upload", response_model=dict)
async def upload_data(
    payload: schemas.UploadPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_device_key: Optional[str] = Header(None)
):
    try:
        result = await ingest_device_payload(
            payload,
            db=db,
            x_device_key=x_device_key,
            background_tasks=background_tasks,
        )
        owner = db.query(models.User).filter(models.User.id == result["owner_id"]).first()
        print(f"\n[UPLOAD DEBUG] /upload scan processed for {result['owner_id']}")
        # Automated emails for manual scans are disabled as they are redundant when the user is viewing the dashboard.
        # if owner and owner.notification_emails_enabled and owner.email:
        #     background_tasks.add_task(...)

        return {
            "status": result["status"],
            "data_id": result["data_id"],
            "inference_id": result["inference_id"],
            "recommendation_id": result["recommendation_id"],
            "recommendation_ids": result["recommendation_ids"],
            "forecast_ids": result["forecast_ids"],
            "context_id": result["context_id"],
            "risk_level": result["risk_level"],
            "recommendation": result["recommendation"],
            "recommendation_am": result["recommendation_am"],
            "forecast_alert": result["forecast_alert"],
            "title_am": result["title_am"],
            "action_am": result["action_am"],
            "forecast": result["forecast"],
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/history", response_model=schemas.HistoricalData)
def get_history(
    db: Session = Depends(get_db),
    limit: int = 100,
    user: models.User = Depends(get_current_user)
):
    user_device_ids = get_user_scoped_device_ids(db, user.id)
    if not user_device_ids:
        return {"sensor_data": [], "inference_results": []}

    sensor_data = db.query(models.SensorData).filter(
        models.SensorData.device_id.in_(user_device_ids)
    ).order_by(models.SensorData.timestamp.desc()).limit(limit).all()

    inference_results = db.query(models.InferenceResult).filter(
        models.InferenceResult.device_id.in_(user_device_ids)
    ).order_by(models.InferenceResult.timestamp.desc()).limit(limit).all()

    return {
        "sensor_data": sensor_data,
        "inference_results": inference_results
    }


# ------------------------------------------------------------------
# NEW MangaGuard API Endpoints
# ------------------------------------------------------------------

@app.get("/sensors/latest", response_model=schemas.SensorLatest)
def get_sensors_latest(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get the latest sensor reading (temperature and humidity)."""
    user_device_ids = get_user_scoped_device_ids(db, user.id)
    if not user_device_ids:
        raise HTTPException(status_code=404, detail="No sensor data available")

    sensor = db.query(models.SensorData).filter(
        models.SensorData.device_id.in_(user_device_ids)
    ).order_by(models.SensorData.timestamp.desc()).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="No sensor data available")
    return {
        "temperature": sensor.temperature,
        "humidity": sensor.humidity,
        "timestamp": sensor.timestamp
    }


@app.get("/sensors/history")
def get_sensors_history(
    range: str = "24h",
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """
    Get sensor history for a specified time range.
    range: '24h', '7d', or '30d'
    """
    now = datetime.now(timezone.utc)

    if range == "24h":
        start_time = now - timedelta(hours=24)
    elif range == "7d":
        start_time = now - timedelta(days=7)
    elif range == "30d":
        start_time = now - timedelta(days=30)
    else:
        start_time = now - timedelta(hours=24)  # default to 24h

    user_device_ids = get_user_scoped_device_ids(db, user.id)
    if not user_device_ids:
        return {"range": range, "data": []}

    data = db.query(models.SensorData).filter(
        models.SensorData.timestamp >= start_time,
        models.SensorData.device_id.in_(user_device_ids)
    ).order_by(models.SensorData.timestamp.asc()).all()

    return {
        "range": range,
        "data": [
            {
                "temperature": d.temperature,
                "humidity": d.humidity,
                "timestamp": d.timestamp
            } for d in data
        ]
    }


@app.get("/detection/latest")
def get_detection_latest(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get the absolute latest disease detection result with matching sensor data and forecast."""
    user_device_ids = get_user_scoped_device_ids(db, user.id)
    if not user_device_ids:
        raise HTTPException(status_code=404, detail="No detection data available")

    detection = db.query(models.InferenceResult).order_by(
        models.InferenceResult.timestamp.desc()
    ).filter(
        models.InferenceResult.device_id.in_(user_device_ids),
        models.InferenceResult.source == "gateway"
    ).first()

    if not detection:
        raise HTTPException(status_code=404, detail="No detection data available")

    # Get sensor data at the time of detection (same as /detection/history does)
    sensor = get_sensor_for_detection(
        db,
        detection,
        fallback_device_ids=user_device_ids,
    )

    return {
        "disease_type": normalize_disease_type(detection.disease_type),
        "confidence_score": detection.confidence_score,
        "source": normalize_detection_source(getattr(detection, "source", None)),
        "timestamp": detection.timestamp,
        "temperature": sensor.temperature if sensor else None,
        "humidity": sensor.humidity if sensor else None,
        "forecast": get_latest_forecast_for_device(db, detection.device_id),
    }


@app.get("/detection/history")
def get_detection_history(
    page: int = 1,
    limit: int = 10,
    disease_first: bool = False,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Get paginated detection history with sensor readings at time of detection.
    """
    skip = (page - 1) * limit

    user_device_ids = get_user_scoped_device_ids(db, user.id)
    if not user_device_ids:
        return {
            "page": page,
            "limit": limit,
            "total": 0,
            "total_pages": 0,
            "data": []
        }

    query = db.query(models.InferenceResult).filter(
        models.InferenceResult.device_id.in_(user_device_ids)
    )

    if disease_first:
        # Prioritize non-healthy detections, then newest timestamp.
        query = query.order_by(
            case((models.InferenceResult.disease_type == "Healthy", 1), else_=0),
            models.InferenceResult.timestamp.desc(),
        )
    else:
        query = query.order_by(models.InferenceResult.timestamp.desc())

    detections = query.offset(skip).limit(limit).all()

    total = db.query(models.InferenceResult).filter(
        models.InferenceResult.device_id.in_(user_device_ids)
    ).count()

    result = []
    for detection in detections:
        # Find the most recent sensor data at or before detection time
        sensor = get_sensor_for_detection(
            db,
            detection,
            fallback_device_ids=user_device_ids,
        )

        result.append({
            "id": detection.id,
            "disease_type": normalize_disease_type(detection.disease_type),
            "confidence_score": detection.confidence_score,
            "source": normalize_detection_source(getattr(detection, "source", None)),
            "timestamp": detection.timestamp,
            "temperature": sensor.temperature if sensor else None,
            "humidity": sensor.humidity if sensor else None
        })

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit,
        "data": result
    }


@app.get("/forecast/latest")
def get_forecast_latest(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """
    Get the latest 5-day forecast with available context.
    """
    user_device_ids = get_user_scoped_device_ids(db, user.id)
    if not user_device_ids:
        raise HTTPException(status_code=404, detail="No forecast data available")

    # Get the most recent forecast context
    context = db.query(models.ForecastContext).filter(
        models.ForecastContext.device_id.in_(user_device_ids)
    ).order_by(models.ForecastContext.timestamp.desc()).first()

    if not context:
        raise HTTPException(status_code=404, detail="No forecast data available")

    # Get forecast data for this context
    forecasts = get_sorted_forecast_records(db, context.id)

    return {
        "context": {
            "timestamp": context.timestamp
        },
        "days": [
            {
                "day": index + 1,
                "risk_level": forecast.risk_level,
                "date": forecast.forecast_date
            } for index, forecast in enumerate(forecasts)
        ],
        "created_at": context.timestamp
    }


@app.post("/forecast/context")
def post_forecast_context(
    payload: schemas.ForecastContextPayload,
    db: Session = Depends(get_db),
    x_device_key: Optional[str] = Header(None)
):
    """
    Accept forecast context from ESP32.
    """
    if not x_device_key:
        raise HTTPException(status_code=401, detail="X-Device-Key header is required")

    device = db.query(models.Device).filter(models.Device.api_key == x_device_key).first()
    if not device:
        raise HTTPException(status_code=401, detail="Invalid device API key")

    internal_device_id = scoped_device_id(device)
    new_context = models.ForecastContext(device_id=internal_device_id)
    db.add(new_context)
    db.commit()
    db.refresh(new_context)

    return {
        "status": "success",
        "context_id": new_context.id,
        "message": "Forecast context recorded"
    }


@app.get("/recommendations/latest")
def get_recommendations_latest(
    db: Session = Depends(get_db),
    limit: int = 5,
    user: models.User = Depends(get_current_user)
):
    """
    Get the latest recommendations from all user devices (hardware + manual quick scans).
    """
    user_device_ids = get_user_scoped_device_ids(db, user.id)
    recommendations = db.query(models.Recommendation).filter(
        models.Recommendation.device_id.in_(user_device_ids)
    ).order_by(models.Recommendation.timestamp.desc()).limit(limit).all()

    return {
        "data": [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "title_am": r.title_am,
                "description_am": r.description_am,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None
            }
            for r in recommendations
        ]
    }


@app.get("/analysis/summary")
def get_analysis_summary(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get a compact analysis summary for the Analysis page in a single request."""
    user_device_ids = get_user_scoped_device_ids(db, user.id)
    if not user_device_ids:
        return build_analysis_summary([], [], [], [])

    detections = db.query(models.InferenceResult).filter(
        models.InferenceResult.device_id.in_(user_device_ids)
    ).order_by(models.InferenceResult.timestamp.desc()).limit(200).all()

    enriched_detections = []
    for detection in detections:
        sensor = get_sensor_for_detection(
            db,
            detection,
            fallback_device_ids=user_device_ids,
        )

        detection.temperature = sensor.temperature if sensor else None
        detection.humidity = sensor.humidity if sensor else None
        enriched_detections.append(detection)

    sensors = db.query(models.SensorData).filter(
        models.SensorData.device_id.in_(user_device_ids)
    ).order_by(models.SensorData.timestamp.asc()).all()

    recommendations = db.query(models.Recommendation).filter(
        models.Recommendation.device_id.in_(user_device_ids)
    ).order_by(models.Recommendation.timestamp.desc()).limit(50).all()

    latest_context = db.query(models.ForecastContext).filter(
        models.ForecastContext.device_id.in_(user_device_ids)
    ).order_by(models.ForecastContext.timestamp.desc()).first()

    forecasts = []
    if latest_context:
        forecasts = db.query(models.ForecastData).filter(
            models.ForecastData.context_id == latest_context.id
        ).order_by(models.ForecastData.day_index.asc()).all()

    return build_analysis_summary(enriched_detections, sensors, recommendations, forecasts)


@app.get("/scan/latest", response_model=schemas.ScanRequestLatestOut)
def get_latest_scan_request(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    default_device = get_preferred_user_device(db, user.id)
    latest_request = get_latest_scan_request_record(db, user.id)

    request_device = None
    if latest_request:
        request_device = db.query(models.Device).filter(
            models.Device.id == latest_request.device_id,
            models.Device.user_id == user.id,
        ).first()

    return {
        "request": serialize_scan_request(latest_request, request_device),
        "default_device": serialize_device_brief(default_device),
    }


@app.get("/scan/pending", response_model=schemas.ScanPendingOut)
def get_pending_scan_command(
    db: Session = Depends(get_db),
    x_device_key: Optional[str] = Header(None),
):
    device = get_authenticated_device(db, x_device_key)
    pending_request = db.query(models.ScanRequest).filter(
        models.ScanRequest.user_id == device.user_id,
        models.ScanRequest.device_id == device.id,
        models.ScanRequest.status == "pending",
    ).order_by(models.ScanRequest.requested_at.asc(), models.ScanRequest.id.asc()).first()

    if not pending_request:
        return {"pending": False}

    return {
        "pending": True,
        "request_id": pending_request.id,
    }


@app.post("/scan/request", response_model=schemas.ScanRequestLatestOut)
def request_scan(
    payload: schemas.ScanRequestCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if payload.device_id is not None:
        target_device = db.query(models.Device).filter(
            models.Device.id == payload.device_id,
            models.Device.user_id == user.id,
        ).first()
    else:
        target_device = get_preferred_user_device(db, user.id)

    if not target_device:
        raise HTTPException(status_code=404, detail="No registered device is available for scanning")

    existing_pending = db.query(models.ScanRequest).filter(
        models.ScanRequest.user_id == user.id,
        models.ScanRequest.device_id == target_device.id,
        models.ScanRequest.status == "pending",
    ).order_by(models.ScanRequest.requested_at.desc(), models.ScanRequest.id.desc()).first()

    if existing_pending:
        return {
            "request": serialize_scan_request(existing_pending, target_device),
            "default_device": serialize_device_brief(target_device),
        }

    source = (payload.source or "edge_impulse").strip() or "edge_impulse"
    model_name = (payload.model_name or "Edge Impulse EfficientNet").strip() or "Edge Impulse EfficientNet"

    new_request = models.ScanRequest(
        user_id=user.id,
        device_id=target_device.id,
        status="pending",
        source=source,
        model_name=model_name,
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    return {
        "request": serialize_scan_request(new_request, target_device),
        "default_device": serialize_device_brief(target_device),
    }


@app.post("/scan/cloud", response_model=schemas.CloudScanOut)
async def run_cloud_scan(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    temperature: Optional[float] = Form(None),
    humidity: Optional[float] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Cloud scan requires an image upload")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    try:
        prediction = cloud_scan_service.run_cloud_scan_inference(image_bytes)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cloud scan failed: {exc}") from exc

    server_now = datetime.now(timezone.utc)
    internal_device_id = web_app_device_id(user.id)
    disease_type = prediction["disease_type"]
    confidence_score = prediction["confidence_score"]

    if temperature is not None and humidity is not None:
        risk_result = logic.evaluate_risk(disease_type, temperature, humidity)
        risk_level = risk_result["risk_level"]
    else:
        risk_level = "LOW RISK" if disease_type == "Healthy" else "HIGH RISK"

    detection = models.InferenceResult(
        device_id=internal_device_id,
        disease_type=disease_type,
        confidence_score=confidence_score,
        source="web_app",
        timestamp=server_now,
    )
    db.add(detection)
    db.flush()

    recommendation_payload = None
    if disease_type != "Healthy":
        recommendation_payload = logic.get_recommendation_bilingual(disease_type, risk_level)
        # We do not save manual scan recommendations to the DB here,
        # so they don't overwrite the Raspberry Pi's standing recommendations on the dashboard.

    db.commit()

    # Save training sample (image + metadata) for admin retraining workflow
    try:
        ts = models.TrainingSample(
            device_id=internal_device_id,
            disease_type=disease_type,
            confidence_score=confidence_score,
            source="web_app",
        )
        db.add(ts)
        db.flush()
        rel = _save_training_image(image_bytes, disease_type, ts.id)
        ts.image_path = rel
        db.commit()
    except Exception as _ts_err:
        print(f"[training_sample] failed to save (non-fatal): {_ts_err}")
        db.rollback()

    # Removed email alert for web scans as previously agreed

    return {
        "disease_type": disease_type,
        "confidence_score": confidence_score,
        "source": "web_app",
        "timestamp": server_now,
        "model_name": "EfficientNet Cloud Scan",
        "input_shape": prediction["input_shape"],
        "preprocessing": prediction["preprocessing"],
        "class_scores": prediction["class_scores"],
        "severity": "High" if disease_type != "Healthy" else "Low",
        "recommendation": (
            {
                "title": recommendation_payload["title_en"],
                "description": recommendation_payload["description_en"],
                "title_am": recommendation_payload["title_am"],
                "description_am": recommendation_payload["description_am"],
            }
            if recommendation_payload
            else None
        ),
    }


@app.post("/data/ingest")
async def data_ingest(
    payload: schemas.DataIngestPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_device_key: Optional[str] = Header(None)
):
    """
    Combined endpoint for ESP32 to submit all data in one call.
    Authenticates via X-Device-Key header and stores data under the
    owner's internal device scope so users only see their own device data.
    """
    try:
        result = await ingest_device_payload(
            payload,
            db=db,
            x_device_key=x_device_key,
            background_tasks=background_tasks,
        )
        owner = db.query(models.User).filter(models.User.id == result["owner_id"]).first()
        print(f"\n[INGEST DEBUG] /ingest scan processed for {result['owner_id']}")

        # Save metadata-only training sample (gateway sends no image)
        try:
            ts = models.TrainingSample(
                device_id=result["device_id"],
                disease_type=result["disease_type"],
                confidence_score=result["confidence_score"],
                source="gateway",
                image_path=None,
            )
            db.add(ts)
            db.commit()
        except Exception as _ts_err:
            print(f"[training_sample] failed to save (non-fatal): {_ts_err}")
            db.rollback()

        return {
            "status": result["status"],
            "sensor_id": result["sensor_id"],
            "detection_id": result["detection_id"],
            "context_id": result["context_id"],
            "message": result["message"],
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------------------------------------------
# Notification endpoints
# ------------------------------------------------------------------

@app.get("/notifications")
def get_notifications(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get all notifications for the current user."""
    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == user.id
    ).order_by(models.Notification.timestamp.desc()).limit(50).all()

    unread_count = db.query(models.Notification).filter(
        models.Notification.user_id == user.id,
        models.Notification.read == False
    ).count()

    return {
        "unread_count": unread_count,
        "data": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "read": n.read,
                "timestamp": n.timestamp
            } for n in notifications
        ]
    }

@app.post("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Mark a single notification as read."""
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read = True
    db.commit()
    return {"status": "ok"}

@app.post("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Mark all notifications as read for the current user."""
    db.query(models.Notification).filter(
        models.Notification.user_id == user.id,
        models.Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"status": "ok"}


# ------------------------------------------------------------------
# Device management endpoints
# ------------------------------------------------------------------

@app.post("/devices/register")
def register_device(
    payload: schemas.DeviceRegister,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Register a new device and generate an API key for the current user."""
    api_key = f"mg_{secrets.token_hex(24)}"
    new_device = models.Device(
        user_id=user.id,
        device_name=payload.device_name or "ESP32 Gateway",
        api_key=api_key
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    return {
        "id": new_device.id,
        "device_name": new_device.device_name,
        "api_key": new_device.api_key,
        "last_seen": new_device.last_seen,
        "created_at": new_device.created_at
    }


@app.get("/devices/my")
def get_my_devices(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Get all devices for the current user."""
    devices = db.query(models.Device).filter(
        models.Device.user_id == user.id
    ).order_by(models.Device.created_at.desc()).all()
    return {
        "data": [
            {
                "id": str(d.id),
                "device_name": d.device_name,
                "api_key": d.api_key,
                "last_seen": d.last_seen,
                "created_at": d.created_at
            } for d in devices
        ]
    }


@app.post("/devices/{device_id}/regenerate-key")
def regenerate_device_key(
    device_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Regenerate the API key for a device."""
    device = db.query(models.Device).filter(
        models.Device.id == device_id,
        models.Device.user_id == user.id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.api_key = f"mg_{secrets.token_hex(24)}"
    db.commit()
    db.refresh(device)
    return {
        "id": device.id,
        "device_name": device.device_name,
        "api_key": device.api_key,
        "last_seen": device.last_seen,
        "created_at": device.created_at
    }


@app.delete("/devices/{device_id}")
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    """Delete a device."""
    device = db.query(models.Device).filter(
        models.Device.id == device_id,
        models.Device.user_id == user.id
    ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"status": "ok"}


# ------------------------------------------------------------------
# Admin helpers
# ------------------------------------------------------------------


def require_admin(user: models.User = Depends(get_current_user)):
    """FastAPI dependency — 403 for any non-admin caller."""
    if user.username != DEFAULT_USERNAME:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _save_training_image(image_bytes: bytes, label: str, sample_id: int) -> str:
    """Write image to disk, return relative path string."""
    folder = TRAINING_SAMPLES_DIR / label.replace(" ", "_")
    folder.mkdir(parents=True, exist_ok=True)
    rel_path = f"{label.replace(' ', '_')}/{sample_id}.jpg"
    (TRAINING_SAMPLES_DIR / rel_path).write_bytes(image_bytes)
    return rel_path


# ------------------------------------------------------------------
# Admin — Users
# ------------------------------------------------------------------

@app.get("/admin/users")
def admin_list_users(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """List every registered user with scan counts and search."""
    query = db.query(models.User)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (models.User.username.ilike(search_term)) | 
            (models.User.email.ilike(search_term)) | 
            (models.User.display_name.ilike(search_term))
        )
    
    users = query.order_by(models.User.created_at.desc()).all()
    result = []
    for u in users:
        device_ids = get_user_scoped_device_ids(db, u.id)
        scan_count = db.query(models.InferenceResult).filter(
            models.InferenceResult.device_id.in_(device_ids)
        ).count() if device_ids else 0
        latest_scan = db.query(models.InferenceResult).filter(
            models.InferenceResult.device_id.in_(device_ids)
        ).order_by(models.InferenceResult.timestamp.desc()).first() if device_ids else None
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "display_name": u.display_name,
            "created_at": ensure_aware_datetime(u.created_at).isoformat() if u.created_at else None,
            "scan_count": scan_count,
            "last_scan_at": latest_scan.timestamp.isoformat() if latest_scan and latest_scan.timestamp else None,
        })
    return {"data": result}


@app.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    """Delete a user and cascade-remove all their data."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    device_ids_internal = get_user_scoped_device_ids(db, user_id)

    # Cascade: remove data scoped to this user's devices
    if device_ids_internal:
        db.query(models.SensorData).filter(
            models.SensorData.device_id.in_(device_ids_internal)
        ).delete(synchronize_session=False)
        db.query(models.InferenceResult).filter(
            models.InferenceResult.device_id.in_(device_ids_internal)
        ).delete(synchronize_session=False)
        db.query(models.Recommendation).filter(
            models.Recommendation.device_id.in_(device_ids_internal)
        ).delete(synchronize_session=False)
        ctx_ids = [
            c.id for c in db.query(models.ForecastContext).filter(
                models.ForecastContext.device_id.in_(device_ids_internal)
            ).all()
        ]
        if ctx_ids:
            db.query(models.ForecastData).filter(
                models.ForecastData.context_id.in_(ctx_ids)
            ).delete(synchronize_session=False)
        db.query(models.ForecastContext).filter(
            models.ForecastContext.device_id.in_(device_ids_internal)
        ).delete(synchronize_session=False)
        db.query(models.TrainingSample).filter(
            models.TrainingSample.device_id.in_(device_ids_internal)
        ).delete(synchronize_session=False)

    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete(synchronize_session=False)
    db.query(models.ScanRequest).filter(models.ScanRequest.user_id == user_id).delete(synchronize_session=False)
    db.query(models.Device).filter(models.Device.user_id == user_id).delete(synchronize_session=False)
    db.delete(target)
    db.commit()
    return {"status": "ok", "deleted_user_id": user_id}


@app.put("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Admin-only: Update any user's profile details."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.display_name is not None:
        target.display_name = payload.display_name
    if payload.email is not None:
        target.email = payload.email
    if payload.notification_emails_enabled is not None:
        target.notification_emails_enabled = payload.notification_emails_enabled
    if payload.disease_confidence_threshold is not None:
        target.disease_confidence_threshold = payload.disease_confidence_threshold
    
    db.commit()
    db.refresh(target)
    return target


# ------------------------------------------------------------------
# Admin — Devices
# ------------------------------------------------------------------

@app.get("/admin/devices")
def admin_list_devices(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """List every device across all users."""
    devices = db.query(models.Device).order_by(models.Device.created_at.desc()).all()
    users_map = {u.id: u.username for u in db.query(models.User).all()}
    return {
        "data": [
            {
                "id": d.id,
                "device_name": d.device_name,
                "api_key": d.api_key,
                "user_id": d.user_id,
                "owner_username": users_map.get(d.user_id, "unknown"),
                "last_seen": ensure_aware_datetime(d.last_seen).isoformat() if d.last_seen else None,
                "created_at": ensure_aware_datetime(d.created_at).isoformat() if d.created_at else None,
            }
            for d in devices
        ]
    }


@app.delete("/admin/devices/{device_id}")
def admin_delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"status": "ok"}

@app.post("/admin/devices")
def admin_create_device(
    payload: schemas.AdminDeviceCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Create a device and generate an API key for a specific user."""
    target_user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    api_key = f"mg_{secrets.token_hex(24)}"
    new_device = models.Device(
        user_id=payload.user_id,
        device_name=payload.device_name or "ESP32 Gateway",
        api_key=api_key
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    return {
        "id": new_device.id,
        "device_name": new_device.device_name,
        "api_key": new_device.api_key,
        "user_id": new_device.user_id,
        "last_seen": new_device.last_seen,
        "created_at": new_device.created_at
    }


@app.post("/admin/devices/{device_id}/regenerate-key")
def admin_regenerate_device_key(
    device_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    device.api_key = f"mg_{secrets.token_hex(24)}"
    db.commit()
    db.refresh(device)
    return {"id": device.id, "api_key": device.api_key}


# ------------------------------------------------------------------
# Admin — Scan History (all users)
# ------------------------------------------------------------------

@app.get("/admin/scans")
def admin_list_scans(
    page: int = 1,
    limit: int = 20,
    disease_type: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Paginated scan history across all users."""
    skip = (page - 1) * limit

    # Build user-id → username map
    users_map = {u.id: u.username for u in db.query(models.User).all()}

    # Build device_id → user_id map from Device table
    device_owner_map: dict[str, int] = {}
    for d in db.query(models.Device).all():
        device_owner_map[scoped_device_id(d)] = d.user_id
    # Also map web-app virtual ids
    for u in db.query(models.User).all():
        device_owner_map[web_app_device_id(u.id)] = u.id

    query = db.query(models.InferenceResult)
    if user_id is not None:
        target_ids = get_user_scoped_device_ids(db, user_id)
        query = query.filter(models.InferenceResult.device_id.in_(target_ids))
    if disease_type:
        query = query.filter(models.InferenceResult.disease_type == disease_type)

    total = query.count()
    detections = query.order_by(models.InferenceResult.timestamp.desc()).offset(skip).limit(limit).all()

    result = []
    for det in detections:
        sensor = db.query(models.SensorData).filter(
            models.SensorData.device_id == det.device_id,
            models.SensorData.timestamp <= det.timestamp,
        ).order_by(models.SensorData.timestamp.desc()).first()
        owner_id = device_owner_map.get(det.device_id)
        result.append({
            "id": det.id,
            "disease_type": normalize_disease_type(det.disease_type),
            "confidence_score": det.confidence_score,
            "source": normalize_detection_source(getattr(det, "source", None)),
            "timestamp": det.timestamp.isoformat() if det.timestamp else None,
            "temperature": sensor.temperature if sensor else None,
            "humidity": sensor.humidity if sensor else None,
            "owner_id": owner_id,
            "owner_username": users_map.get(owner_id, "unknown") if owner_id else "unknown",
        })
    return {
        "page": page, "limit": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit,
        "data": result,
    }


# ------------------------------------------------------------------
# Admin — Training Data
# ------------------------------------------------------------------

class _LabelUpdate(schemas.BaseModel):
    confirmed_label: Optional[str] = None


@app.get("/admin/training/samples")
def admin_list_training_samples(
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    skip = (page - 1) * limit
    total = db.query(models.TrainingSample).count()
    samples = (
        db.query(models.TrainingSample)
        .order_by(models.TrainingSample.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return {
        "page": page, "limit": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit,
        "stats": {
            "total": total,
            "with_image": db.query(models.TrainingSample).filter(models.TrainingSample.image_path.isnot(None)).count(),
            "reviewed": db.query(models.TrainingSample).filter(models.TrainingSample.reviewed == True).count(),
            "confirmed": db.query(models.TrainingSample).filter(models.TrainingSample.confirmed_label.isnot(None)).count(),
        },
        "data": [
            {
                "id": s.id,
                "disease_type": s.disease_type,
                "confirmed_label": s.confirmed_label,
                "confidence_score": s.confidence_score,
                "source": s.source,
                "has_image": s.image_path is not None,
                "reviewed": s.reviewed,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in samples
        ],
    }


@app.patch("/admin/training/samples/{sample_id}")
def admin_update_training_sample(
    sample_id: int,
    payload: _LabelUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    sample = db.query(models.TrainingSample).filter(models.TrainingSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    sample.confirmed_label = payload.confirmed_label
    sample.reviewed = payload.confirmed_label is not None
    db.commit()
    return {"status": "ok", "id": sample_id, "confirmed_label": payload.confirmed_label}


# ------------------------------------------------------------------
# Admin — Global Settings
# ------------------------------------------------------------------

@app.get("/admin/settings")
def admin_list_settings(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """List all global system settings."""
    settings = db.query(models.SystemSetting).all()
    return {"data": settings}


@app.patch("/admin/settings/{key}")
def admin_update_setting(
    key: str,
    payload: schemas.SystemSettingUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Update a specific global system setting."""
    setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    setting.value = payload.value
    db.commit()
    return {"status": "ok", "key": key, "value": setting.value}


@app.get("/admin/stats")
def admin_get_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Get system-wide statistics for the admin dashboard."""
    user_count = db.query(models.User).count()
    device_count = db.query(models.Device).count()
    scan_count = db.query(models.InferenceResult).count()
    training_samples = db.query(models.TrainingSample).count()
    
    # Simple uptime calculation
    uptime_seconds = int(time.time() - APP_STARTED_AT)
    
    return {
        "users": user_count,
        "devices": device_count,
        "scans": scan_count,
        "samples": training_samples,
        "uptime": uptime_seconds,
    }


from fastapi.responses import FileResponse

@app.get("/admin/training/samples/{sample_id}/image")
def admin_get_training_sample_image(
    sample_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    sample = db.query(models.TrainingSample).filter(models.TrainingSample.id == sample_id).first()
    if not sample or not sample.image_path:
        raise HTTPException(status_code=404, detail="Image not found")
    img_path = TRAINING_SAMPLES_DIR / sample.image_path
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Image file missing")
    return FileResponse(img_path, media_type="image/jpeg")


@app.delete("/admin/training/samples/{sample_id}")
def admin_delete_training_sample(
    sample_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    sample = db.query(models.TrainingSample).filter(models.TrainingSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.image_path:
        img_file = TRAINING_SAMPLES_DIR / sample.image_path
        if img_file.exists():
            img_file.unlink()
    db.delete(sample)
    db.commit()
    return {"status": "ok"}


from fastapi.responses import StreamingResponse

@app.get("/admin/training/export")
def admin_export_training_zip(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    """Stream a ZIP of confirmed training images structured by label folder."""
    confirmed = db.query(models.TrainingSample).filter(
        models.TrainingSample.reviewed == True,
        models.TrainingSample.confirmed_label.isnot(None),
        models.TrainingSample.image_path.isnot(None),
    ).all()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for s in confirmed:
            img_path = TRAINING_SAMPLES_DIR / s.image_path
            if img_path.exists():
                folder = s.confirmed_label.replace(" ", "_")
                zf.write(img_path, f"{folder}/{s.id}.jpg")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=training_data.zip"},
    )
