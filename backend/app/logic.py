def get_recommendation(disease_type: str) -> str:
    """
    Returns treatment recommendations based on the detected disease.
    """
    recommendations = {
        "Anthracnose": "Recommendation: Trim affected branches and apply appropriate fungicides (e.g., copper-based). Ensure good air circulation.",
        "Powdery Mildew": "Recommendation: Apply sulfur-based fungicides or neem oil. Reduce humidity if possible and remove infected leaves.",
        "Healthy": "Status: Plant appears healthy. Continue regular monitoring and maintenance."
    }
    return recommendations.get(disease_type, "No specific recommendation available.")

def get_forecast_alert(temperature: float, humidity: float) -> str:
    """
    Generates a risk alert based on environmental trends.
    High risk for Anthracnose: High humidity (>80%) and moderate-high temp (20-30C).
    High risk for Powdery Mildew: Moderate humidity (50-70%) and warm temp (20-25C).
    """
    # Simplified logic for demonstration
    if humidity > 80 and (20 <= temperature <= 30):
        return "High Risk: Environmental conditions are favorable for Anthracnose outbreak."
    elif (50 <= humidity <= 75) and (20 <= temperature <= 25):
        return "High Risk: Environmental conditions are favorable for Powdery Mildew."
    
    return "Low Risk: Environmental conditions are stable."
