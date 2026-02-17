# Frontend Developer Guide

## Overview
The backend is a FastAPI application running on port `8000`. It exposes endpoints for fetching historical data and provides Swagger UI documentation.

## Quick Start
1. Ensure the backend is running (ask the backend dev to run `docker-compose up`).
2. API Base URL: `http://localhost:8000`

## API Documentation
The full interactive API documentation is available at:
👉 **http://localhost:8000/docs**

Use this page to `Try it out` and see the exact JSON response format.

## Key Endpoints for Frontend

### 1. Get Historical Data
- **Endpoint**: `GET /history`
- **Query Params**: `limit` (default: 100)
- **Response Format**:
```json
{
  "sensor_data": [
    {
      "id": 1,
      "device_id": "ESP32_01",
      "temperature": 25.5,
      "humidity": 60.0,
      "timestamp": "2023-10-27T10:00:00"
    }
  ],
  "inference_results": [
    {
      "id": 1,
      "device_id": "ESP32_01",
      "disease_type": "Healthy",
      "confidence_score": 0.98,
      "timestamp": "2023-10-27T10:00:00"
    }
  ]
}
```

### 2. Integration Notes
- **CORS**: CORS is enabled for all origins (`*`) for development.
- **Data Types**: 
  - `timestamp`: ISO 8601 string.
  - `disease_type`: String ("Healthy", "Anthracnose", "Powdery Mildew").
  - `confidence_score`: Float (0.0 to 1.0).

## Mocking Data
If the system is offline, you can mock the response using the JSON structure above.
