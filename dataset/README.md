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

> [!NOTE]
> The script requires `opencv-python-headless`, `numpy`, `imgaug`, and `pillow-heif` to be installed in your Python environment.
