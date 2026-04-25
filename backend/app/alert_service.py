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


def check_and_send_alert(disease_class, confidence, source, timestamp):
    disease_name = normalize_disease_type(disease_class)
    confidence_value = float(confidence or 0)
    threshold = float(os.getenv("CONFIDENCE_THRESHOLD", "70")) / 100.0
    recipient = os.getenv("ALERT_EMAIL_TO")

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
    message["From"] = smtp_user
    message["To"] = recipient
    message.set_content(
        "\n".join(
            [
                "A mango disease alert was triggered.",
                "",
                f"Disease: {disease_name}",
                f"Confidence: {confidence_pct:.2f}%",
                f"Source: {source_name}",
                f"Timestamp: {timestamp_text}",
                f"Recommended treatment: {treatment}",
            ]
        )
    )

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
