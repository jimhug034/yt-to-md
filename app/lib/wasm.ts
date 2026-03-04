/**
 * WASM Module Loading and Binding
 *
 * This file handles loading the WebAssembly module and creating
 * JavaScript bindings for the subtitle processing functions.
 */

interface WasmLoader {
  parse_srt(input: string): string;
  parse_ttml(input: string): string;
  parse_vtt(input: string): string;
  to_markdown(captions_json: string, options_json: string): string;
  default(module_or_path: string): Promise<void>;
}

let wasmModule: WasmLoader | null = null;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module by dynamically importing the loader
 */
async function getWasmModule(): Promise<WasmLoader> {
  if (wasmModule) {
    return wasmModule;
  }

  // Dynamically import the WASM loader from the lib directory
  // @ts-ignore - Dynamic import of JS file without types
  const loader = await import('./wasm_loader.js');
  wasmModule = loader as WasmLoader;
  return wasmModule;
}

/**
 * Load the WASM module
 */
export async function loadWASM(): Promise<void> {
  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = (async () => {
    try {
      const loader = await getWasmModule();
      // Initialize with the path to the WASM file in the public directory
      await loader.default('/yt_subtitle_wasm_bg.wasm');
    } catch (error) {
      wasmInitPromise = null;
      throw new Error(`Failed to initialize WASM module: ${error}`);
    }
  })();

  return wasmInitPromise;
}

/**
 * Ensure WASM is initialized before calling any function
 */
async function ensureInitialized() {
  await loadWASM();
}

/**
 * Parse SRT format subtitle content using WASM
 */
export async function parseSRTWASM(content: string): Promise<any[]> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const result = loader.parse_srt(content);
  return JSON.parse(result);
}

/**
 * Parse TTML format subtitle content using WASM
 */
export async function parseTTMLWASM(content: string): Promise<any[]> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const result = loader.parse_ttml(content);
  return JSON.parse(result);
}

/**
 * Parse WebVTT format subtitle content using WASM
 */
export async function parseVTTWASM(content: string): Promise<any[]> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const result = loader.parse_vtt(content);
  return JSON.parse(result);
}

/**
 * Convert captions to Markdown format using WASM
 */
export async function toMarkdownWASM(
  captions: any[],
  options: {
    title?: string;
    url?: string;
    duration?: string;
  } = {}
): Promise<string> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const captionsJson = JSON.stringify(captions);
  const optionsJson = JSON.stringify(options);
  return loader.to_markdown(captionsJson, optionsJson);
}

/**
 * Parse subtitle content based on format using WASM
 */
export async function parseSubtitlesWASM(
  content: string,
  format: 'srt' | 'vtt' | 'ttml'
): Promise<any[]> {
  switch (format) {
    case 'srt':
      return parseSRTWASM(content);
    case 'vtt':
      return parseVTTWASM(content);
    case 'ttml':
      return parseTTMLWASM(content);
    default:
      throw new Error(`Unsupported subtitle format: ${format}`);
  }
}

/**
 * Cleanup WASM resources (if needed)
 */
export function cleanupWASM(): void {
  wasmModule = null;
  wasmInitPromise = null;
}

/**
 * Check if WASM is supported in the current browser
 */
export function isWASMSupported(): boolean {
  return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
}

/**
 * Get WASM feature support information
 */
export interface WASMFeatures {
  supported: boolean;
  streaming: boolean;
  threads: boolean;
  simd: boolean;
  exceptions: boolean;
}

export function getWASMFeatures(): WASMFeatures {
  return {
    supported: isWASMSupported(),
    streaming: typeof WebAssembly.instantiateStreaming === 'function',
    threads: false, // Requires SharedArrayBuffer which needs specific headers
    simd: false, // Check WebAssembly SIMD support
    exceptions: false, // Check WebAssembly exceptions support
  };
}
