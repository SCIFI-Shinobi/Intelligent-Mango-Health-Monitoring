"""
forecast_service.py — MangoGuard forecasting model loader and inference runner.

Uses ONNX Runtime instead of TFLite so that Edge Impulse tree-ensemble models
(TreeEnsembleClassifier) are supported on the server without custom TFLite builds.

Export your Edge Impulse forecast model as ONNX and place it at:
    backend/app/ml_models/forecast_model.onnx

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

# ── Optional heavy deps ───────────────────────────────────────────────────────
try:
    import numpy as np
    IMPORT_ERROR: Optional[Exception] = None
except Exception as exc:
    np = None  # type: ignore[assignment]
    IMPORT_ERROR = exc

try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except Exception:
    ort = None  # type: ignore[assignment]
    ONNX_AVAILABLE = False

# ── Model paths ───────────────────────────────────────────────────────────────
_ML_MODELS_DIR = Path(__file__).resolve().parent / "ml_models"
MODEL_PATH_ONNX  = _ML_MODELS_DIR / "forecast_model.onnx"
MODEL_PATH_TFLITE = _ML_MODELS_DIR / "forecast_model.tflite"  # kept for reference

# Output class labels — must match the order the model was trained with
FORECAST_LABELS = ["High_Anthracnose_Risk", "High_Mildew_Risk", "Stable"]

# Standard-scaler normalization parameters from the Edge Impulse training export
# If your ONNX model already includes the scaler internally, set APPLY_SCALER = False
APPLY_SCALER = True
# Shape: (48,) — mean for each of the 48 input features (24 × [temp, hum])
SCALER_MEAN = [
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
    25.0, 68.0, 25.0, 68.0, 25.0, 68.0, 25.0, 68.0,
]
# Shape: (48,) — scale (1/std) for each feature
SCALER_SCALE = [
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
    0.2, 0.02, 0.2, 0.02, 0.2, 0.02, 0.2, 0.02,
]

# ── Module-level state ────────────────────────────────────────────────────────
_forecast_session = None   # onnxruntime.InferenceSession
_model_loaded = False
_model_error: Optional[str] = None
_input_name: Optional[str] = None
_output_name: Optional[str] = None


# ── Placeholder (used when model is absent or fails to load) ──────────────────

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


# ── Softmax helper (for raw logit outputs) ────────────────────────────────────

def _softmax(x):
    e = np.exp(x - np.max(x))
    return e / e.sum()


# ── Load ──────────────────────────────────────────────────────────────────────

def load_forecast_model():
    """Load the ONNX forecasting model. Called once on startup."""
    global _forecast_session, _model_loaded, _model_error, _input_name, _output_name

    if IMPORT_ERROR is not None:
        _model_error = f"numpy unavailable: {IMPORT_ERROR}"
        print(f"[forecast_service] WARNING — {_model_error}. Using placeholder.")
        return

    if not ONNX_AVAILABLE:
        _model_error = (
            "onnxruntime is not installed. "
            "Add 'onnxruntime' to requirements.txt and redeploy."
        )
        print(f"[forecast_service] WARNING — {_model_error}. Using placeholder.")
        return

    if not MODEL_PATH_ONNX.exists():
        if MODEL_PATH_TFLITE.exists():
            _model_error = (
                f"forecast_model.onnx not found at {MODEL_PATH_ONNX}. "
                "A .tflite file exists but cannot be used on the server because it "
                "contains the TreeEnsembleClassifier custom op which is not supported "
                "by tflite-runtime. Export your Edge Impulse model as ONNX and place "
                "it at backend/app/ml_models/forecast_model.onnx."
            )
        else:
            _model_error = f"Model file not found: {MODEL_PATH_ONNX}"
        print(f"[forecast_service] WARNING — {_model_error}. Using placeholder.")
        return

    try:
        session = ort.InferenceSession(
            str(MODEL_PATH_ONNX),
            providers=["CPUExecutionProvider"],
        )
        _input_name  = session.get_inputs()[0].name
        _output_name = session.get_outputs()[0].name
        _forecast_session = session
        _model_loaded = True
        _model_error  = None
        print(f"[forecast_service] Loaded ONNX forecast model from {MODEL_PATH_ONNX}")
        print(f"[forecast_service]   input='{_input_name}'  output='{_output_name}'")
    except Exception as exc:
        _model_error = f"Failed to load ONNX forecast model: {exc}"
        print(f"[forecast_service] ERROR — {_model_error}. Using placeholder.")


def get_forecast_model_status() -> dict:
    return {
        "loaded": _model_loaded,
        "path": str(MODEL_PATH_ONNX),
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
    if not _model_loaded or _forecast_session is None or np is None:
        return _placeholder_result()

    # Build flat feature vector: [t0, h0, t1, h1, ..., t23, h23]
    features = []
    for r in readings:
        features.append(float(r.get("temperature", 25.0)))
        features.append(float(r.get("humidity",    68.0)))

    # Pad or trim to exactly 48 features
    while len(features) < 48:
        features.extend([25.0, 68.0])
    features = features[:48]

    features_array = np.array(features, dtype=np.float32)

    # Apply standard scaler normalization if required
    if APPLY_SCALER and len(SCALER_MEAN) == len(features_array):
        mean  = np.array(SCALER_MEAN,  dtype=np.float32)
        scale = np.array(SCALER_SCALE, dtype=np.float32)
        features_array = (features_array - mean) * scale

    # Reshape to (1, 48)
    input_data = features_array.reshape(1, -1)

    try:
        raw_output = _forecast_session.run(
            [_output_name],
            {_input_name: input_data},
        )[0][0]
    except Exception as exc:
        print(f"[forecast_service] Inference error: {exc}. Returning placeholder.")
        return _placeholder_result()

    # Convert to probabilities (handle both raw logits and pre-softmaxed outputs)
    raw = np.array(raw_output, dtype=np.float32)
    if raw.sum() < 0.99 or raw.sum() > 1.01:
        # Looks like raw logits — apply softmax
        probabilities = _softmax(raw)
    else:
        probabilities = raw

    best_idx   = int(np.argmax(probabilities))
    label      = FORECAST_LABELS[best_idx] if best_idx < len(FORECAST_LABELS) else "Stable"
    confidence = float(probabilities[best_idx])

    scores = {
        FORECAST_LABELS[i]: float(probabilities[i])
        for i in range(min(len(FORECAST_LABELS), len(probabilities)))
    }

    return {
        "label":        label,
        "confidence":   confidence,
        "scores":       scores,
        "model_loaded": True,
    }
