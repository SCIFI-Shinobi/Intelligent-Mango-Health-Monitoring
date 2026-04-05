"""
Interactive test tool for disease confidence threshold alerts.
Run: python test_threshold.py
"""
import json
import time

try:
    import requests  # type: ignore
except ImportError:
    requests = None
    import urllib.request
    import urllib.error

API_URL = "http://localhost:8000/data/ingest"
DEFAULT_DEVICE_ID = "esp32-demo"
THRESHOLD = 0.70


def post_json(url, payload):
    """POST JSON using requests when available, else urllib (no extra dependency)."""
    if requests is not None:
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code, response.text

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.getcode(), body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, body


def build_detection_payload(
    disease_type,
    confidence,
    temperature=28.5,
    humidity=75.0,
    device_id=DEFAULT_DEVICE_ID,
):
    return {
        "device_id": device_id,
        "temperature": temperature,
        "humidity": humidity,
        "disease_type": disease_type,
        "confidence_score": confidence,
        "forecast": [],
    }


def send_detection(payload, description="Custom detection"):
    """Send one detection payload."""
    disease_type = payload.get("disease_type", "Unknown")
    confidence = float(payload.get("confidence_score", 0.0))

    print(f"\n{'='*50}")
    print(f"TEST: {description}")
    print(f"Disease: {disease_type}, Confidence: {confidence*100:.0f}%")
    print(f"Threshold: {THRESHOLD*100:.0f}% (alerts only above this)")
    print("-"*50)

    try:
        status_code, response_text = post_json(API_URL, payload)
        if status_code == 200:
            if confidence >= THRESHOLD and disease_type != "Healthy":
                print("[OK] SUCCESS - Alert CREATED (above threshold)")
            else:
                print("[OK] SUCCESS - No alert (below threshold or healthy)")
        else:
            print(f"[ERR] Error: {status_code}")
            print(response_text)
    except Exception as e:
        print(f"[ERR] Connection error: {e}")


def test_forecast_alert():
    """Test forecast-based alerts"""
    payload = {
        "device_id": "esp32-demo",
        "temperature": 29.0,
        "humidity": 80.0,
        "disease_type": "Healthy",
        "confidence_score": 0.95,
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
        status_code, _ = post_json(API_URL, payload)
        if status_code == 200:
            print("[OK] SUCCESS - Forecast alerts created for Day 2 and Day 3")
        else:
            print(f"[ERR] Error: {status_code}")
    except Exception as e:
        print(f"[ERR] Connection error: {e}")


def run_default_suite():
    """Run the original defense-day sequence."""
    tests = [
        (build_detection_payload("Anthracnose", 0.55), "55% confidence (BELOW threshold)"),
        (build_detection_payload("Powdery Mildew", 0.68), "68% confidence (BELOW threshold)"),
        (build_detection_payload("Anthracnose", 0.70), "70% confidence (AT threshold)"),
        (build_detection_payload("Powdery Mildew", 0.89), "89% confidence (ABOVE threshold)"),
    ]

    for payload, description in tests:
        send_detection(payload, description)
        time.sleep(1)

    test_forecast_alert()

    print("\n" + "="*50)
    print("SUITE COMPLETE")
    print("="*50)
    print("Expected alerts in notification bell:")
    print("  - Anthracnose Detected (70%)")
    print("  - Powdery Mildew Detected (89%)")
    print("  - Day 2 Forecast: High Anthracnose Risk")
    print("  - Day 3 Forecast: High Powdery Mildew Risk")


def ask_float(label, default_value, min_value=None, max_value=None):
    while True:
        raw = input(f"{label} [{default_value}]: ").strip()
        if not raw:
            return default_value
        try:
            value = float(raw)
        except ValueError:
            print("Please enter a numeric value.")
            continue
        if min_value is not None and value < min_value:
            print(f"Value must be >= {min_value}.")
            continue
        if max_value is not None and value > max_value:
            print(f"Value must be <= {max_value}.")
            continue
        return value


def ask_text(label, default_value):
    raw = input(f"{label} [{default_value}]: ").strip()
    return raw or default_value


def send_custom_detection():
    print("\nEnter custom detection values (press Enter to keep defaults).")
    disease_type = ask_text("Disease type (Healthy / Anthracnose / Powdery Mildew)", "Anthracnose")
    confidence = ask_float("Confidence score (0 to 1)", 0.75, 0.0, 1.0)
    temperature = ask_float("Temperature (degC)", 28.5)
    humidity = ask_float("Humidity (%)", 75.0)
    device_id = ask_text("Device ID", DEFAULT_DEVICE_ID)

    payload = build_detection_payload(
        disease_type=disease_type,
        confidence=confidence,
        temperature=temperature,
        humidity=humidity,
        device_id=device_id,
    )
    send_detection(payload, "Custom detection")


def print_menu():
    print("\n" + "="*50)
    print("Choose what data to send:")
    print("1) Send Anthracnose 55% (below threshold)")
    print("2) Send Powdery Mildew 68% (below threshold)")
    print("3) Send Anthracnose 70% (at threshold)")
    print("4) Send Powdery Mildew 89% (above threshold)")
    print("5) Send forecast high-risk payload")
    print("6) Send custom detection (you choose all values)")
    print("7) Run full default suite")
    print("0) Exit")


def run_interactive_menu():
    preset_payloads = {
        "1": (build_detection_payload("Anthracnose", 0.55), "55% confidence (BELOW threshold)"),
        "2": (build_detection_payload("Powdery Mildew", 0.68), "68% confidence (BELOW threshold)"),
        "3": (build_detection_payload("Anthracnose", 0.70), "70% confidence (AT threshold)"),
        "4": (build_detection_payload("Powdery Mildew", 0.89), "89% confidence (ABOVE threshold)"),
    }

    while True:
        print_menu()
        choice = input("Select option: ").strip()

        if choice == "0":
            print("Exiting test tool.")
            break

        if choice in preset_payloads:
            payload, description = preset_payloads[choice]
            send_detection(payload, description)
            continue

        if choice == "5":
            test_forecast_alert()
            continue

        if choice == "6":
            send_custom_detection()
            continue

        if choice == "7":
            run_default_suite()
            continue

        print("Invalid choice. Select one of: 0, 1, 2, 3, 4, 5, 6, 7")


if __name__ == "__main__":
    print("\n" + "="*50)
    print("  MANGAGUARD - INTERACTIVE TEST TOOL")
    print("="*50)
    print("\nMake sure backend is running on localhost:8000")
    print("Choose exactly what to send from the menu.\n")

    run_interactive_menu()
