#!/bin/bash
# Build WASM module and copy to public directory

set -e

echo "Building WASM module..."
cd wasm
wasm-pack build --target web --out-dir pkg

echo "Copying WASM files to public..."
mkdir -p ../public
cp pkg/yt_subtitle_wasm_bg.wasm ../public/

echo "Updating WASM loader..."
cat pkg/yt_subtitle_wasm.js | sed 's/import\.meta\.url/""/g' > ../app/lib/wasm_loader.js

echo "WASM build complete!"
