# Intelligent Plant Health Monitoring

### *Edge AI for Resilient Agriculture in Ethiopia*

<p align="center">
  <img src="https://img.shields.io/badge/TinyML-Edge%20Impulse-6A32C9?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Hardware-Arduino%20Nano%2033-00979D?style=for-the-badge&logo=arduino&logoColor=white" />
  <img src="https://img.shields.io/badge/Gateway-ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
</p>

---

**Intelligent Plant Health Monitoring** is an end-to-end TinyML solution designed for low-connectivity mango farms. By combining localized computer vision with environmental forecasting, it provides smallholder farmers with **real-time diagnostics** and **outbreak risk prediction** entirely at the edge.

## ✨ Key Capabilities

### 🧠 Edge-Native Diagnostics

- **On-device inference**: runs a quantized **MobileNetV1** model directly on the Arduino Nano 33 BLE Sense.
- **Localized dataset**: trained on **5,210 high-resolution images** from the *Woramit Horticultural Research Center* in Ethiopia.
- **Disease detection**: specialized in identifying **Anthracnose** and **Powdery Mildew** with a compact 160x160 input pipeline.

### 📡 Dual-Microcontroller Architecture

- **The brain (Arduino)**: handles sensor fusion and ML inference.
- **The bridge (ESP32)**: manages the **BLE-to-Wi-Fi** handoff, local recommendation logic, and periodic cloud sync.
- **Hybrid connectivity**: operates in offline mode during outages and syncs when a gateway connection is restored.

### 🌡️ Environmental Forecasting

- **Micro-climate tracking** with DHT22 sensors for temperature and humidity.
- **Risk scoring** to flag high-risk periods for fungal outbreaks.

### 🎨 Decision Support & UI

- **Instant feedback**
  - 🟢 `HEALTHY`: no action needed.
  - 🟡 `WARNING`: preventive care recommended.
  - 🔴 `INFECTED`: immediate isolation and treatment required.
- **Visual indicators** via OLED display and buzzer alerts for field use.

---

## 🛠️ Hardware & Model Specs

| Component | Role | Notes |
| --- | --- | --- |
| **Arduino Nano 33 BLE Sense** | Inference engine | Runs quantized MobileNetV1 |
| **ESP32** | Communication gateway | BLE + Wi-Fi bridge |
| **MobileNetV1** | Vision model | 8-bit quantized, 86.45% accuracy |
| **DHT22** | Weather sensor | Temperature and humidity tracking |
| **OLED + Buzzer** | Local feedback | Visual and audible alerts |

## 🚀 Getting Started

### 📂 Repository Structure

```bash
├── firmware/
│   ├── nano33ble_edge_ai/    # MobileNetV1 inference & camera drivers
│   └── esp32_gateway/        # BLE logic & Wi-Fi backhaul
├── backend/                  # FastAPI data ingestion (placeholder)
├── frontend/                 # React analytics dashboard (placeholder)
```

### 🛠️ Build & Flash

1. Open the firmware folder in **PlatformIO**.
2. Select your environment: `env:nano33ble` or `env:esp32`.
3. Build and upload:

```bash
pio run --target upload
```

---

## 📊 System Architecture

1. **Sensing layer**: captures image + DHT22 data.
2. **Detection layer**: runs TinyML inference on Arduino.
3. **Gateway layer**: ESP32 runs recommendation logic and syncs to FastAPI.
4. **Visualization layer**: React dashboard shows diagnostics and trends.

---

*Developed to bridge the gap between AI and smallholder agriculture.*

