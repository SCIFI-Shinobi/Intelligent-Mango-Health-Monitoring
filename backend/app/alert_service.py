from __future__ import annotations

import os
import smtplib
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
    disease_name = normalize_disease_type(disease_class)
    confidence_value = float(confidence or 0)

    # Prefer caller-supplied per-user threshold; fall back to env var, then 70 %
    if confidence_threshold_pct is not None:
        threshold = float(confidence_threshold_pct) / 100.0
    else:
        threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "70")) / 100.0

    recipient = recipient_email or os.getenv("ALERT_EMAIL_TO")

    if not recipient or disease_name == "Healthy" or confidence_value < threshold:
        return False

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    if not smtp_host or not smtp_user or not smtp_password:
        return False

    source_name = _normalize_source(source)
    timestamp_text = _format_timestamp(timestamp)
    treatment = _build_treatment(disease_name)
    confidence_pct = confidence_value * 100

    message = EmailMessage()
    message["Subject"] = f"Mango Disease Alert: {disease_name}"
    message["From"] = f"MangoGuard <{smtp_user}>"
    message["To"] = recipient
    
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

    message.set_content(text_content)
    message.add_alternative(html_content, subtype='html')

    if smtp_port == 465:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(message)
        return True

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_password)
        server.send_message(message)
    return True
