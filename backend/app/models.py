from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password = Column(String)
    display_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)  # Base64 data URL or external URL
    notification_emails_enabled = Column(Boolean, default=True, nullable=False)
    disease_confidence_threshold = Column(Integer, default=70, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    title = Column(String)
    message = Column(String)
    type = Column(String)  # 'disease_alert', 'sensor_warning', 'recommendation', 'system', 'forecast_alert'
    read = Column(Boolean, default=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class SensorData(Base):
    __tablename__ = "sensor_data"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    temperature = Column(Float)
    humidity = Column(Float)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class InferenceResult(Base):
    __tablename__ = "inference_results"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    disease_type = Column(String)  # 'Healthy', 'Anthracnose', 'Powdery Mildew'
    confidence_score = Column(Float)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    title = Column(String)
    description = Column(String)
    title_am = Column(String, nullable=True)
    description_am = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class ForecastContext(Base):
    __tablename__ = "forecast_contexts"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class ForecastData(Base):
    __tablename__ = "forecast_data"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, index=True)
    day_index = Column(Integer)  # 0-4 for Day 1-5
    risk_level = Column(String)  # 'Stable', 'High_Anthracnose_Risk', 'High_Mildew_Risk'
    forecast_date = Column(DateTime(timezone=True))
    context_id = Column(Integer, ForeignKey("forecast_contexts.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    device_name = Column(String, default="ESP32 Gateway")
    api_key = Column(String, unique=True, index=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
