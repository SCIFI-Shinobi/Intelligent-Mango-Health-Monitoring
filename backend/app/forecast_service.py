"""
forecast_service.py — MangoGuard forecasting using the Edge Impulse Linux runner.

Uses the official edge-impulse-linux SDK to run the .eim model exported from
Edge Impulse, which natively supports tree-ensemble custom ops.

Place your .eim model at:
    backend/app/ml_models/forecast_model.eim

If the file is absent or the SDK is unavailable, a placeholder is used.

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

import os
import stat
from pathlib import Path
from typing import Optional

# ── Optional deps ─────────────────────────────────────────────────────────────
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except Exception:
    np = None  # type: ignore[assignment]
    NUMPY_AVAILABLE = False

try:
    # Mock cv2 and pyaudio because edge_impulse_linux imports them, which fails on Render native env
    import sys
    from unittest.mock import MagicMock
    if 'cv2' not in sys.modules:
        sys.modules['cv2'] = MagicMock()
    if 'pyaudio' not in sys.modules:
        sys.modules['pyaudio'] = MagicMock()
        
    from edge_impulse_linux.runner import ImpulseRunner
    EI_AVAILABLE = True
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"[forecast_service] Failed to import edge_impulse_linux: {e}")
    ImpulseRunner = None  # type: ignore[assignment]
    EI_AVAILABLE = False

# ── Model path ────────────────────────────────────────────────────────────────
_ML_MODELS_DIR = Path(__file__).resolve().parent / "ml_models"
MODEL_PATH_EIM   = _ML_MODELS_DIR / "forecast_model.eim"
MODEL_PATH_TFLITE = _ML_MODELS_DIR / "forecast_model.tflite"  # kept for reference only

# Output class labels — must match the order Edge Impulse trained with
FORECAST_LABELS = ["High_Anthracnose_Risk", "High_Mildew_Risk", "Stable"]

# ── Module-level state ────────────────────────────────────────────────────────
_runner: Optional[object] = None   # ImpulseRunner instance
_model_loaded = False
_model_error: Optional[str] = None
_ei_labels: list[str] = []         # labels as reported by the model itself


# ── Placeholder ───────────────────────────────────────────────────────────────

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


# ── Load ──────────────────────────────────────────────────────────────────────

def load_forecast_model():
    """Load the Edge Impulse .eim forecasting model. Called once on startup."""
    global _runner, _model_loaded, _model_error, _ei_labels

    if not EI_AVAILABLE:
        _model_error = (
            "edge-impulse-linux SDK not installed. "
            "Add 'edge_impulse_linux' to requirements.txt."
        )
        print(f"[forecast_service] WARNING — {_model_error}. Using placeholder.")
        return

    if not MODEL_PATH_EIM.exists():
        if MODEL_PATH_TFLITE.exists():
            _model_error = (
                "forecast_model.eim not found. "
                "A .tflite file exists but cannot run TreeEnsembleClassifier ops "
                "with standard tflite-runtime. Export as Linux (x86_64) from Edge "
                "Impulse and place at backend/app/ml_models/forecast_model.eim."
            )
        else:
            _model_error = f"Model file not found: {MODEL_PATH_EIM}"
        print(f"[forecast_service] WARNING — {_model_error}. Using placeholder.")
        return

    try:
        # Ensure the .eim file is executable (required by the runner)
        eim_path = str(MODEL_PATH_EIM)
        current_mode = os.stat(eim_path).st_mode
        os.chmod(eim_path, current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

        runner = ImpulseRunner(eim_path)
        model_info = runner.init()

        # Grab the label list reported by the model itself
        _ei_labels = model_info.get("model_parameters", {}).get("labels", FORECAST_LABELS)

        _runner = runner
        _model_loaded = True
        _model_error = None
        print(f"[forecast_service] Loaded Edge Impulse .eim model from {MODEL_PATH_EIM}")
        print(f"[forecast_service]   labels={_ei_labels}")
    except Exception as exc:
        _model_error = f"Failed to load .eim forecast model: {exc}"
        print(f"[forecast_service] ERROR — {_model_error}. Using placeholder.")


def get_forecast_model_status() -> dict:
    return {
        "loaded": _model_loaded,
        "path": str(MODEL_PATH_EIM),
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
    if not _model_loaded or _runner is None:
        return _placeholder_result()

    # Build flat feature list: [t0, h0, t1, h1, ..., t23, h23]
    features = []
    for r in readings:
        features.append(float(r.get("temperature", 25.0)))
        features.append(float(r.get("humidity",    68.0)))

    # Pad or trim to exactly 48 features (24 readings × 2)
    while len(features) < 48:
        features.extend([25.0, 68.0])
    features = features[:48]

    try:
        result = _runner.classify(features)
    except Exception as exc:
        print(f"[forecast_service] Inference error: {exc}. Returning placeholder.")
        return _placeholder_result()

    # result["result"]["classification"] → {"High_Anthracnose_Risk": 0.x, ...}
    classification = result.get("result", {}).get("classification", {})

    if not classification:
        print("[forecast_service] Empty classification result. Returning placeholder.")
        return _placeholder_result()

    # Find the winning label
    best_label = max(classification, key=classification.get)
    confidence = float(classification[best_label])

    # Normalise label names to our standard set
    scores = {}
    for label in FORECAST_LABELS:
        # Try exact match first, then case-insensitive
        if label in classification:
            scores[label] = float(classification[label])
        else:
            matched = next(
                (v for k, v in classification.items() if k.lower() == label.lower()),
                0.0,
            )
            scores[label] = float(matched)

    # Map best_label to our standard label if needed
    standard_label = best_label
    for std in FORECAST_LABELS:
        if std.lower() == best_label.lower():
            standard_label = std
            break

    return {
        "label":        standard_label,
        "confidence":   confidence,
        "scores":       scores,
        "model_loaded": True,
    }


def close_forecast_model():
    """Release the runner process. Call on app shutdown if needed."""
    global _runner, _model_loaded
    if _runner is not None:
        try:
            _runner.stop()
        except Exception:
            pass
        _runner = None
        _model_loaded = False
