import re
import numpy as np
import cv2  # pylint: disable=no-member
from PIL import Image
import imgaug.augmenters as iaa
from pathlib import Path

# --- Configuration ---
# using pathlib makes path manipulation much robust against OS differences and spaces
DATASET_PATH = Path(__file__).parent.resolve()
# Automatically detect categories based on subdirectories if they match expected names or just include all subdirs
EXPECTED_CATEGORIES = ['Anthracnose', 'Healthy', 'Powdery_Mildew']
CATEGORIES = [d.name for d in DATASET_PATH.iterdir() if d.is_dir() and d.name in EXPECTED_CATEGORIES]
if not CATEGORIES:
    # Fallback to any directory that isn't hidden if none of the expected ones are found
    CATEGORIES = [d.name for d in DATASET_PATH.iterdir() if d.is_dir() and not d.name.startswith('.')]
VALID_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.heic', '.bmp', '.tiff'} # Set for faster lookup

# Try importing HEIC support
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    print("Warning: pillow_heif not installed. HEIC files found might fail to open.")

# --- Augmentation Pipeline ---
SEQ_FLIP = iaa.Fliplr(1.0)
SEQ_ROTATE = iaa.Affine(rotate=(-90, 90))
SEQ_BRIGHT = iaa.Multiply((1.2, 1.5))
SEQ_DARK = iaa.Multiply((0.5, 0.8))

def read_image(path: Path):
    """
    Reads an image from a Path object.
    Returns a BGR numpy array compatible with OpenCV.
    """
    try:
        # Open with PIL (handles HEIC automatically if registered)
        pil_img = Image.open(path)
        pil_img = pil_img.convert('RGB')
        np_img = np.array(pil_img)
        # Convert RGB (PIL) to BGR (OpenCV)
        return cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)
    except Exception as e:
        print(f"[Error] Could not read image {path.name}: {e}")
        return None

def get_existing_max_index(folder_path: Path, category: str) -> int:
    """
    Scans the folder for files matching the pattern {Category}_{Index}_Original.jpg.
    Returns the maximum index found, or -1 if no such files exist.
    """
    pattern = re.compile(rf"^{re.escape(category)}_(\d+)_Original\.jpg$", re.IGNORECASE)
    max_idx = -1
    
    if not folder_path.exists():
        return -1

    # iterdir() is the pathlib way to list files
    for entry in folder_path.iterdir():
        if entry.is_file():
            match = pattern.match(entry.name)
            if match:
                idx = int(match.group(1))
                if idx > max_idx:
                    max_idx = idx
    return max_idx

def save_image_safe(path: Path, image):
    """
    Helper to save an image with error handling.
    Returns True if successful, False otherwise.
    """
    try:
        # cv2.imwrite expects a string path
        success = cv2.imwrite(str(path), image)
        if not success:
            print(f"[Error] cv2.imwrite failed for {path.name}")
        return success
    except Exception as e:
        print(f"[Exception] Failed to save {path.name}: {e}")
        return False

def process_category(category_name, folder_path: Path):
    """
    Process images for a single category safely implementation.
    """
    if not folder_path.exists():
        print(f"[Warning] Folder not found: {folder_path}")
        return

    print(f"--- Processing Category: {category_name} ---")

    # 1. Determine the next available index
    current_max_index = get_existing_max_index(folder_path, category_name)
    next_index = current_max_index + 1
    print(f"  Existing Max Index: {current_max_index}. Next Index: {next_index}")

    # 2. Identify new files to process
    # Pattern to SKIP (already processed files)
    processed_pattern = re.compile(rf"^{re.escape(category_name)}_\d+_(Original|Flip|Rotate|Bright|Dark)\.jpg$", re.IGNORECASE)
    
    files_to_process = []
    
    for entry in folder_path.iterdir():
        if not entry.is_file():
            continue
            
        # Check extension
        if entry.suffix.lower() not in VALID_EXTENSIONS:
            continue

        # Skip if it matches our "already processed" pattern
        if processed_pattern.match(entry.name):
            continue
            
        files_to_process.append(entry)

    # Sort files by name for deterministic order
    files_to_process.sort(key=lambda p: p.name)

    print(f"  Found {len(files_to_process)} new images to process.")

    # 3. Process new files
    count = 0
    for source_file in files_to_process:
        image = read_image(source_file)
        if image is None:
            continue

        # Prepare new filenames
        index_str = str(next_index).zfill(4)
        base_name = f"{category_name}_{index_str}"
        
        # Define all target paths
        path_original = folder_path / f"{base_name}_Original.jpg"
        path_flip     = folder_path / f"{base_name}_Flip.jpg"
        path_rotate   = folder_path / f"{base_name}_Rotate.jpg"
        path_bright   = folder_path / f"{base_name}_Bright.jpg"
        path_dark     = folder_path / f"{base_name}_Dark.jpg"

        # --- Execution Block ---
        # We only delete the source file if ALL critical steps succeed.
        # At minimum, saving the Original is critical. Augmentations are secondary but we try to be safe.
        
        all_ops_successful = True

        # 1. Save standardized Original
        if not save_image_safe(path_original, image):
            print(f"  Skipping {source_file.name} due to save failure.")
            continue # Skip this file entirely if we can't save the original
            
        # 2. Augmentations
        # We continue even if one augmentation fails, but we log it.
        try:
            # Flip
            if not save_image_safe(path_flip, SEQ_FLIP(image=image)): all_ops_successful = False
            # Rotate
            if not save_image_safe(path_rotate, SEQ_ROTATE(image=image)): all_ops_successful = False
            # Bright
            if not save_image_safe(path_bright, SEQ_BRIGHT(image=image)): all_ops_successful = False
            # Dark
            if not save_image_safe(path_dark, SEQ_DARK(image=image)): all_ops_successful = False
            
        except Exception as e:
            print(f"[Critical Augmentation Error] on {source_file.name}: {e}")
            all_ops_successful = False

        # --- Safety Check: Delete Source ---
        if all_ops_successful:
            try:
                # Only delete if everything went well
                # Note: if source file IS the new file (name collision), don't delete it!
                # (Pathlib handles path comparison cleanly)
                if source_file.resolve() != path_original.resolve():
                    source_file.unlink()
            except OSError as e:
                print(f"[Warning] Could not delete source file {source_file.name}: {e}")
        else:
            print(f"[Warning] Kept source file {source_file.name} due to errors in processing.")

        next_index += 1
        count += 1
        if count % 10 == 0:
            print(f"    Processed {count} images...")

    print(f"  Completed {category_name}. Success: {count}/{len(files_to_process)}")

def main():
    print("Starting Safe Incremental Augmentation Script...")
    print(f"Base Directory: {DATASET_PATH}")
    
    if not DATASET_PATH.exists():
        print(f"Error: Base directory does not exist: {DATASET_PATH}")
        return

    for category in CATEGORIES:
        folder_full_path = DATASET_PATH / category
        process_category(category, folder_full_path)
        
    print("\nAll done! Script finished successfully.")

if __name__ == "__main__":
    main()
