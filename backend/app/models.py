from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from .database import Base

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
