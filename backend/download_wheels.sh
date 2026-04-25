#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WHEELHOUSE_DIR="$SCRIPT_DIR/wheelhouse"

mkdir -p "$WHEELHOUSE_DIR"
rm -f "$WHEELHOUSE_DIR/.complete"

docker run --rm \
  -e PIP_DISABLE_PIP_VERSION_CHECK=1 \
  -e PIP_DEFAULT_TIMEOUT=1200 \
  -v "$SCRIPT_DIR:/work" \
  -w /work \
  python:3.11-slim \
  sh -lc "pip download --retries 20 --progress-bar off --only-binary=:all: --dest wheelhouse -r requirements.txt"

touch "$WHEELHOUSE_DIR/.complete"
echo "Wheelhouse is ready at $WHEELHOUSE_DIR"
