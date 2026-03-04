#!/usr/bin/env node
/**
 * Build WASM module and copy to public directory
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building WASM module...');

try {
  // Build WASM
  execSync('wasm-pack build --target web --out-dir pkg', {
    cwd: path.join(__dirname, 'wasm'),
    stdio: 'inherit'
  });

  // Copy WASM binary to public
  const wasmSource = path.join(__dirname, 'wasm', 'pkg', 'yt_subtitle_wasm_bg.wasm');
  const wasmDest = path.join(__dirname, 'public', 'yt_subtitle_wasm_bg.wasm');

  fs.copyFileSync(wasmSource, wasmDest);
  console.log('✓ Copied WASM binary to public/');

  // Update WASM loader (fix import.meta.url for Next.js)
  const loaderSource = path.join(__dirname, 'wasm', 'pkg', 'yt_subtitle_wasm.js');
  const loaderDest = path.join(__dirname, 'app', 'lib', 'wasm_loader.js');

  let loaderContent = fs.readFileSync(loaderSource, 'utf-8');
  // Replace import.meta.url with empty string for Next.js compatibility
  loaderContent = loaderContent.replace(
    /input\s*=\s*new URL\(.*import\.meta\.url.*\)/,
    'input = ""'
  );

  fs.writeFileSync(loaderDest, loaderContent);
  console.log('✓ Updated WASM loader');

  console.log('\nWASM build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
