/**
 * WASM Module Loading and Binding
 *
 * This file handles loading the WebAssembly module and creating
 * JavaScript bindings for the subtitle processing functions.
 */

interface WasmLoader {
  // Original functions
  parse_srt(input: string): string;
  parse_ttml(input: string): string;
  parse_vtt(input: string): string;
  to_markdown(captions_json: string, options_json: string): string;
  default(module_or_path: string): Promise<void>;

  // New video processing functions
  AudioProcessor: new (sample_rate: number, channels: number) => any;
  SpeechRecognizer: new (language: string) => any;
  FrameExtractor: new (interval: number) => any;
  OcrProcessor: new (language: string) => any;
  Summarizer: new (max_sentences: number) => any;
  Chapterizer: new (min_duration: number, silence_threshold: number) => any;
  TextProcessor: any;
  MarkdownGenerator: new (include_timestamps: boolean, include_images: boolean, include_chapters: boolean) => any;
  PptxGenerator: new (title: string, author: string) => any;
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
  const loader = await import("./wasm_loader.js");
  // @ts-ignore - Type mismatch
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
      await loader.default("/yt_subtitle_wasm_bg.wasm");
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
  } = {},
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
  format: "srt" | "vtt" | "ttml",
): Promise<any[]> {
  switch (format) {
    case "srt":
      return parseSRTWASM(content);
    case "vtt":
      return parseVTTWASM(content);
    case "ttml":
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
  return typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
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
    streaming: typeof WebAssembly.instantiateStreaming === "function",
    threads: false, // Requires SharedArrayBuffer which needs specific headers
    simd: false, // Check WebAssembly SIMD support
    exceptions: false, // Check WebAssembly exceptions support
  };
}

// ============================================
// New Video Processing Types
// ============================================

export type JobStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface VideoJob {
  id: string;
  source_url: string | null;
  file_name: string;
  duration: number;
  width: number;
  height: number;
  created_at: number;
  status: JobStatus;
  progress: number;
  error_message: string | null;
}

export interface TranscriptSegment {
  id: string;
  job_id: string;
  start_time: number;
  end_time: number;
  text: string;
  confidence: number;
}

export interface KeyFrame {
  id: string;
  job_id: string;
  timestamp: number;
  image_data: number[];
  ocr_text: string | null;
  chapter_id: string | null;
}

export interface Chapter {
  id: string;
  job_id: string;
  title: string;
  start_time: number;
  end_time: number;
  summary: string;
}

export interface ProcessingOptions {
  extract_audio?: boolean;
  extract_frames?: boolean;
  enable_ocr?: boolean;
  generate_summary?: boolean;
  frame_interval?: number;
  whisper_model?: string;
  language?: string;
}

// ============================================
// New Video Processing Functions
// ============================================

/**
 * Resample audio to 16kHz using WASM
 */
export async function resampleAudioWASM(audioData: Float32Array, sampleRate: number): Promise<Float32Array> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const processor = new loader.AudioProcessor(sampleRate, 1);
  const result = processor.resample_to_16kz(new Float32Array(audioData));
  // WASM returns a JS array, convert back to Float32Array
  return new Float32Array(result);
}

/**
 * Parse Whisper ASR result using WASM
 */
export async function parseWhisperResultWASM(resultJson: string, jobId: string): Promise<TranscriptSegment[]> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const recognizer = new loader.SpeechRecognizer('en');
  const result = recognizer.parse_whisper_result(resultJson, jobId);
  return JSON.parse(result);
}

/**
 * Merge short transcript segments using WASM
 */
export async function mergeShortSegmentsWASM(segmentsJson: string, minDuration: number): Promise<TranscriptSegment[]> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const recognizer = new loader.SpeechRecognizer('en');
  const result = recognizer.merge_short_segments(segmentsJson, minDuration);
  return JSON.parse(result);
}

/**
 * Detect scene changes using WASM
 */
export async function detectSceneChangesWASM(motionScoresJson: string, threshold: number): Promise<number[]> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const extractor = new loader.FrameExtractor(5);
  const result = extractor.detect_scene_changes(motionScoresJson, threshold);
  return JSON.parse(result);
}

/**
 * Clean OCR text using WASM
 */
export async function cleanOcrTextWASM(text: string): Promise<string> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const ocr = new loader.OcrProcessor('en');
  return ocr.clean_ocr_text(text);
}

/**
 * Summarize text using WASM
 */
export async function summarizeTextWASM(text: string, maxSentences: number = 5): Promise<string> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const summarizer = new loader.Summarizer(maxSentences);
  return summarizer.summarize(text);
}

/**
 * Split chapters using WASM
 */
export async function splitChaptersWASM(
  segmentsJson: string,
  totalDuration: number,
  jobId: string,
  minDuration: number = 60,
  silenceThreshold: number = 0.3
): Promise<Chapter[]> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const chapterizer = new loader.Chapterizer(minDuration, silenceThreshold);
  const result = chapterizer.split_chapters(segmentsJson, totalDuration, jobId);
  return JSON.parse(result);
}

/**
 * Generate chapter summary using WASM
 */
export async function generateChapterSummaryWASM(
  segmentsJson: string,
  startTime: number,
  endTime: number
): Promise<string> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const chapterizer = new loader.Chapterizer(60, 0.3);
  return chapterizer.generate_chapter_summary(segmentsJson, startTime, endTime);
}

/**
 * Remove duplicate text using WASM
 */
export async function removeDuplicatesWASM(text: string, threshold: number = 0.8): Promise<string> {
  await ensureInitialized();
  const loader = await getWasmModule();
  return loader.TextProcessor.remove_duplicates(text, threshold);
}

/**
 * Extract keywords using WASM
 */
export async function extractKeywordsWASM(text: string, topN: number = 10): Promise<string[]> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const result = loader.TextProcessor.extract_keywords(text, topN);
  return JSON.parse(result);
}

/**
 * Generate Markdown from job data using WASM
 */
export async function generateMarkdownWASM(
  jobJson: string,
  segmentsJson: string,
  chaptersJson: string,
  framesJson: string,
  options: {
    include_timestamps?: boolean;
    include_images?: boolean;
    include_chapters?: boolean;
  } = {}
): Promise<string> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const generator = new loader.MarkdownGenerator(
    options.include_timestamps ?? false,
    options.include_images ?? true,
    options.include_chapters ?? true
  );
  return generator.generate(jobJson, segmentsJson, chaptersJson, framesJson);
}

/**
 * Generate PPTX slides from job data using WASM
 */
export async function generatePptxSlidesWASM(
  jobJson: string,
  segmentsJson: string,
  chaptersJson: string,
  framesJson: string,
  title: string,
  author: string
): Promise<string> {
  await ensureInitialized();
  const loader = await getWasmModule();
  const generator = new loader.PptxGenerator(title, author);
  return generator.generate(jobJson, segmentsJson, chaptersJson, framesJson);
}
