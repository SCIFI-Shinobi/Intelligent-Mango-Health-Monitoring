# Plant Health Dataset & Augmentation

This directory contains the image dataset for the Intelligent Plant Health Monitoring system and the augmentation script used to expand it.

## Dataset Structure

The augmentation script expects images to be organized into subdirectories based on their categories. For example:

```text
dataset/
├── Anthracnose/
├── Healthy/
├── Powdery_Mildew/
└── aug.py
```

## Augmentation Script (`aug.py`)

The `aug.py` script is designed for **safe, incremental augmentation**. It performs several transformations on new images and standardizes filenames.

### What it does:
1. **Detection**: Automatically identifies subdirectories (categories) within its location.
2. **Filtering**: Only processes "new" source images (e.g., `.jpg`, `.png`, `.heic`). It skips files that have already been augmented.
3. **Transformations**: For every new image, it generates:
   - `Flip`: Horizontal flip
   - `Rotate`: Random rotation between -90 and 90 degrees
   - `Bright`: Increased brightness
   - `Dark`: Decreased brightness
   - `Original`: A standardized version of the source image
4. **Safety**: It only deletes the original source file after all augmentations are successfully saved.

### How to use:

1. Place your new raw images into the appropriate category folder (e.g., `dataset/Healthy/`).
2. Run the script from this directory:
   ```bash
   python3 aug.py
   ```
3. The script will process the new images, create the augmented versions, and clean up the source files.

## Weather Data & Risk Labeling

This project incorporates historical weather data to model disease risks for mango trees in **Bahir Dar, Ethiopia**.

### Data Source & API
- **Provider**: [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api)
- **Location**: Bahir Dar (Lat: 11.59, Lon: 37.39)
- **Period**: 2016-01-01 to 2026-02-20
- **Variables**: Hourly temperature (2m), relative humidity (2m), and precipitation.

### Weather Dataset (`bahir_dar_mango_dataset.csv`)
The generated dataset contains timestamped weather records with associated risk levels.

### Weather Data Script (`weather_data.py`)
The `weather_data.py` script automates the following process:
1. **Fetching**: Pulls hourly data from Open-Meteo.
2. **Processing**: Formats timestamps to ISO 8601 and organizes variables.
3. **Risk Labeling**: Applies expert-validated thresholds to determine disease risk:
   - **High_Anthracnose_Risk**: Temperature between 18°C–32°C and humidity > 80% over a 4-hour window (primarily during Kiremt/Belg seasons).
   - **High_Mildew_Risk**: Daytime (06:00–18:00), temperature 15°C–27°C, and humidity 40%–75% (early-mid dry seasons).
   - **Stable**: Conditions outside these thresholds.

### Requirements
Ensure you have the following installed for weather data processing:
```bash
pip install openmeteo-requests requests-cache pandas retry-requests
```

> [!NOTE]
> The augmentation script (`aug.py`) additionally requires `opencv-python-headless`, `numpy`, `imgaug`, and `pillow-heif`.
