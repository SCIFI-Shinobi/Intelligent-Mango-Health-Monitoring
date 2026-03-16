import os
import json
import asyncio
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from . import models, schemas, logic, database
from .database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Intelligent Plant Health Monitoring API")

# JWT config
SECRET_KEY = os.getenv("SECRET_KEY", "basey-plant-health-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Default user credentials (configure via env vars in production)
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

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    if username != DEFAULT_USERNAME or password != DEFAULT_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}


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
