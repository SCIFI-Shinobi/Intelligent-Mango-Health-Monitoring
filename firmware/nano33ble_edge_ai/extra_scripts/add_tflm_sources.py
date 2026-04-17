Import("env")
import os

# List of missing source files to add
missing_sources = [
    "lib/edge-impulse-sdk/tensorflow/lite/core/api/common.cc",
    "lib/edge-impulse-sdk/tensorflow/lite/kernels/internal/portable_tensor_utils.cc",
    "lib/edge-impulse-sdk/tensorflow/lite/micro/kernels/reduce_common.cc",
]

for src in missing_sources:
    if os.path.exists(src):
        env.Append(SRC_EXTRA=[src])
    else:
        print(f"Warning: {src} not found!")
