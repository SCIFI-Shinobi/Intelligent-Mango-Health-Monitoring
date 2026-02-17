from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, logic, database
from .database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Intelligent Plant Health Monitoring API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Intelligent Plant Health Monitoring API"}

@app.post("/upload", response_model=dict)
def upload_data(payload: schemas.UploadPayload, db: Session = Depends(get_db)):
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
    
    # Generate response with recommendation and foresting
    recommendation = logic.get_recommendation(payload.disease_type)
    alert = logic.get_forecast_alert(payload.temperature, payload.humidity)
    
    return {
        "status": "success",
        "data_id": new_sensor_data.id,
        "inference_id": new_inference.id,
        "recommendation": recommendation,
        "forecast_alert": alert
    }

@app.get("/history", response_model=schemas.HistoricalData)
def get_history(db: Session = Depends(get_db), limit: int = 100):
    sensor_data = db.query(models.SensorData).order_by(models.SensorData.timestamp.desc()).limit(limit).all()
    inference_results = db.query(models.InferenceResult).order_by(models.InferenceResult.timestamp.desc()).limit(limit).all()
    
    return {
        "sensor_data": sensor_data,
        "inference_results": inference_results
    }
