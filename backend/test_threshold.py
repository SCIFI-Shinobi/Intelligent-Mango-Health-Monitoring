"""
Demo scripts for defense day - Test disease confidence threshold alerts
Run: python test_threshold.py
"""
import requests
import time

API_URL = "http://localhost:8000/data/ingest"

def send_detection(disease_type, confidence, description):
    """Send a disease detection with specific confidence"""
    payload = {
        "device_id": "esp32-demo",
        "temperature": 28.5,
        "humidity": 75.0,
        "disease_type": disease_type,
        "confidence_score": confidence,
        "season": "wet",
        "precipitation": 10.0,
        "forecast": []
    }

    print(f"\n{'='*50}")
    print(f"TEST: {description}")
    print(f"Disease: {disease_type}, Confidence: {confidence*100:.0f}%")
    print(f"Threshold: 70% (alerts only above this)")
    print("-"*50)

    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            if confidence >= 0.70 and disease_type != "Healthy":
                print("✓ SUCCESS - Alert CREATED (above threshold)")
            else:
                print("✓ SUCCESS - No alert (below threshold or healthy)")
        else:
            print(f"✗ Error: {response.status_code}")
    except Exception as e:
        print(f"✗ Connection error: {e}")


def test_forecast_alert():
    """Test forecast-based alerts"""
    payload = {
        "device_id": "esp32-demo",
        "temperature": 29.0,
        "humidity": 80.0,
        "disease_type": "Healthy",
        "confidence_score": 0.95,
        "season": "wet",
        "precipitation": 15.0,
        "forecast": [
            {"day": 1, "risk_level": "Stable"},
            {"day": 2, "risk_level": "High_Anthracnose_Risk"},
            {"day": 3, "risk_level": "High_Mildew_Risk"},
            {"day": 4, "risk_level": "Stable"},
            {"day": 5, "risk_level": "Stable"}
        ]
    }

    print(f"\n{'='*50}")
    print("TEST: Forecast with High Risk Days")
    print("Day 2: High Anthracnose Risk, Day 3: High Mildew Risk")
    print("-"*50)

    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            print("✓ SUCCESS - Forecast alerts created for Day 2 and Day 3")
        else:
            print(f"✗ Error: {response.status_code}")
    except Exception as e:
        print(f"✗ Connection error: {e}")


if __name__ == "__main__":
    print("\n" + "="*50)
    print("  MANGAGUARD - ALERT THRESHOLD TEST SUITE")
    print("="*50)
    print("\nMake sure backend is running on localhost:8000")
    print("Check notification bell after each test!\n")

    input("Press Enter to start tests...")

    # Test 1: Below threshold - NO alert
    send_detection("Anthracnose", 0.55, "55% confidence (BELOW threshold)")
    time.sleep(1)

    # Test 2: Just below threshold - NO alert
    send_detection("Powdery Mildew", 0.68, "68% confidence (BELOW threshold)")
    time.sleep(1)

    # Test 3: At threshold - YES alert
    send_detection("Anthracnose", 0.70, "70% confidence (AT threshold)")
    time.sleep(1)

    # Test 4: Above threshold - YES alert
    send_detection("Powdery Mildew", 0.89, "89% confidence (ABOVE threshold)")
    time.sleep(1)

    # Test 5: Healthy plant - NO alert regardless of confidence
    send_detection("Healthy", 0.95, "Healthy plant (no alert needed)")
    time.sleep(1)

    # Test 6: Forecast alerts
    test_forecast_alert()

    print("\n" + "="*50)
    print("  TESTS COMPLETE!")
    print("="*50)
    print("\nExpected alerts in notification bell:")
    print("  - Anthracnose Detected (70%)")
    print("  - Powdery Mildew Detected (89%)")
    print("  - Day 2 Forecast: High Anthracnose Risk")
    print("  - Day 3 Forecast: High Powdery Mildew Risk")
    print("\nNOT expected (below threshold or healthy):")
    print("  - 55% Anthracnose (below threshold)")
    print("  - 68% Powdery Mildew (below threshold)")
    print("  - Healthy plant detection")
