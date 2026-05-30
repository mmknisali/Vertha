#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src/tts"
DIST_DIR="$PROJECT_ROOT/resources/tts-server"
BUILD_DIR="$DIST_DIR/build"

echo "=== Building TTS Server ==="
echo "Source: $SRC_DIR"
echo "Output: $DIST_DIR"

mkdir -p "$DIST_DIR"
mkdir -p "$BUILD_DIR"

cd "$SRC_DIR"

if [ ! -f "requirements.txt" ]; then
    echo "ERROR: requirements.txt not found in $SRC_DIR"
    exit 1
fi

echo "Installing dependencies..."
pip install -r requirements.txt pyinstaller --quiet

echo "Running PyInstaller..."
pyinstaller \
    --onefile \
    --name tts-server \
    --distpath "$DIST_DIR" \
    --workpath "$BUILD_DIR" \
    --specpath "$DIST_DIR" \
    --hidden-import=fastapi \
    --hidden-import=uvicorn \
    --hidden-import=uvicorn.logging \
    --hidden-import=uvicorn.protocols \
    --hidden-import=uvicorn.protocols.http \
    --hidden-import=uvicorn.protocols.http.auto \
    --hidden-import=uvicorn.lifespan \
    --hidden-import=uvicorn.lifespan.server \
    --hidden-import=httpx \
    --hidden-import=websockets \
    --hidden-import=websockets.client \
    --hidden-import=websockets.server \
    --hidden-import=piper \
    --hidden-import=numpy \
    --collect-all=piper \
    --additional-hooks-dir=. \
    server.py

echo "=== TTS Build Complete ==="
ls -la "$DIST_DIR"