# Intelligent Plant Health Monitoring Using Embedded AI

An intelligent plant health monitoring system for mango farming in Ethiopia. It combines TinyML and IoT to deliver real-time, offline disease diagnosis and environmental forecasting, supporting smallholder farmers against threats like Anthracnose and Powdery Mildew without constant connectivity.

## Quick Snapshot

| Focus | Details |
| --- | --- |
| Use case | Mango disease detection and forecasting in low-connectivity regions |
| Edge AI | MobileNetV1 TinyML on Arduino Nano 33 BLE Sense |
| Connectivity | ESP32 gateway with BLE and Wi-Fi |
| Sensors | DHT22 for temperature and humidity |
| Outputs | Local alerts + optional cloud dashboard |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Firmware | PlatformIO (C/C++) |
| Backend | FastAPI (Python) |
| Frontend | React |

## Highlights

- Real-time, on-device disease detection using a quantized MobileNetV1 model.
- Dual-microcontroller design: Arduino for inference, ESP32 for networking and coordination.
- Environmental monitoring to support outbreak risk forecasting.
- Decision-support recommendations plus centralized dashboard visibility.

## System Overview

```
Leaf image + DHT22 data
        |
        v
Arduino Nano 33 BLE Sense
  - TinyML inference
  - Local classification
        |
        v (BLE)
ESP32 Gateway
  - Recommendation logic
  - Wi-Fi/BLE bridge
        |
        v
Cloud + Web Dashboard
```

## Key Features

- Edge-side inference: real-time disease detection on Arduino Nano 33 BLE Sense using optimized MobileNetV1 models.
- Dual-microcontroller architecture: Arduino for processing and ESP32 as the communication gateway.
- Environmental monitoring: DHT22 sensors for temperature and humidity.
- Disease forecasting: predicts high-risk periods for outbreaks using environmental trends.
- Decision-support module: actionable treatment and prevention recommendations.
- Web dashboard: centralized interface for real-time health data, historical trends, and alerts.

## Hardware Stack

| Component | Role |
| --- | --- |
| Arduino Nano 33 BLE Sense | Primary engine for TinyML model inference |
| ESP32 | System-level tasks, BLE/Wi-Fi communication, and output peripherals |
| DHT22 | Temperature and humidity measurements |
| OLED display and buzzer | Immediate visual and audible feedback |

## Model and Optimization

The system uses a quantized MobileNetV1 model optimized through the Edge Impulse EON Compiler.

| Item | Details |
| --- | --- |
| Input size | 160x160 pixels |
| Optimization | Post-training quantization (32-bit weights to 8-bit integers) |
| Performance | 86.45% accuracy within the 256KB RAM limit of the Arduino Nano |
| Dataset | 5,210 localized images of Ethiopian mango varieties collected from the Woramit Horticultural Research and Training Sub-Center |

## System Architecture

- Sensing and detection layer: Arduino captures leaf images and sensor data for local classification.
- Processing and gateway layer: ESP32 receives results via BLE, runs recommendation logic, and forwards data to the cloud.
- Visualization layer: web dashboard displays diagnostics and forecasts.

## Repository Layout

```
backend/                     Backend services (placeholder)
firmware/
  esp32_gateway/             ESP32 PlatformIO project
  nano33ble_edge_ai/         Arduino Nano 33 BLE Sense PlatformIO project
frontend/                    Web dashboard (placeholder)
```

## Status

- Firmware is implemented in the PlatformIO projects under firmware/.
- Backend will use FastAPI, and frontend will use React. These folders are placeholders until their code is added.

