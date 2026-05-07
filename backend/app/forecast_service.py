"""
forecast_service.py — MangoGuard forecasting model loader and inference runner.

Mirrors the pattern used in cloud_scan_service.py.

Place your trained TFLite model at:
    backend/app/ml_models/forecast_model.tflite

If the file is absent, the placeholder model is used (always returns Stable).

Input:  list of 24 dicts — [{"temperature": float, "humidity": float}, ...]
Output: {
    "label":       str,   # "High_Anthracnose_Risk" | "High_Mildew_Risk" | "Stable"
    "confidence":  float, # [0..1]
    "scores": {
        "High_Anthracnose_Risk": float,
        "High_Mildew_Risk":      float,
        "Stable":                float,
    },
    "model_loaded": bool,
}
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

# ── Optional heavy deps (same guard style as cloud_scan_service.py) ───────────
try:
    import numpy as np

    tflite_interpreter_class = None
    try:
        import tensorflow.lite as _tflite
        tflite_interpreter_class = _tflite.Interpreter
    except Exception:
        pass

    if tflite_interpreter_class is None:
        try:
            from tflite_runtime.interpreter import Interpreter
            tflite_interpreter_class = Interpreter
        except Exception:
            pass

    IMPORT_ERROR: Optional[Exception] = None
except Exception as exc:
    np = None  # type: ignore[assignment]
    tflite_interpreter_class = None
    IMPORT_ERROR = exc

# ── Model path ────────────────────────────────────────────────────────────────
_ML_MODELS_DIR = Path(__file__).resolve().parent / "ml_models"
MODEL_PATH = _ML_MODELS_DIR / "forecast_model.tflite"

# Output class labels — must match the order the model was trained with
FORECAST_LABELS = ["High_Anthracnose_Risk", "High_Mildew_Risk", "Stable"]

# Standard-scaler normalization parameters from the Edge Impulse training export
# (project 916176 — Raw + Standard Scaler DSP block, 48 features)
# If your model already includes normalization internally, set APPLY_SCALER = False
APPLY_SCALER = True
# Shape: (48,)  — mean for each of the 48 input features (24 × [temp, hum])
SCALER_MEAN = [
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
]
# Shape: (48,)  — scale (1/std) for each feature
SCALER_SCALE = [
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
]

# ── Module-level state ────────────────────────────────────────────────────────
_forecast_model = None
_model_loaded = False
_model_error: Optional[str] = None


# ── Placeholder (used when .tflite is absent) ─────────────────────────────────

def _placeholder_result() -> dict:
    return {
        "label": "Stable",
        "confidence": 0.99,
        "scores": {
            "High_Anthracnose_Risk": 0.005,
            "High_Mildew_Risk": 0.005,
            "Stable": 0.99,
        },
        "model_loaded": False,
    }


# ── Softmax helper ────────────────────────────────────────────────────────────

def _softmax(x):
    e = np.exp(x - np.max(x))
    return e / e.sum()


# ── Load ──────────────────────────────────────────────────────────────────────

def load_forecast_model():
    """Load the TFLite forecasting model. Called once on startup."""
    global _forecast_model, _model_loaded, _model_error

    if IMPORT_ERROR is not None:
        _model_error = f"numpy/tflite unavailable: {IMPORT_ERROR}"
        print(f"[forecast_service] WARNING — {_model_error}. Using placeholder.")
        return

    if not MODEL_PATH.exists():
        _model_error = f"Model file not found: {MODEL_PATH}"
        print(f"[forecast_service] WARNING — {_model_error}. Using placeholder.")
        return

    if tflite_interpreter_class is None:
        _model_error = "TensorFlow Lite runtime not available."
        print(f"[forecast_service] WARNING — {_model_error}. Using placeholder.")
        return

    try:
        interpreter = tflite_interpreter_class(model_path=str(MODEL_PATH))
        interpreter.allocate_tensors()
        _forecast_model = interpreter
        _model_loaded = True
        _model_error = None
        print(f"[forecast_service] Loaded forecast model from {MODEL_PATH}")
    except Exception as exc:
        _model_error = f"Failed to load forecast model: {exc}"
        print(f"[forecast_service] ERROR — {_model_error}. Using placeholder.")


def get_forecast_model_status() -> dict:
    return {
        "loaded": _model_loaded,
        "path": str(MODEL_PATH),
        "error": _model_error,
    }


# ── Inference ─────────────────────────────────────────────────────────────────

def run_forecast(readings: list[dict]) -> dict:
    """
    Run forecasting inference on 24 hourly readings.

    Args:
        readings: list of 24 dicts with keys "temperature" and "humidity".

    Returns:
        dict with keys: label, confidence, scores, model_loaded.
    """
    if not _model_loaded or _forecast_model is None or np is None:
        return _placeholder_result()

    # Build flat feature vector: [t0, h0, t1, h1, ..., t23, h23]
    features = []
    for r in readings:
        features.append(float(r.get("temperature", 25.0)))
        features.append(float(r.get("humidity", 68.0)))

    features_array = np.array(features, dtype=np.float32)

    # Apply standard scaler normalization if required
    if APPLY_SCALER and len(SCALER_MEAN) == len(features_array):
        mean = np.array(SCALER_MEAN, dtype=np.float32)
        scale = np.array(SCALER_SCALE, dtype=np.float32)
        features_array = (features_array - mean) * scale

    try:
        input_details = _forecast_model.get_input_details()
        output_details = _forecast_model.get_output_details()

        # Reshape to (1, 48) or whatever shape the model expects
        input_shape = input_details[0]["shape"]
        input_data = features_array.reshape(input_shape).astype(input_details[0]["dtype"])

        _forecast_model.set_tensor(input_details[0]["index"], input_data)
        _forecast_model.invoke()
        raw_output = _forecast_model.get_tensor(output_details[0]["index"])[0]

    except Exception as exc:
        print(f"[forecast_service] Inference error: {exc}. Returning placeholder.")
        return _placeholder_result()

    # Convert to probabilities
    probabilities = _softmax(np.array(raw_output, dtype=np.float32))

    best_idx = int(np.argmax(probabilities))
    label = FORECAST_LABELS[best_idx] if best_idx < len(FORECAST_LABELS) else "Stable"
    confidence = float(probabilities[best_idx])

    scores = {
        FORECAST_LABELS[i]: float(probabilities[i])
        for i in range(min(len(FORECAST_LABELS), len(probabilities)))
    }

    return {
        "label": label,
        "confidence": confidence,
        "scores": scores,
        "model_loaded": True,
    }
