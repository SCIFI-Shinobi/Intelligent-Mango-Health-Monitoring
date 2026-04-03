# Raspberry Pi Plant Health Gateway - Installation & Setup Guide

## Installation Steps

### 1. Prerequisites
- Raspberry Pi 4/5 or Pi Zero 2W with Raspberry Pi OS installed
- Python 3.9+
- Git installed
- Serial connection to Nano 33 BLE (UART)
- DHT22 temperature/humidity sensor
- Optional: I2C 16x2 LCD display (PCF8574 backpack, common address 0x27)

### 2. Install Dependencies
```bash
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install python3-pip python3-venv git raspi-config

# For I2C/DHT sensor support
sudo apt-get install python3-rpi.gpio python3-board libc6

pip3 install -r requirements.txt
```

### 3. Configure Raspberry Pi
```bash
# Enable I2C interface
sudo raspi-config
# Navigate to: Interfacing Options > I2C > Enable

# Enable UART (if using GPIO serial)
# Navigate to: Interfacing Options > Serial > Enable
```

### 4. Setup Service File
```bash
# Copy service file
sudo cp systemd/plant-health-gateway.service /etc/systemd/system/

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable plant-health-gateway
sudo systemctl start plant-health-gateway

# Check status
sudo systemctl status plant-health-gateway

# View logs
journalctl -u plant-health-gateway -f
```

### 5. Configuration
Edit `config/config.py`:
- Set `API_BASE_URL` to your backend server
- Configure `SERIAL_PORT` (default: /dev/ttyUSB0)
- Adjust sensor pins if needed
- Set WiFi credentials (if applicable)

### 6. Wiring (GPIO BCM)
- DHT22: Pin 4 (GPIO 4)
- Rain Sensor: Pin 27 (GPIO 27)
- Buzzer: Pin 17 (GPIO 17)
- Status LED: Pin 22 (GPIO 22)
- UART RX: Pin 10 (GPIO 10) - ttyAMA0
- UART TX: Pin 8 (GPIO 8) - ttyAMA0

### 7. Manual Testing
```bash
cd /home/pi/plant_health_gateway
python3 src/main.py
```

## Troubleshooting

### Serial Port Not Found
```bash
# List available serial ports
ls /dev/tty*

# Check device permissions
ls -l /dev/ttyUSB0
sudo usermod -a -G dialout pi
# Logout and login for changes to take effect
```

### DHT Sensor Not Reading
```bash
# Test with RPi.GPIO
python3 -c "import board, adafruit_dht; d=adafruit_dht.DHT22(board.D4); print(d.temperature)"
```

### API Connection Issues
```bash
# Test backend connectivity
curl -X POST http://your-backend-api.com/api/sensor-data
```

## Running in Mock Mode (No Hardware)
```bash
DEBUG=true MOCK_SENSORS=true python3 src/main.py
```

## Performance Optimization
The service uses:
- Memory limit: 512MB
- CPU quota: 80%
- Restarts automatically if crashed
- Logs to journalctl
