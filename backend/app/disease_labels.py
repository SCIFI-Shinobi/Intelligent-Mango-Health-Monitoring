from __future__ import annotations

from typing import Optional


CLOUD_SCAN_CLASS_ORDER = [
    "Anthracnose",
    "Healthy",
    "Powdery Mildew",
]


_CANONICAL_LABELS = {
    "healthy": "Healthy",
    "anthracnose": "Anthracnose",
    "powderymildew": "Powdery Mildew",
}


def _collapse_label(raw_value: Optional[str]) -> str:
    if not raw_value:
        return ""

    normalized = raw_value.strip().replace("_", " ").replace("-", " ")
    normalized = " ".join(normalized.split())
    return normalized


def normalize_disease_type(raw_value: Optional[str]) -> str:
    normalized = _collapse_label(raw_value)
    lowered = normalized.lower().replace(" ", "")

    if not lowered:
        return "Unknown"

    return _CANONICAL_LABELS.get(lowered, normalized)


def class_name_from_index(index: int) -> str:
    if index < 0 or index >= len(CLOUD_SCAN_CLASS_ORDER):
        raise IndexError(f"Unknown cloud scan class index: {index}")
    return CLOUD_SCAN_CLASS_ORDER[index]
