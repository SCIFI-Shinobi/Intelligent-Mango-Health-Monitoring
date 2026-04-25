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
            "recommendation": "Monitor & maintain sanitation.",
            "recommendation_am": "መደበኛ ክትትልና ጽዳት ያድርጉ"
        }

    env_favorable = False

    if disease_type == "Anthracnose":
        if 24 <= temperature <= 30 and humidity > 80:
            env_favorable = True
    elif disease_type == "Powdery Mildew":
        if 10 <= temperature <= 31 and humidity > 80:
            env_favorable = True

    if env_favorable:
        action = TARGETED_ACTIONS.get(disease_type, {})
        return {
            "risk_level": "HIGH RISK",
            "recommendation": action.get("en", "Apply targeted fungicides immediately."),
            "recommendation_am": action.get("am", "ወዲያውኑ መድሃኒት ይርጩ")
        }
    elif disease_type in ("Anthracnose", "Powdery Mildew", "Die Back"):
        action = PREVENTIVE_ACTIONS.get(disease_type, {})
        return {
            "risk_level": "MEDIUM RISK",
            "recommendation": action.get("en", "Prune affected branches & improve airflow."),
            "recommendation_am": action.get("am", "የታመሙ ቅርንጫፎችን ያስወግዱ")
        }
    else:
        return {
            "risk_level": "LOW RISK",
            "recommendation": "Monitor & maintain sanitation.",
            "recommendation_am": "መደበኛ ክትትል ያድርጉ"
        }


# ---- Recommendation data matching ESP32 firmware DiseaseProfile ----

TARGETED_ACTIONS = {
    "Anthracnose": {
        "en": "Spray with copper-based fungicide (Copper oxychloride). High risk conditions detected.",
        "am": "በፈንገስ ማጥፊያ (Copper) ይርጩ"
    },
    "Powdery Mildew": {
        "en": "Spray with sulfur-based medicine (Sulfur fungicide). High risk conditions detected.",
        "am": "ሰልፈር (Sulfur) ያለው መድሃኒት ይርጩ"
    },
    "Die Back": {
        "en": "Prune dieback-affected twigs, disinfect tools, and apply a protective copper fungicide.",
        "am": "የደረቁ ቅርንጫፎችን ይቈርጡ፣ መሳሪያዎችን ያጽዱ እና የኮፐር ፈንገስ ማጥፊያ ይጠቀሙ"
    },
}

PREVENTIVE_ACTIONS = {
    "Anthracnose": {
        "en": "Remove diseased branches and improve air circulation.",
        "am": "የታመሙ ቅርንጫፎችን ያስወግዱ"
    },
    "Powdery Mildew": {
        "en": "Prune tree branches to allow air circulation.",
        "am": "አየር እንዲገባ የዛፉን ቅርንጫፎች ይቀንሱ"
    },
    "Die Back": {
        "en": "Remove infected branches, avoid trunk injury, and support tree vigor with balanced irrigation.",
        "am": "የተጎዱ ቅርንጫፎችን ያስወግዱ፣ ግንዱን ከጉዳት ይጠብቁ እና በተመጣጠነ ውሃ ድጋፍ ያድርጉ"
    },
}

# Full bilingual recommendation set matching firmware
RECOMMENDATIONS = {
    "Anthracnose": {
        "en": {
            "title": "Anthracnose Detected",
            "targeted": "Spray with copper-based fungicide (Copper oxychloride). Ensure trees are well-ventilated.",
            "preventive": "Remove diseased branches and improve air circulation around trees.",
        },
        "am": {
            "title": "አንትራክኖዝ ተገኝቷል",
            "targeted": "በፈንገስ ማጥፊያ (Copper) ይርጩ",
            "preventive": "የታመሙ ቅርንጫፎችን ያስወግዱ",
        },
    },
    "Powdery Mildew": {
        "en": {
            "title": "Powdery Mildew Detected",
            "targeted": "Apply sulfur-based fungicide or neem oil. Reduce humidity and remove infected leaves.",
            "preventive": "Prune tree branches to allow air circulation.",
        },
        "am": {
            "title": "የዱቄት ሻጋታ ተገኝቷል",
            "targeted": "ሰልፈር (Sulfur) ያለው መድሃኒት ይርጩ",
            "preventive": "አየር እንዲገባ የዛፉን ቅርንጫፎች ይቀንሱ",
        },
    },
    "Die Back": {
        "en": {
            "title": "Die Back Detected",
            "targeted": "Prune dieback-affected twigs, disinfect pruning tools, and protect wounds with a copper fungicide.",
            "preventive": "Remove infected branches early and keep trees vigorous with balanced irrigation and nutrition.",
        },
        "am": {
            "title": "ዳይ ባክ ተገኝቷል",
            "targeted": "የደረቁ ቅርንጫፎችን ይቈርጡ፣ መሳሪያዎችን ያጽዱ እና የኮፐር ፈንገስ ማጥፊያ ይጠቀሙ",
            "preventive": "የተጎዱ ቅርንጫፎችን ቀድሞ ያስወግዱ እና በተመጣጠነ ውሃና ንጥረ ምግብ ዛፉን ያጠናክሩ",
        },
    },
    "Healthy": {
        "en": {
            "title": "Plant Healthy",
            "targeted": "Continue regular monitoring and maintenance.",
            "preventive": "Maintain field sanitation and monitor regularly.",
        },
        "am": {
            "title": "ተክሉ ጤናማ ነው",
            "targeted": "መደበኛ ክትትልና ጽዳት ያድርጉ",
            "preventive": "መደበኛ ክትትል ያድርጉ",
        },
    },
}

GENERAL_TIPS = [
    {
        "en": {"title": "Monitor Humidity", "description": "Humidity levels above 80% increase fungal disease risk. Ensure proper ventilation around mango trees."},
        "am": {"title": "እርጥበት ይከታተሉ", "description": "ከ80% በላይ እርጥበት የፈንገስ በሽታ ስጋትን ይጨምራል። በማንጎ ዛፎች ዙሪያ በቂ አየር ማናፈሻ ይኑር።"},
    },
    {
        "en": {"title": "Pruning Needed", "description": "Remove overcrowded branches to improve airflow and reduce fungal risk."},
        "am": {"title": "መግረዝ ያስፈልጋል", "description": "የአየር ዝውውርን ለማሻሻልና የፈንገስ ስጋትን ለመቀነስ የተጨናነቁ ቅርንጫፎችን ያስወግዱ።"},
    },
    {
        "en": {"title": "Fungicide Application", "description": "Apply copper-based fungicide as a preventive measure in high-humidity periods."},
        "am": {"title": "የፈንገስ ማጥፊያ መርጨት", "description": "እርጥበት በሚጨምርበት ጊዜ እንደ መከላከያ በፈንገስ ማጥፊያ (Copper) ይርጩ።"},
    },
    {
        "en": {"title": "Soil Drainage", "description": "Check soil drainage around tree bases. Waterlogging increases disease risk."},
        "am": {"title": "የአፈር ፍሳሽ", "description": "በዛፉ ስር ያለውን የአፈር ፍሳሽ ይፈትሹ። የውሃ መቆር የበሽታ ስጋትን ይጨምራል።"},
    },
    {
        "en": {"title": "Harvest Timing", "description": "Consider early harvest if disease pressure increases to save unaffected fruits."},
        "am": {"title": "የመከር ጊዜ", "description": "የበሽታ ጫና ከጨመረ ያልተጎዱ ፍራፍሬዎችን ለማዳን ቀድሞ መሰብሰብ ያስቡ።"},
    },
]


def get_recommendation(disease_type: str) -> str:
    """
    Returns a simple text recommendation based on the detected disease.
    Kept for backwards compatibility.
    """
    rec = RECOMMENDATIONS.get(disease_type, RECOMMENDATIONS["Healthy"])
    return rec["en"]["targeted"]


def get_recommendation_bilingual(disease_type: str, risk_level: str) -> dict:
    """
    Returns bilingual (English + Amharic) recommendation matching ESP32 firmware.
    """
    rec = RECOMMENDATIONS.get(disease_type, RECOMMENDATIONS["Healthy"])
    is_high = "HIGH" in risk_level.upper()
    action_key = "targeted" if is_high else "preventive"

    return {
        "title_en": rec["en"]["title"],
        "title_am": rec["am"]["title"],
        "description_en": rec["en"][action_key],
        "description_am": rec["am"][action_key],
    }


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
