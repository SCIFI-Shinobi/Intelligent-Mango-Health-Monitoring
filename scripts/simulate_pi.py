import time
import requests
import random
import sys

API_BASE_URL = "https://mango-guard-backend.onrender.com"
INGEST_URL = f"{API_BASE_URL}/data/ingest"

# The Raspberry Pi Gateway API Key (matches gateway_serial.py)
DEVICE_API_KEY = "mg_c2a2bc944471a63f0ea2b5c9f4f432fc361172d5a76acd74"

def _post(payload, label="Payload"):
    headers = {
        "Content-Type": "application/json",
        "X-Device-Key": DEVICE_API_KEY,
    }
    try:
        print(f"\n[Raspberry Pi Simulator] Sending: {label}")
        print(f"Data: Temp {payload['temperature']}°C | Hum {payload['humidity']}% | Disease {payload['disease_type']}")
        
        r = requests.post(INGEST_URL, json=payload, headers=headers, timeout=10)
        
        if r.status_code == 200:
            print("=> Upload successful! Data sent to dashboard.")
        else:
            print(f"=> Upload failed: HTTP {r.status_code} - {r.text}")
    except requests.exceptions.ConnectionError:
        print("=> Error: Backend unreachable.")
    except Exception as e:
        print(f"=> Error: {e}")


def trigger_reading(disease_type, base_temp, base_hum, rec_en, rec_am, send_three=False):
    """
    Sends one or three readings.
    Sending 3 consecutive readings triggers the auto-forecast engine on the backend!
    """
    count = 3 if send_three else 1
    if send_three:
        print("\n>>> Preparing to send 3 sequential readings to TRIGGER THE EDGE IMPULSE FORECAST <<<")
    
    for i in range(count):
        if send_three:
            print(f"\n--- Reading {i+1}/3 ---")
            
        payload = {
            "device_id": "rpi_gateway_001",
            "temperature": round(random.uniform(base_temp - 1, base_temp + 1), 1),
            "humidity": round(random.uniform(base_hum - 2, base_hum + 2), 1),
            "disease_type": disease_type,
            "confidence_score": round(random.uniform(0.90, 0.99), 2),
        }
        
        if disease_type != "Healthy":
            payload["recommendations"] = [{
                "title": f"{disease_type} Alert",
                "description": rec_en,
                "title_am": "ማስጠንቀቂያ",
                "description_am": rec_am,
            }]
            
        _post(payload, label=f"Simulated {disease_type} Scan")
        
        if send_three and i < count - 1:
            print("Waiting 2 seconds before next reading...")
            time.sleep(2)


def menu():
    print("==================================================")
    print("🥭 Raspberry Pi Gateway Simulator 🥭")
    print("==================================================")
    print("1. Send Healthy Scan (Normal T/H)")
    print("2. Send Anthracnose Scan (High T/H)")
    print("3. Send Powdery Mildew Scan (Mod T/Mod H)")
    print("4. Trigger Anthracnose Forecast (Sends 3 cool/wet readings)")
    print("5. Trigger Healthy Forecast (Sends 3 normal readings)")
    print("6. Trigger Powdery Mildew Forecast (Sends 3 warm/mod readings)")
    print("q. Quit")
    print("==================================================")
    choice = input("Select an option: ")
    return choice.strip().lower()

if __name__ == "__main__":
    print("Welcome to the Raspberry Pi Simulator.")
    print(f"Targeting: {API_BASE_URL}")
    while True:
        c = menu()
        if c == '1':
            trigger_reading("Healthy", base_temp=26.0, base_hum=65.0, rec_en="", rec_am="")
        elif c == '2':
            trigger_reading(
                "Anthracnose", 
                base_temp=30.0, 
                base_hum=85.0, 
                rec_en="Apply copper-based fungicides immediately and ensure proper drainage.", 
                rec_am="ወዲያውኑ መዳብ-ተኮር ፀረ-ፈንገስ መድኃኒቶችን ይጠቀሙ እና ትክክለኛ የውሃ ማፍሰሻን ያረጋግጡ።"
            )
        elif c == '3':
            trigger_reading(
                "Powdery Mildew", 
                base_temp=24.0, 
                base_hum=75.0, 
                rec_en="Apply sulfur-based fungicides and prune dense canopy for airflow.", 
                rec_am="በሰልፈር ላይ የተመሰረቱ የፈንገስ መድሐኒቶችን ይተግብሩ እና ጥቅጥቅ ያሉ ቅርንጫፎችን ለአየር ዝውውር ይቁረጡ።"
            )
        elif c == '4':
            trigger_reading(
                "Anthracnose",
                base_temp=16.5,  # Cool nights trigger anthracnose
                base_hum=90.0,   # Very high humidity
                rec_en="Apply copper-based fungicides immediately and ensure proper drainage.", 
                rec_am="ወዲያውኑ መዳብ-ተኮር ፀረ-ፈንገስ መድሃኒቶችን ይጠቀሙ እና ትክክለኛ የውሃ ማፍሰሻን ያረጋግጡ።",
                send_three=True
            )
        elif c == '5':
            trigger_reading(
                "Healthy", 
                base_temp=25.0, 
                base_hum=60.0, 
                rec_en="", 
                rec_am="",
                send_three=True
            )
        elif c == '6':
            trigger_reading(
                "Powdery Mildew",
                base_temp=22.0,  # Warm daytime temps
                base_hum=55.0,   # Moderate humidity
                rec_en="Apply sulfur-based fungicides and prune dense canopy for airflow.", 
                rec_am="በሰልፈር ላይ የተመሰረቱ የፈንገስ መድሐኒቶችን ይተግብሩ እና ጥቅጥቅ ያሉ ቅርንጫፎችን ለአየር ዝውውር ይቁረጡ።",
                send_three=True
            )
        elif c == 'q':
            sys.exit(0)
        else:
            print("Invalid choice.")
        
        time.sleep(1)
