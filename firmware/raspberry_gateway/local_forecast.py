import os
import stat
from typing import List, Dict

try:
    import sys
    from unittest.mock import MagicMock
    if 'cv2' not in sys.modules:
        sys.modules['cv2'] = MagicMock()
    if 'pyaudio' not in sys.modules:
        sys.modules['pyaudio'] = MagicMock()

    from edge_impulse_linux.runner import ImpulseRunner
    EI_AVAILABLE = True
except ImportError as e:
    print(f"DEBUG: ImportError details: {e}")
    EI_AVAILABLE = False

try:
    import tflite_runtime.interpreter as tflite
    TFLITE_AVAILABLE = True
except ImportError:
    try:
        import tensorflow.lite as tflite
        TFLITE_AVAILABLE = True
    except ImportError:
        TFLITE_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

_runner = None
_tflite_interpreter = None
_tflite_input_details = None
_tflite_output_details = None
_model_loaded = False
_model_type = None

# Always resolve model paths relative to this script file, not the working directory
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH_EIM = os.path.join(_SCRIPT_DIR, "model.eim")
MODEL_PATH_TFLITE = os.path.join(_SCRIPT_DIR, "model.tflite")

# If model.eim doesn't exist, auto-detect any .eim file in the same directory
if not os.path.exists(MODEL_PATH_EIM):
    _eim_candidates = [f for f in os.listdir(_SCRIPT_DIR) if f.endswith('.eim')]
    if _eim_candidates:
        MODEL_PATH_EIM = os.path.join(_SCRIPT_DIR, _eim_candidates[0])
        print(f"[Local Forecast] Auto-detected EIM model: {_eim_candidates[0]}")

_runner = None
_model_loaded = False
MODEL_PATH = MODEL_PATH_EIM  # Keep for backwards compatibility

FORECAST_LABELS = ["High_Anthracnose_Risk", "High_Mildew_Risk", "Stable"]

def load_model():
    global _runner, _tflite_interpreter, _tflite_input_details, _tflite_output_details, _model_loaded, _model_type
    
    # Try TFLite first if the file exists
    if os.path.exists(MODEL_PATH_TFLITE):
        if not TFLITE_AVAILABLE or not NUMPY_AVAILABLE:
            print("[Local Forecast] tflite_runtime or numpy not installed. Cannot load .tflite.")
            return False
        try:
            _tflite_interpreter = tflite.Interpreter(model_path=MODEL_PATH_TFLITE)
            _tflite_interpreter.allocate_tensors()
            _tflite_input_details = _tflite_interpreter.get_input_details()
            _tflite_output_details = _tflite_interpreter.get_output_details()
            _model_loaded = True
            _model_type = "tflite"
            print("[Local Forecast] TFLite model loaded successfully.")
            return True
        except Exception as e:
            print(f"[Local Forecast] Error loading TFLite model: {e}")
            return False

    # Fallback to EIM
    elif os.path.exists(MODEL_PATH_EIM):
        if not EI_AVAILABLE:
            print("[Local Forecast] edge_impulse_linux not installed.")
            return False
        try:
            current_mode = os.stat(MODEL_PATH_EIM).st_mode
            os.chmod(MODEL_PATH_EIM, current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            
            _runner = ImpulseRunner(MODEL_PATH_EIM)
            _runner.init()
            _model_loaded = True
            _model_type = "eim"
            print("[Local Forecast] EIM model loaded successfully.")
            return True
        except Exception as e:
            print(f"[Local Forecast] Error loading EIM model: {e}")
            return False
            
    else:
        print("[Local Forecast] No model found (checked model.tflite and model.eim).")
        return False

def run_forecast(readings: List[Dict]) -> str:
    """
    Run the Edge Impulse forecasting model on a window of sensor readings.

    Args:
        readings: List of exactly 24 dicts, each with keys "temperature" (float)
                  and "humidity" (float), representing one hourly reading.
                  The model was trained on 24-hour windows — passing fewer
                  readings will trigger internal padding which may reduce accuracy.

    Returns:
        One of: "High_Anthracnose_Risk", "High_Mildew_Risk", "Stable",
                "Model not loaded", "Error", or "Unknown".
    """
    if not _model_loaded:
        return "Model not loaded"
        
    features = []
    for r in readings:
        features.append(float(r.get("temperature", 25.0)))
        features.append(float(r.get("humidity", 68.0)))
        
    if len(features) > 0:
        original_features = features[:]
        while len(features) < 48:
            features.extend(original_features)
    else:
        features = [25.0, 68.0] * 24
        
    features = features[:48]
    
    if _model_type == "tflite":
        try:
            input_shape = _tflite_input_details[0]['shape']
            input_data = np.array(features, dtype=np.float32).reshape(input_shape)
            
            _tflite_interpreter.set_tensor(_tflite_input_details[0]['index'], input_data)
            _tflite_interpreter.invoke()
            output_data = _tflite_interpreter.get_tensor(_tflite_output_details[0]['index'])[0]
            
            # Map index to label
            max_index = np.argmax(output_data)
            if max_index < len(FORECAST_LABELS):
                return FORECAST_LABELS[max_index]
            return "Unknown"
        except Exception as e:
            print(f"[Local Forecast] TFLite Inference error: {e}")
            return "Error"
            
    elif _model_type == "eim":
        try:
            result = _runner.classify(features)
            classification = result.get("result", {}).get("classification", {})
            if not classification:
                return "Unknown"
                
            best_label = max(classification, key=classification.get)
            
            standard_label = best_label
            for std in FORECAST_LABELS:
                if std.lower() == best_label.lower():
                    standard_label = std
                    break
                    
            return standard_label
        except Exception as e:
            print(f"[Local Forecast] EIM Inference error: {e}")
            return "Error"
