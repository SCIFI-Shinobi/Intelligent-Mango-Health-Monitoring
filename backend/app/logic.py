def evaluate_risk(disease_type: str, temperature: float, humidity: float) -> dict:
    """
    Evaluates disease risk using the same expert-backed thresholds as the ESP32 firmware.

    Risk Levels:
    - LOW RISK:    AI says 'Healthy' OR disease detected but environment not favorable.
    - MEDIUM RISK: Disease detected but environment is NOT at optimal spread conditions.
    - HIGH RISK:   Disease detected AND environment matches disease optima.

    Thresholds (Mango crops, Ethiopia):
    - Anthracnose:    High risk if 24°C <= Temp <= 30°C AND Humidity > 80%
    - Powdery Mildew: High risk if 10°C <= Temp <= 31°C AND Humidity > 80%
    """
    if disease_type == "Healthy":
        return {
            "risk_level": "LOW RISK",
            "recommendation": "Monitor & maintain sanitation."
        }

    env_favorable = False

    if disease_type == "Anthracnose":
        if 24 <= temperature <= 30 and humidity > 80:
            env_favorable = True
    elif disease_type == "Powdery Mildew":
        if 10 <= temperature <= 31 and humidity > 80:
            env_favorable = True

    if env_favorable:
        return {
            "risk_level": "HIGH RISK",
            "recommendation": "DANGER: Apply targeted fungicides immediately."
        }
    elif disease_type in ("Anthracnose", "Powdery Mildew"):
        return {
            "risk_level": "MEDIUM RISK",
            "recommendation": "Prune affected branches & improve airflow."
        }
    else:
        return {
            "risk_level": "LOW RISK",
            "recommendation": "Monitor & maintain sanitation."
        }


def get_recommendation(disease_type: str) -> str:
    """
    Returns a simple text recommendation based on the detected disease.
    Kept for backwards compatibility.
    """
    recommendations = {
        "Anthracnose": "Trim affected branches and apply copper-based fungicides. Ensure good air circulation.",
        "Powdery Mildew": "Apply sulfur-based fungicides or neem oil. Reduce humidity and remove infected leaves.",
        "Healthy": "Plant appears healthy. Continue regular monitoring and maintenance."
    }
    return recommendations.get(disease_type, "No specific recommendation available.")


def get_forecast_alert(temperature: float, humidity: float) -> str:
    """
    Generates a general environmental risk alert.
    Uses the same expert thresholds as evaluate_risk().
    """
    if humidity > 80 and 24 <= temperature <= 30:
        return "High Risk: Conditions are optimal for Anthracnose outbreak."
    elif humidity > 80 and 10 <= temperature <= 31:
        return "High Risk: Conditions are favorable for Powdery Mildew spread."
    return "Low Risk: Environmental conditions are currently stable."
