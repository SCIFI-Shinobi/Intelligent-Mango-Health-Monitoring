#!/usr/bin/env python3
"""Test TFLite model shape extraction."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.cloud_scan_service import (
    _load_tflite_model,
    _extract_tflite_input_shape,
    MODEL_PATH_TFLITE,
    load_cloud_scan_model,
    get_cloud_model_status,
)

def test_tflite_shape():
    """Test extracting the actual input shape from TFLite model."""
    print(f"Testing TFLite model at: {MODEL_PATH_TFLITE}")
    print(f"Model exists: {MODEL_PATH_TFLITE.exists()}")
    
    if not MODEL_PATH_TFLITE.exists():
        print("ERROR: Model file not found!")
        return False
    
    try:
        print("\n1. Loading TFLite model...")
        interpreter = _load_tflite_model(MODEL_PATH_TFLITE)
        print("   ✓ Model loaded successfully")
        
        print("\n2. Extracting input shape...")
        shape = _extract_tflite_input_shape(interpreter)
        print(f"   ✓ Input shape: {shape} (height={shape[0]}, width={shape[1]}, channels={shape[2]})")
        
        print("\n3. Loading model via load_cloud_scan_model()...")
        model = load_cloud_scan_model()
        status = get_cloud_model_status()
        print(f"   ✓ Model loaded")
        print(f"   ✓ Model status: {status}")
        
        if shape[0] == 160 and shape[1] == 160:
            print("\n✓ SUCCESS: Model correctly identifies 160x160 input size!")
            return True
        else:
            print(f"\n✗ WARNING: Expected 160x160 but got {shape[0]}x{shape[1]}")
            return False
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_tflite_shape()
    sys.exit(0 if success else 1)
