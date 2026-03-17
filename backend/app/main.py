import os
import json
import asyncio
from datetime import datetime, timedelta
from passlib.context import CryptContext

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from . import models, schemas, logic, database
from .database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Intelligent Plant Health Monitoring API")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT config
SECRET_KEY = os.getenv("SECRET_KEY", "mangoguard-plant-health-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Default user credentials (for backward compatibility)
DEFAULT_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Active WebSocket connections ---
connected_clients: list[WebSocket] = []


async def broadcast_to_clients(message: dict):
    """Send a message to all connected WebSocket clients."""
    dead = []
    for ws in connected_clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connected_clients.remove(ws)


def build_dashboard_payload(sensor, inference, db: Session) -> dict:
    """Build the JSON payload the frontend Dashboard expects."""
    risk = logic.evaluate_risk(inference.disease_type, sensor.temperature, sensor.humidity)
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

    recommendations = []
    if risk["recommendation"]:
        recommendations.append({
            "title": risk["risk_level"],
            "desc": risk["recommendation"]
        })
    if forecast_alert and "High Risk" in forecast_alert:
        recommendations.append({
            "title": "Forecast Alert",
            "desc": forecast_alert
        })
    if inference.disease_type != "Healthy":
        recommendations.append({
            "title": f"{inference.disease_type} Detected",
            "desc": logic.get_recommendation(inference.disease_type)
        })

    return {
        "temperature": sensor.temperature,
        "humidity": sensor.humidity,
        "moisture": round(sensor.humidity * 0.85, 1),  # derived estimate
        "health": health,
        "stability": stability,
        "disease_type": inference.disease_type,
        "confidence_score": inference.confidence_score,
        "risk_level": risk["risk_level"],
        "recommendations": recommendations,
    }


# ------------------------------------------------------------------
# Auth endpoint
# ------------------------------------------------------------------

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)):
    """Extract user from JWT Bearer token."""
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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
# WebSocket endpoint  —  streams latest data to the frontend
# ------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        # Send current state immediately on connect
        db = database.SessionLocal()
        try:
            sensor = db.query(models.SensorData).order_by(models.SensorData.timestamp.desc()).first()
            inference = db.query(models.InferenceResult).order_by(models.InferenceResult.timestamp.desc()).first()
            if sensor and inference:
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
        if websocket in connected_clients:
            connected_clients.remove(websocket)


# ------------------------------------------------------------------
# Run Scan  —  fetches latest data and returns + broadcasts it
# ------------------------------------------------------------------

@app.post("/run-scan")
async def run_scan():
    db = database.SessionLocal()
    try:
        sensor = db.query(models.SensorData).order_by(models.SensorData.timestamp.desc()).first()
        inference = db.query(models.InferenceResult).order_by(models.InferenceResult.timestamp.desc()).first()
        if not sensor or not inference:
            return {"status": "no_data", "message": "No sensor data available yet."}
        payload = build_dashboard_payload(sensor, inference, db)
        # Broadcast to all connected WebSocket clients
        await broadcast_to_clients(payload)
        return {"status": "success", **payload}
    finally:
        db.close()


# ------------------------------------------------------------------
# Existing endpoints
# ------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"message": "Welcome to the Intelligent Plant Health Monitoring API"}


@app.post("/upload", response_model=dict)
async def upload_data(payload: schemas.UploadPayload, db: Session = Depends(get_db)):
    # Create Sensor Data record
    new_sensor_data = models.SensorData(
        device_id=payload.device_id,
        temperature=payload.temperature,
        humidity=payload.humidity
    )
    db.add(new_sensor_data)

    # Create Inference Result record
    new_inference = models.InferenceResult(
        device_id=payload.device_id,
        disease_type=payload.disease_type,
        confidence_score=payload.confidence_score
    )
    db.add(new_inference)

    db.commit()
    db.refresh(new_sensor_data)
    db.refresh(new_inference)

    # Evaluate risk
    risk = logic.evaluate_risk(payload.disease_type, payload.temperature, payload.humidity)
    forecast_alert = logic.get_forecast_alert(payload.temperature, payload.humidity)

    # Broadcast to all connected dashboard clients
    dashboard_payload = build_dashboard_payload(new_sensor_data, new_inference, db)
    await broadcast_to_clients(dashboard_payload)

    return {
        "status": "success",
        "data_id": new_sensor_data.id,
        "inference_id": new_inference.id,
        "risk_level": risk["risk_level"],
        "recommendation": risk["recommendation"],
        "forecast_alert": forecast_alert
    }


@app.get("/history", response_model=schemas.HistoricalData)
def get_history(db: Session = Depends(get_db), limit: int = 100):
    sensor_data = db.query(models.SensorData).order_by(models.SensorData.timestamp.desc()).limit(limit).all()
    inference_results = db.query(models.InferenceResult).order_by(models.InferenceResult.timestamp.desc()).limit(limit).all()

    return {
        "sensor_data": sensor_data,
        "inference_results": inference_results
    }


# ------------------------------------------------------------------
# NEW MangaGuard API Endpoints
# ------------------------------------------------------------------

@app.get("/sensors/latest", response_model=schemas.SensorLatest)
def get_sensors_latest(db: Session = Depends(get_db)):
    """Get the latest sensor reading (temperature and humidity)."""
    sensor = db.query(models.SensorData).order_by(models.SensorData.timestamp.desc()).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="No sensor data available")
    return {
        "temperature": sensor.temperature,
        "humidity": sensor.humidity,
        "precipitation": sensor.precipitation,
        "timestamp": sensor.timestamp
    }


@app.get("/sensors/history")
def get_sensors_history(range: str = "24h", db: Session = Depends(get_db)):
    """
    Get sensor history for a specified time range.
    range: '24h', '7d', or '30d'
    """
    now = datetime.utcnow()

    if range == "24h":
        start_time = now - timedelta(hours=24)
    elif range == "7d":
        start_time = now - timedelta(days=7)
    elif range == "30d":
        start_time = now - timedelta(days=30)
    else:
        start_time = now - timedelta(hours=24)  # default to 24h

    data = db.query(models.SensorData).filter(
        models.SensorData.timestamp >= start_time
    ).order_by(models.SensorData.timestamp.asc()).all()

    return {
        "range": range,
        "data": [
            {
                "temperature": d.temperature,
                "humidity": d.humidity,
                "precipitation": d.precipitation,
                "timestamp": d.timestamp
            } for d in data
        ]
    }


@app.get("/detection/latest", response_model=schemas.DetectionLatest)
def get_detection_latest(db: Session = Depends(get_db)):
    """Get the latest disease detection result."""
    detection = db.query(models.InferenceResult).order_by(models.InferenceResult.timestamp.desc()).first()
    if not detection:
        raise HTTPException(status_code=404, detail="No detection data available")

    return {
        "disease_type": detection.disease_type,
        "confidence_score": detection.confidence_score,
        "timestamp": detection.timestamp
    }


@app.get("/detection/history")
def get_detection_history(page: int = 1, limit: int = 10, db: Session = Depends(get_db)):
    """
    Get paginated detection history with sensor readings at time of detection.
    """
    skip = (page - 1) * limit

    detections = db.query(models.InferenceResult).order_by(
        models.InferenceResult.timestamp.desc()
    ).offset(skip).limit(limit).all()

    total = db.query(models.InferenceResult).count()

    result = []
    for detection in detections:
        # Find the most recent sensor data at or before detection time
        sensor = db.query(models.SensorData).filter(
            models.SensorData.timestamp <= detection.timestamp
        ).order_by(models.SensorData.timestamp.desc()).first()

        # Fallback: get nearest sensor reading if none before
        if not sensor:
            sensor = db.query(models.SensorData).order_by(models.SensorData.timestamp.asc()).first()

        result.append({
            "id": detection.id,
            "disease_type": detection.disease_type,
            "confidence_score": detection.confidence_score,
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
def get_forecast_latest(db: Session = Depends(get_db)):
    """
    Get the latest 5-day forecast with context (season, precipitation).
    """
    # Get the most recent forecast context
    context = db.query(models.ForecastContext).order_by(
        models.ForecastContext.timestamp.desc()
    ).first()

    if not context:
        raise HTTPException(status_code=404, detail="No forecast data available")

    # Get forecast data for this context
    forecasts = db.query(models.ForecastData).filter(
        models.ForecastData.context_id == context.id
    ).order_by(models.ForecastData.day_index.asc()).all()

    return {
        "context": {
            "season": context.season,
            "precipitation": context.precipitation,
            "timestamp": context.timestamp
        },
        "days": [
            {
                "day": (f.day_index + 1),
                "risk_level": f.risk_level,
                "date": f.forecast_date
            } for f in forecasts
        ],
        "created_at": context.timestamp
    }


@app.post("/forecast/context")
def post_forecast_context(payload: schemas.ForecastContextPayload, db: Session = Depends(get_db)):
    """
    Accept season and precipitation from ESP32 for forecast model input.
    """
    new_context = models.ForecastContext(
        device_id=payload.device_id,
        season=payload.season,
        precipitation=payload.precipitation
    )
    db.add(new_context)
    db.commit()
    db.refresh(new_context)

    return {
        "status": "success",
        "context_id": new_context.id,
        "message": f"Forecast context recorded: {payload.season} season, {payload.precipitation}mm precipitation"
    }


@app.get("/recommendations/latest")
def get_recommendations_latest(db: Session = Depends(get_db), limit: int = 5):
    """
    Get the latest recommendations.
    """
    recommendations = db.query(models.Recommendation).order_by(
        models.Recommendation.timestamp.desc()
    ).limit(limit).all()

    return {
        "data": [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "title_am": r.title_am,
                "description_am": r.description_am,
                "timestamp": r.timestamp
            } for r in recommendations
        ]
    }


@app.post("/data/ingest")
async def data_ingest(payload: schemas.DataIngestPayload, db: Session = Depends(get_db)):
    """
    Combined endpoint for ESP32 to submit all data in one call:
    - Sensor data (temperature, humidity)
    - Disease detection result
    - Forecast context (season, precipitation)
    - Recommendations (optional)
    - Forecast data (optional)
    """
    try:
        # 1. Store sensor data
        new_sensor = models.SensorData(
            device_id=payload.device_id,
            temperature=payload.temperature,
            humidity=payload.humidity,
            precipitation=payload.precipitation
        )
        db.add(new_sensor)

        # 2. Store detection result
        new_detection = models.InferenceResult(
            device_id=payload.device_id,
            disease_type=payload.disease_type,
            confidence_score=payload.confidence_score
        )
        db.add(new_detection)

        # 3. Store forecast context
        new_context = models.ForecastContext(
            device_id=payload.device_id,
            season=payload.season,
            precipitation=payload.precipitation
        )
        db.add(new_context)

        db.commit()
        db.refresh(new_sensor)
        db.refresh(new_detection)
        db.refresh(new_context)

        # 4. Store recommendations if provided
        if payload.recommendations:
            for rec in payload.recommendations:
                new_rec = models.Recommendation(
                    device_id=payload.device_id,
                    title=rec.title,
                    description=rec.description
                )
                db.add(new_rec)
            db.commit()

        # 5. Store forecast data if provided
        if payload.forecast:
            for i, day_forecast in enumerate(payload.forecast):
                forecast_date = datetime.utcnow() + timedelta(days=i+1)
                new_forecast = models.ForecastData(
                    device_id=payload.device_id,
                    day_index=i,
                    risk_level=day_forecast.get("risk_level", "Stable"),
                    forecast_date=forecast_date,
                    context_id=new_context.id
                )
                db.add(new_forecast)
            db.commit()

        # Build response payload and broadcast to WebSocket clients
        dashboard_payload = {
            "temperature": payload.temperature,
            "humidity": payload.humidity,
            "disease_type": payload.disease_type,
            "confidence_score": payload.confidence_score,
            "season": payload.season,
            "precipitation": payload.precipitation,
            "timestamp": datetime.utcnow().isoformat()
        }

        await broadcast_to_clients(dashboard_payload)

        # 6. Auto-generate notifications for all users
        users = db.query(models.User).all()
        for user in users:
            # Disease alert
            if payload.disease_type != "Healthy":
                db.add(models.Notification(
                    user_id=user.id,
                    title=f"{payload.disease_type} Detected",
                    message=f"{payload.disease_type} detected with {payload.confidence_score*100:.1f}% confidence. Check your mango plants.",
                    type="disease_alert"
                ))
            # High temperature warning
            if payload.temperature > 35:
                db.add(models.Notification(
                    user_id=user.id,
                    title="High Temperature Alert",
                    message=f"Temperature reached {payload.temperature}°C. This may stress your plants.",
                    type="sensor_warning"
                ))
            # High humidity warning
            if payload.humidity > 90:
                db.add(models.Notification(
                    user_id=user.id,
                    title="High Humidity Alert",
                    message=f"Humidity at {payload.humidity}%. High humidity increases fungal disease risk.",
                    type="sensor_warning"
                ))
        db.commit()

        return {
            "status": "success",
            "sensor_id": new_sensor.id,
            "detection_id": new_detection.id,
            "context_id": new_context.id,
            "message": "Data ingested successfully"
        }

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
