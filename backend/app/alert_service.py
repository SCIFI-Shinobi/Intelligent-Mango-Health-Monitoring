from __future__ import annotations

import os
import smtplib
import traceback
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Union

from . import logic
from .disease_labels import normalize_disease_type


TimestampLike = Union[str, datetime]


def _normalize_source(source: str) -> str:
    normalized = (source or "").strip().lower()
    if normalized in {"edge", "edge_impulse", "device"}:
        return "edge"
    return "cloud"


def _format_timestamp(timestamp: TimestampLike) -> str:
    if isinstance(timestamp, datetime):
        normalized = timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
        return normalized.isoformat()
    return str(timestamp)


def _build_treatment(disease_class: str) -> str:
    recommendation = logic.get_recommendation_bilingual(disease_class, "HIGH RISK")
    return recommendation["description_en"]


def check_and_send_alert(disease_class, confidence, source, timestamp, confidence_threshold_pct: float | None = None, recipient_email: str | None = None):
    print(f"\n{'='*60}")
    print(f"[EMAIL DEBUG] check_and_send_alert CALLED")
    print(f"  disease_class  = {disease_class!r}")
    print(f"  confidence     = {confidence!r}")
    print(f"  source         = {source!r}")
    print(f"  timestamp      = {timestamp!r}")
    print(f"  threshold_pct  = {confidence_threshold_pct!r}")
    print(f"  recipient_email= {recipient_email!r}")
    print(f"{'='*60}")

    disease_name = normalize_disease_type(disease_class)
    confidence_value = float(confidence or 0)
    print(f"[EMAIL DEBUG] Normalized disease: {disease_name!r}, confidence_value: {confidence_value}")

    # Prefer caller-supplied per-user threshold; fall back to env var, then 70 %
    if confidence_threshold_pct is not None:
        threshold = float(confidence_threshold_pct) / 100.0
    else:
        threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "70")) / 100.0
    print(f"[EMAIL DEBUG] Threshold: {threshold} (from {'arg' if confidence_threshold_pct is not None else 'env/default'})")

    recipient = recipient_email or os.getenv("ALERT_EMAIL_TO")
    print(f"[EMAIL DEBUG] Final recipient: {recipient!r}")

    # --- Gate checks ---
    if not recipient:
        print(f"[EMAIL SKIPPED] No recipient email available.")
        return False

    if disease_name == "Healthy":
        print(f"[EMAIL SKIPPED] Disease is 'Healthy' — no alert needed.")
        return False

    if confidence_value < threshold:
        print(f"[EMAIL SKIPPED] Confidence {confidence_value:.4f} < threshold {threshold:.4f}")
        return False

    print(f"[EMAIL DEBUG] All gate checks passed. Proceeding to SMTP...")

    resend_api_key = os.getenv("RESEND_API_KEY")
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    source_name = _normalize_source(source)
    timestamp_text = _format_timestamp(timestamp)
    treatment = _build_treatment(disease_name)
    confidence_pct = confidence_value * 100

    text_content = f"""A mango disease alert was triggered.
Disease: {disease_name}
Confidence: {confidence_pct:.2f}%
Source: {source_name}
Timestamp: {timestamp_text}
Recommended treatment: {treatment}"""

    html_content = f"""
    <html>
      <body style="font-family: 'Inter', Arial, sans-serif; background-color: #f4f7f6; color: #333; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
          <div style="background-color: #2e7d32; padding: 25px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">MangoGuard Alert</h1>
          </div>
          <div style="padding: 30px;">
            <p style="font-size: 16px; line-height: 1.6; color: #555;">
              Hello, a new health scan has triggered an alert based on your confidence threshold settings.
            </p>
            <div style="background-color: #fdf2f2; border-left: 4px solid #d32f2f; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <h2 style="color: #d32f2f; margin: 0 0 10px 0; font-size: 20px;">{disease_name} Detected</h2>
              <p style="margin: 0; font-size: 16px;"><strong>Confidence:</strong> {confidence_pct:.2f}%</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Scan Source:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">{source_name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Time of Scan:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">{timestamp_text}</td>
              </tr>
            </table>
            <h3 style="color: #2e7d32; font-size: 18px; margin-top: 25px;">Recommended Treatment:</h3>
            <p style="background-color: #f1f8e9; padding: 15px; border-radius: 8px; font-size: 15px; line-height: 1.6;">
              {treatment}
            </p>
          </div>
          <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0;">You received this because you enabled push notifications in MangoGuard settings.</p>
          </div>
        </div>
      </body>
    </html>
    """

    if resend_api_key:
        print(f"[EMAIL DEBUG] Sending via Resend API...")
        try:
            import resend
            resend.api_key = resend_api_key
            sender_email = smtp_user or "onboarding@resend.dev"
            response = resend.Emails.send({
                "from": f"MangoGuard <{sender_email}>",
                "to": recipient,
                "subject": f"Mango Disease Alert: {disease_name}",
                "html": html_content,
                "text": text_content
            })
            print(f"[EMAIL SUCCESS] Disease alert sent to {recipient} via Resend | Disease: {disease_name}")
            return True
        except Exception as e:
            print(f"[EMAIL ERROR] Resend error: {e}")
            traceback.print_exc()
            return False

    print(f"[EMAIL DEBUG] SMTP config:")
    print(f"  SMTP_HOST     = {smtp_host!r}")
    print(f"  SMTP_PORT     = {smtp_port}")
    print(f"  SMTP_USER     = {smtp_user!r}")
    print(f"  SMTP_PASSWORD = {'***SET***' if smtp_password else 'NOT SET'}")

    if not smtp_host or not smtp_user or not smtp_password:
        missing = []
        if not smtp_host: missing.append("SMTP_HOST")
        if not smtp_user: missing.append("SMTP_USERNAME")
        if not smtp_password: missing.append("SMTP_PASSWORD")
        print(f"[EMAIL SKIPPED] SMTP not configured. Missing: {', '.join(missing)}")
        return False

    message = EmailMessage()
    message["Subject"] = f"Mango Disease Alert: {disease_name}"
    message["From"] = f"MangoGuard <{smtp_user}>"
    message["To"] = recipient
    message.set_content(text_content)
    message.add_alternative(html_content, subtype='html')

    try:
        if smtp_port == 465:
            print(f"[EMAIL DEBUG] Using SMTP_SSL on port 465...")
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(message)
            print(f"[EMAIL SUCCESS] Disease alert sent to {recipient} | Disease: {disease_name} (SSL)")
            return True

        print(f"[EMAIL DEBUG] Using SMTP + STARTTLS on port {smtp_port}...")
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.send_message(message)

        print(f"[EMAIL SUCCESS] Disease alert sent to {recipient} | Disease: {disease_name}")
        return True

    except smtplib.SMTPAuthenticationError as e:
        print(f"[EMAIL ERROR] SMTP Authentication failed: {e}")
        print(f"[EMAIL ERROR] Check SMTP_USERNAME and SMTP_PASSWORD env vars.")
        traceback.print_exc()
        return False
    except smtplib.SMTPRecipientsRefused as e:
        print(f"[EMAIL ERROR] Recipient refused: {e}")
        traceback.print_exc()
        return False
    except smtplib.SMTPException as e:
        print(f"[EMAIL ERROR] SMTP error: {e}")
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"[EMAIL ERROR] Unexpected error sending email: {type(e).__name__}: {e}")
        traceback.print_exc()
        return False
