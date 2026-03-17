from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SensorDataBase(BaseModel):
    device_id: str
    temperature: float
    humidity: float
    precipitation: Optional[float] = None

class SensorDataCreate(SensorDataBase):
    pass

class SensorData(SensorDataBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class InferenceResultBase(BaseModel):
    device_id: str
    disease_type: str
    confidence_score: float

class InferenceResultCreate(InferenceResultBase):
    pass

class InferenceResult(InferenceResultBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True

class UploadPayload(BaseModel):
    device_id: str
    temperature: float
    humidity: float
    disease_type: str
    confidence_score: float

class HistoricalData(BaseModel):
    sensor_data: list[SensorData]
    inference_results: list[InferenceResult]

# New schemas for MangaGuard API

class SensorLatest(BaseModel):
    temperature: float
    humidity: float
    precipitation: Optional[float] = None
    timestamp: datetime

class RecommendationBase(BaseModel):
    title: str
    description: str
    title_am: Optional[str] = None
    description_am: Optional[str] = None

class Recommendation(RecommendationBase):
    id: int
    device_id: str
    timestamp: datetime

    class Config:
        from_attributes = True

class ForecastContextPayload(BaseModel):
    device_id: str
    season: str  # 'dry', 'wet', 'belg'
    precipitation: float

class ForecastDay(BaseModel):
    day: int  # 1-5
    risk_level: str  # 'Stable', 'High_Anthracnose_Risk', 'High_Mildew_Risk'
    date: datetime

class ForecastLatest(BaseModel):
    context: dict  # {'season': str, 'precipitation': float}
    days: list[ForecastDay]
    created_at: datetime

class DetectionLatest(BaseModel):
    disease_type: str
    confidence_score: float
    timestamp: datetime

class DetectionHistory(BaseModel):
    id: int
    disease_type: str
    confidence_score: float
    timestamp: datetime
    temperature: Optional[float]
    humidity: Optional[float]

class DataIngestPayload(BaseModel):
    device_id: str
    # Sensor data
    temperature: float
    humidity: float
    # Detection
    disease_type: str
    confidence_score: float
    # Forecast context
    season: str  # 'dry', 'wet', 'belg'
    precipitation: float
    # Recommendations (optional)
    recommendations: Optional[list[RecommendationBase]] = None
    # Forecast (5 days)
    forecast: Optional[list[dict]] = None  # [{'day': 1, 'risk_level': 'Stable'}, ...]

class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    read: bool
    timestamp: datetime

    class Config:
        from_attributes = True

class DeviceOut(BaseModel):
    id: int
    device_name: str
    api_key: str
    last_seen: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DeviceRegister(BaseModel):
    device_name: Optional[str] = "ESP32 Gateway"
