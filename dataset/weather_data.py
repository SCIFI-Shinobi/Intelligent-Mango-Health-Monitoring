import os
import openmeteo_requests
import requests_cache
import pandas as pd
from retry_requests import retry

# Constants for Bahir Dar location and date range
LATITUDE = 11.59
LONGITUDE = 37.39
START_DATE = "2016-01-01"
END_DATE = "2026-02-20"  # Target range as requested

# Setup the Open-Meteo API client with cache and retry on error
cache_session = requests_cache.CachedSession('.cache', expire_after=-1)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

# Output directory (relative to project root)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "dataset")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "bahir_dar_mango_dataset_numeric.csv")

def fetch_weather():
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "start_date": START_DATE,
        "end_date": END_DATE,
        "hourly": ["temperature_2m", "relative_humidity_2m"],
        "timezone": "GMT"
    }
    responses = openmeteo.weather_api(url, params=params)
    return responses[0]

def process_data(response):
    # Process hourly data
    hourly = response.Hourly()
    hourly_temperature_2m = hourly.Variables(0).ValuesAsNumpy()
    hourly_relative_humidity_2m = hourly.Variables(1).ValuesAsNumpy()

    hourly_data = {
        "timestamp": pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left"
        ),
        "temperature": hourly_temperature_2m,
        "humidity": hourly_relative_humidity_2m
    }

    df = pd.DataFrame(data=hourly_data)
    # Format timestamp to ISO 8601
    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df

def apply_risk_labels(df):
    """
    Apply risk labels based on temperature and humidity patterns.
    """
    temp_timestamps = pd.to_datetime(df["timestamp"])

    df["risk_level"] = "Stable"
    
    # --- IMPROVED ANTHRACNOSE LOGIC ---
    # Triggered by: High Humidity (>80%) + Warmth (15°C–32°C)
    condition_anthracnose = (
        (df["temperature"] >= 15) & (df["temperature"] <= 32) & 
        (df["humidity"] > 80)
    )
    
    # Use rolling window of 4 hours
    df["anth_window"] = condition_anthracnose.rolling(window=4, min_periods=4).min()
    
    df.loc[df["anth_window"] == 1.0, "risk_level"] = "High_Anthracnose_Risk"
    
    # --- IMPROVED MILDEW LOGIC ---
    # Mildew daytime pattern under moderate temperature and humidity.
    daytime_mask = (temp_timestamps.dt.hour >= 6) & (temp_timestamps.dt.hour <= 18)
    condition_mildew = (
        daytime_mask & 
        (df["temperature"] >= 15) & (df["temperature"] <= 27) & 
        (df["humidity"] >= 40) & (df["humidity"] <= 75)
    )
    
    df.loc[condition_mildew, "risk_level"] = "High_Mildew_Risk"
    
    # Clean up temporary columns
    df = df.drop(columns=["anth_window"])
    return df

def main():
    print(f"Fetching weather data for Bahir Dar ({LATITUDE}, {LONGITUDE}) from {START_DATE} to {END_DATE}...")
    response = fetch_weather()
    df = process_data(response)
    print("Applying risk labels...")
    df = apply_risk_labels(df)
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"Successfully saved {len(df)} rows to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
