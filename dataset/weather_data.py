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
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "bahir_dar_mango_dataset.csv")

def fetch_weather():
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "start_date": START_DATE,
        "end_date": END_DATE,
        "hourly": ["temperature_2m", "relative_humidity_2m", "precipitation"],
        "timezone": "GMT"
    }
    responses = openmeteo.weather_api(url, params=params)
    return responses[0]

def process_data(response):
    # Process hourly data
    hourly = response.Hourly()
    hourly_temperature_2m = hourly.Variables(0).ValuesAsNumpy()
    hourly_relative_humidity_2m = hourly.Variables(1).ValuesAsNumpy()
    hourly_precipitation = hourly.Variables(2).ValuesAsNumpy()

    hourly_data = {
        "timestamp": pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left"
        )
    }
    hourly_data["temperature"] = hourly_temperature_2m
    hourly_data["humidity"] = hourly_relative_humidity_2m

    df = pd.DataFrame(data=hourly_data)
    # Format timestamp to ISO 8601
    df["timestamp"] = df["timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return df

def apply_risk_labels(df):
    """
    Apply risk labels based on seasonal patterns and relaxed thresholds.
    Seasons in Bahir Dar:
    - Kiremt (Main Rainy): June - September
    - Bega (Dry/Cool): October - February
    - Belg (Small Rain/Flowering): March - May
    """
    temp_timestamps = pd.to_datetime(df["timestamp"])
    months = temp_timestamps.dt.month
    
    # Define Season column
    df["season"] = "Bega"  # Default to Dry season (Oct-Jan)
    df.loc[months.isin([6, 7, 8, 9]), "season"] = "Kiremt"  # Jun-Sep
    df.loc[months.isin([2, 3, 4, 5]), "season"] = "Belg"    # Feb-May
    
    df["risk_level"] = "Stable"
    
    # 1. High_Anthracnose_Risk: 18°C–32°C and humidity > 80% over a rolling 4-hour window
    # Primarily during Kiremt (Rainy) or Belg (Small Rains)
    condition_anthracnose = (df["temperature"] >= 18) & (df["temperature"] <= 32) & (df["humidity"] > 80)
    
    # Use rolling window of 4 hours
    df["anth_window"] = condition_anthracnose.rolling(window=4, min_periods=4).min()
    
    # Anthracnose is much more likely in wet seasons
    wet_season_mask = df["season"].isin(["Kiremt", "Belg"])
    df.loc[(df["anth_window"] == 1.0) & wet_season_mask, "risk_level"] = "High_Anthracnose_Risk"
    
    # 2. High_Mildew_Risk: daytime (06:00–18:00), temperature 15°C–27°C and humidity 40%–75%
    # Predominantly during Belg (flowering) or late Bega
    daytime_mask = (temp_timestamps.dt.hour >= 6) & (temp_timestamps.dt.hour <= 18)
    condition_mildew = daytime_mask & (df["temperature"] >= 15) & (df["temperature"] <= 27) & (df["humidity"] >= 40) & (df["humidity"] <= 75)
    
    # If it's Bega or Belg, Mildew is a high threat to flowers
    mildew_season_mask = df["season"].isin(["Belg", "Bega"])
    df.loc[condition_mildew & mildew_season_mask, "risk_level"] = "High_Mildew_Risk"
    
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
