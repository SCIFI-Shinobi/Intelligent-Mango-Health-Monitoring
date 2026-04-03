#!/usr/bin/env python3
"""
Raspberry Pi Plant Health Gateway
Receives classification data from Nano 33 BLE via UART
Collects environmental sensors and forwards alerts/data to backend
"""

import serial
import json
import logging
import time
import threading
import requests
from datetime import datetime, timedelta
from collections import deque
import sys
import os

# Add config to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'config'))
import config

try:
    import board
    import digitalio
    import adafruit_dht
    RPI_GPIO_AVAILABLE = True
except ImportError:
    RPI_GPIO_AVAILABLE = False
    print("Warning: RPi GPIO libraries not available. Running in mock mode.")

# ================= LOGGING SETUP =================
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(config.LOG_FILE) if os.access(os.path.dirname(config.LOG_FILE), os.W_OK) else logging.NullHandler()
    ]
)
logger = logging.getLogger(__name__)

# ================= HARDWARE CLASSES =================
class SensorManager:
    """Manages DHT22 sensor readings"""
    def __init__(self):
        self.temperature = None
        self.humidity = None
        self.last_read = None
        
        if RPI_GPIO_AVAILABLE and not config.MOCK_SENSORS:
            try:
                dht_device = adafruit_dht.DHT22(board.D4)
                self.dht_device = dht_device
                logger.info("DHT22 sensor initialized")
            except Exception as e:
                logger.error(f"Failed to initialize DHT22: {e}")
                self.dht_device = None
        else:
            self.dht_device = None
            logger.info("DHT sensor in mock mode")
    
    def read(self):
        """Read temperature and humidity"""
        try:
            if self.dht_device and not config.MOCK_SENSORS:
                self.temperature = self.dht_device.temperature
                self.humidity = self.dht_device.humidity
            else:
                # Mock data for testing
                self.temperature = 25.5 + (datetime.now().second % 10) * 0.1
                self.humidity = 65.0 + (datetime.now().second % 20) * 0.5
            
            self.last_read = datetime.now()
            logger.debug(f"Sensor read - Temp: {self.temperature}°C, Humidity: {self.humidity}%")
            return True
        except Exception as e:
            logger.error(f"Sensor read error: {e}")
            return False

class RainSensor:
    """Manages rain sensor"""
    def __init__(self):
        self.is_raining = False
        self.intensity = 0
        
        if RPI_GPIO_AVAILABLE and not config.MOCK_SENSORS:
            try:
                self.pin = digitalio.DigitalInOut(board.D27)
                self.pin.direction = digitalio.Direction.INPUT
                logger.info("Rain sensor initialized")
            except Exception as e:
                logger.warning(f"Rain sensor initialization failed: {e}")
                self.pin = None
        else:
            self.pin = None
    
    def read(self):
        """Read rain sensor status"""
        try:
            if self.pin and not config.MOCK_SENSORS:
                self.is_raining = not self.pin.value  # Inverted logic
            else:
                # Mock data
                self.is_raining = (datetime.now().second % 30) > 25
            
            logger.debug(f"Rain sensor: {'Raining' if self.is_raining else 'Dry'}")
            return True
        except Exception as e:
            logger.error(f"Rain sensor read error: {e}")
            return False

class AlertNotifier:
    """Handles alarm buzzer and LED"""
    def __init__(self):
        self.buzzer_pin = None
        self.led_pin = None
        self.alert_active = False
        self.alert_start_time = None
        
        if RPI_GPIO_AVAILABLE and not config.MOCK_SENSORS:
            try:
                self.buzzer_pin = digitalio.DigitalInOut(board.D17)
                self.buzzer_pin.direction = digitalio.Direction.OUTPUT
                self.buzzer_pin.value = False
                
                self.led_pin = digitalio.DigitalInOut(board.D22)
                self.led_pin.direction = digitalio.Direction.OUTPUT
                self.led_pin.value = False
                
                logger.info("Alert pins initialized")
            except Exception as e:
                logger.warning(f"Alert pins initialization failed: {e}")
    
    def trigger_alert(self):
        """Trigger buzzer and LED alert"""
        self.alert_active = True
        self.alert_start_time = time.time()
        logger.warning("ALERT TRIGGERED!")
        
        if self.buzzer_pin:
            self.buzzer_pin.value = True
        if self.led_pin:
            self.led_pin.value = True
    
    def update_alert(self):
        """Update alert state (buzzer pattern)"""
        if self.alert_active:
            elapsed = time.time() - self.alert_start_time
            
            if elapsed < (config.ALERT_DURATION_MS / 1000):
                # Buzzer pattern: 3 short beeps
                pattern_phase = int((elapsed * 10) % 6)
                if pattern_phase < 3:
                    if self.buzzer_pin:
                        self.buzzer_pin.value = True
                else:
                    if self.buzzer_pin:
                        self.buzzer_pin.value = False
            else:
                self.alert_active = False
                if self.buzzer_pin:
                    self.buzzer_pin.value = False
                if self.led_pin:
                    self.led_pin.value = False

# ================= SERIAL COMMUNICATION =================
class SerialHandler:
    """Manages UART communication with Nano 33 BLE"""
    def __init__(self):
        self.serial_port = None
        self.connect()
        self.last_classification = {"class": "None", "confidence": 0.0}
    
    def connect(self):
        """Connect to serial port"""
        try:
            self.serial_port = serial.Serial(
                port=config.SERIAL_PORT,
                baudrate=config.SERIAL_BAUD_RATE,
                timeout=config.SERIAL_TIMEOUT
            )
            logger.info(f"Serial port {config.SERIAL_PORT} connected at {config.SERIAL_BAUD_RATE} baud")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to serial port: {e}")
            return False
    
    def read_classification(self):
        """Read classification data from Nano"""
        try:
            if self.serial_port and self.serial_port.in_waiting > 0:
                line = self.serial_port.readline().decode('utf-8').strip()
                if line:
                    data = json.loads(line)
                    self.last_classification = data
                    logger.info(f"Classification received: {data}")
                    return data
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON received: {line}")
        except Exception as e:
            logger.error(f"Serial read error: {e}")
        
        return None

# ================= GATEWAY LOGIC =================
class PlantHealthGateway:
    """Main gateway controller"""
    def __init__(self):
        self.sensor_manager = SensorManager()
        self.rain_sensor = RainSensor()
        self.alert_notifier = AlertNotifier()
        self.serial_handler = SerialHandler()
        
        self.running = False
        self.current_sensor_data = {
            "temperature": None,
            "humidity": None,
            "is_raining": False,
            "rain_intensity": 0
        }
        self.last_classification = {"class": "None", "confidence": 0.0}
        self.last_cloud_sync = time.time()
        self.sensor_history = deque(maxlen=1440)  # 24 hours at 1-minute intervals
        
        logger.info(f"Plant Health Gateway initialized - Device ID: {config.DEVICE_ID}")
    
    def check_disease_conditions(self, classification, confidence):
        """Check if disease conditions are met based on environmental data"""
        if classification not in config.DISEASE_PROFILES:
            return False
        
        if confidence < config.ALERT_THRESHOLD:
            return False
        
        profile = config.DISEASE_PROFILES[classification]
        
        # Check temperature range
        temp_match = (profile["min_temp"] <= self.current_sensor_data["temperature"] <= profile["max_temp"])
        
        # Check humidity threshold
        humidity_match = self.current_sensor_data["humidity"] >= profile["humidity_threshold"]
        
        if temp_match and humidity_match:
            logger.warning(f"Disease conditions met for {classification}")
            return True
        
        return False
    
    def send_alert(self, classification, confidence, profile):
        """Send alert to backend"""
        try:
            if not config.API_BASE_URL:
                logger.warning("API_BASE_URL not configured")
                return False
            
            url = f"{config.API_BASE_URL}/api/alerts"
            headers = {"Content-Type": "application/json"}
            
            payload = {
                "device_id": config.DEVICE_ID,
                "disease_name": classification,
                "confidence": confidence,
                "temperature": self.current_sensor_data["temperature"],
                "humidity": self.current_sensor_data["humidity"],
                "is_raining": self.current_sensor_data["is_raining"],
                "action_en": profile["targeted_action_en"],
                "action_am": profile["targeted_action_am"]
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=config.API_TIMEOUT)
            logger.info(f"Alert sent - Status: {response.status_code}")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to send alert: {e}")
            return False
    
    def sync_to_cloud(self):
        """Sync sensor data to cloud"""
        try:
            if not config.API_BASE_URL:
                return False
            
            url = f"{config.API_BASE_URL}/api/sensor-data"
            headers = {"Content-Type": "application/json"}
            
            payload = {
                "device_id": config.DEVICE_ID,
                "temperature": self.current_sensor_data["temperature"],
                "humidity": self.current_sensor_data["humidity"],
                "is_raining": self.current_sensor_data["is_raining"],
                "rain_intensity": self.current_sensor_data["rain_intensity"],
                "last_disease": self.last_classification["class"],
                "confidence": self.last_classification["confidence"],
                "timestamp": datetime.now().isoformat()
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=config.API_TIMEOUT)
            logger.debug(f"Cloud sync - Status: {response.status_code}")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Cloud sync error: {e}")
            return False
    
    def run(self):
        """Main gateway loop"""
        self.running = True
        logger.info("Gateway started")
        
        last_sensor_read = time.time()
        last_rain_check = time.time()
        
        try:
            while self.running:
                current_time = time.time()
                
                # Read sensors
                if current_time - last_sensor_read >= (config.DHT_READ_INTERVAL / 1000):
                    self.sensor_manager.read()
                    if self.sensor_manager.temperature:
                        self.current_sensor_data["temperature"] = self.sensor_manager.temperature
                        self.current_sensor_data["humidity"] = self.sensor_manager.humidity
                    last_sensor_read = current_time
                
                # Check rain sensor
                if current_time - last_rain_check >= (config.RAIN_CHECK_INTERVAL / 1000):
                    self.rain_sensor.read()
                    self.current_sensor_data["is_raining"] = self.rain_sensor.is_raining
                    last_rain_check = current_time
                
                # Handle serial classification data
                classification = self.serial_handler.read_classification()
                if classification:
                    self.last_classification = classification
                    
                    # Check if disease conditions are met
                    if self.check_disease_conditions(
                        classification["class"],
                        classification["confidence"]
                    ):
                        profile = config.DISEASE_PROFILES[classification["class"]]
                        self.send_alert(classification["class"], classification["confidence"], profile)
                        self.alert_notifier.trigger_alert()
                
                # Update alert status
                self.alert_notifier.update_alert()
                
                # Periodic cloud sync
                if current_time - self.last_cloud_sync >= config.CLOUD_SYNC_INTERVAL:
                    self.sync_to_cloud()
                    self.last_cloud_sync = current_time
                
                time.sleep(0.05)  # 50ms loop
        
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received")
        except Exception as e:
            logger.error(f"Gateway error: {e}")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the gateway"""
        self.running = False
        if self.serial_handler.serial_port:
            self.serial_handler.serial_port.close()
        logger.info("Gateway stopped")

# ================= MAIN =================
if __name__ == "__main__":
    gateway = PlantHealthGateway()
    try:
        gateway.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
