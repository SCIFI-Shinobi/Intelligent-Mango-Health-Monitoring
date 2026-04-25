from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any

from .disease_labels import class_name_from_index, normalize_disease_type

try:
    import numpy as np
    from PIL import Image
    import tensorflow as tf
except Exception as exc:  # pragma: no cover - optional runtime dependency
    np = None
    Image = None
    tf = None
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None


MODEL_PATH = Path(__file__).resolve().parent / "ml_models" / "efficientnet_mango_leaf.h5"
DEFAULT_INPUT_SHAPE = (224, 224, 3)

cloud_model = None
cloud_model_error = None
cloud_model_input_shape = DEFAULT_INPUT_SHAPE


def _extract_input_shape(model: Any) -> tuple[int, int, int]:
    raw_shape = model.input_shape[0] if isinstance(model.input_shape, list) else model.input_shape
    if not raw_shape or len(raw_shape) < 4:
        return DEFAULT_INPUT_SHAPE

    height = int(raw_shape[1] or DEFAULT_INPUT_SHAPE[0])
    width = int(raw_shape[2] or DEFAULT_INPUT_SHAPE[1])
    channels = int(raw_shape[3] or DEFAULT_INPUT_SHAPE[2])
    return (height, width, channels)


def _normalize_legacy_layer_config(layer_config: dict[str, Any]) -> None:
    class_name = layer_config.get("class_name")
    config = layer_config.get("config")
    if not isinstance(config, dict):
        return

    axis = config.get("axis")
    if class_name in {"BatchNormalization", "Normalization"} and isinstance(axis, list) and len(axis) == 1:
        config["axis"] = axis[0]

    if class_name == "DepthwiseConv2D":
        config.pop("groups", None)


def _normalize_legacy_model_config(value: Any) -> None:
    if isinstance(value, dict):
        if "class_name" in value and "config" in value:
            _normalize_legacy_layer_config(value)
        for nested_value in value.values():
            _normalize_legacy_model_config(nested_value)
        return

    if isinstance(value, list):
        for nested_value in value:
            _normalize_legacy_model_config(nested_value)


def _build_layer_from_config(layer_config: dict[str, Any]):
    class_name = layer_config.get("class_name")
    config = layer_config.get("config")
    if not class_name or not isinstance(config, dict):
        raise ValueError("Legacy Edge Impulse layer config is incomplete")

    layer_class = getattr(tf.keras.layers, class_name, None)
    if layer_class is None:
        raise ValueError(f"Unsupported legacy Edge Impulse layer type: {class_name}")

    return layer_class.from_config(config)


def _unwrap_single_output(output: Any) -> Any:
    if isinstance(output, list):
        if len(output) != 1:
            raise ValueError(f"Expected a single model output, received {len(output)}")
        return output[0]
    return output


def _load_legacy_edge_impulse_h5_model(model_path: Path):
    try:
        import h5py
    except Exception as exc:  # pragma: no cover - depends on optional runtime package
        raise RuntimeError(f"Legacy Edge Impulse fallback requires h5py: {exc}") from exc

    with h5py.File(model_path, "r") as h5_file:
        raw_model_config = h5_file.attrs.get("model_config")

    if raw_model_config is None:
        raise ValueError("H5 model is missing a model_config attribute")

    if isinstance(raw_model_config, bytes):
        raw_model_config = raw_model_config.decode("utf-8")

    model_config = json.loads(raw_model_config)
    _normalize_legacy_model_config(model_config)

    top_level_config = model_config.get("config")
    if not isinstance(top_level_config, dict):
        raise ValueError("Legacy Edge Impulse model config is malformed")

    sequence_layers = top_level_config.get("layers")
    if model_config.get("class_name") != "Sequential" or not isinstance(sequence_layers, list) or len(sequence_layers) < 2:
        raise ValueError("Unsupported Edge Impulse H5 layout; expected a Sequential wrapper")

    input_config = sequence_layers[0].get("config") or {}
    input_shape = input_config.get("batch_input_shape") or [None, *DEFAULT_INPUT_SHAPE]
    if len(input_shape) < 4:
        raise ValueError("Legacy Edge Impulse input shape is missing channel dimensions")

    input_height = int(input_shape[1] or DEFAULT_INPUT_SHAPE[0])
    input_width = int(input_shape[2] or DEFAULT_INPUT_SHAPE[1])
    input_channels = int(input_shape[3] or DEFAULT_INPUT_SHAPE[2])

    backbone_config = sequence_layers[1].get("config")
    if not isinstance(backbone_config, dict):
        raise ValueError("Legacy Edge Impulse backbone config is missing")

    backbone = tf.keras.Model.from_config(backbone_config)
    inputs = tf.keras.Input(
        shape=(input_height, input_width, input_channels),
        name=input_config.get("name") or "x_input",
    )
    x = _unwrap_single_output(backbone(inputs))

    for layer_config in sequence_layers[2:]:
        x = _build_layer_from_config(layer_config)(x)

    model = tf.keras.Model(inputs, x, name=top_level_config.get("name") or model_path.stem)
    model.load_weights(str(model_path), by_name=True, skip_mismatch=False)
    return model


def load_cloud_scan_model():
    global cloud_model, cloud_model_error, cloud_model_input_shape

    if IMPORT_ERROR is not None:
        cloud_model = None
        cloud_model_error = f"Cloud scan dependencies are unavailable: {IMPORT_ERROR}"
        return None

    if not MODEL_PATH.exists():
        cloud_model = None
        cloud_model_error = f"Cloud scan model not found at {MODEL_PATH}"
        cloud_model_input_shape = DEFAULT_INPUT_SHAPE
        return None

    try:
        cloud_model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    except Exception as primary_exc:  # pragma: no cover - depends on runtime model format
        try:
            cloud_model = _load_legacy_edge_impulse_h5_model(MODEL_PATH)
        except Exception as fallback_exc:
            cloud_model = None
            cloud_model_input_shape = DEFAULT_INPUT_SHAPE
            cloud_model_error = (
                "Cloud scan model could not be loaded. "
                f"Standard Keras load failed: {primary_exc}. "
                f"Legacy Edge Impulse fallback failed: {fallback_exc}"
            )
            return None

    cloud_model_input_shape = _extract_input_shape(cloud_model)
    cloud_model_error = None
    return cloud_model


def get_cloud_model_status() -> dict:
    height, width, channels = cloud_model_input_shape
    return {
        "loaded": cloud_model is not None,
        "path": str(MODEL_PATH),
        "input_shape": [height, width, channels],
        "preprocessing": {
            "resize": [width, height],
            "normalization_range": [0.0, 1.0],
        },
        "error": cloud_model_error,
    }


def _prepare_image_bytes(image_bytes: bytes):
    if Image is None or np is None:
        raise RuntimeError(cloud_model_error or "Cloud scan dependencies are unavailable")

    if cloud_model is None:
        raise RuntimeError(cloud_model_error or "Cloud scan model is not loaded")

    height, width, _channels = cloud_model_input_shape
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((width, height))
    image_array = np.asarray(image, dtype=np.float32) / 255.0
    return np.expand_dims(image_array, axis=0)


def _to_probabilities(raw_scores):
    scores = np.asarray(raw_scores, dtype=np.float32).reshape(-1)
    if np.any(scores < 0) or float(scores.sum()) > 1.0001:
        exp_scores = np.exp(scores - np.max(scores))
        scores = exp_scores / np.sum(exp_scores)
    return scores


def run_cloud_scan_inference(image_bytes: bytes) -> dict:
    if cloud_model is None:
        raise RuntimeError(cloud_model_error or "Cloud scan model is not loaded")

    batch = _prepare_image_bytes(image_bytes)
    predictions = cloud_model.predict(batch, verbose=0)
    predictions = predictions[0] if getattr(predictions, "ndim", 1) > 1 else predictions
    probabilities = _to_probabilities(predictions)

    best_index = int(np.argmax(probabilities))
    disease_type = normalize_disease_type(class_name_from_index(best_index))

    return {
        "disease_type": disease_type,
        "confidence_score": float(probabilities[best_index]),
        "class_scores": {
            normalize_disease_type(class_name_from_index(idx)): float(score)
            for idx, score in enumerate(probabilities.tolist())
        },
        "model_path": str(MODEL_PATH),
        "input_shape": list(cloud_model_input_shape),
        "preprocessing": {
            "resize": [cloud_model_input_shape[1], cloud_model_input_shape[0]],
            "normalization_range": [0.0, 1.0],
        },
    }
