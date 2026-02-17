from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SensorDataBase(BaseModel):
    device_id: str
    temperature: float
    humidity: float

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
