/* tslint:disable */
/* eslint-disable */

/**
 * 音频提取器 - WASM 辅助函数
 * 实际的音频提取在 JS 端通过 Web Audio API 完成
 */
export class AudioProcessor {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 计算音频能量（用于静音检测）
   */
  calculate_energy(audio_data: Float32Array, window_size: number): Float32Array;
  constructor(sample_rate: number, channels: number);
  /**
   * 重采样音频数据到 16kHz (Whisper 要求的采样率)
   */
  resample_to_16khz(audio_data: Float32Array): Float32Array;
  /**
   * 将音频数据转换为 16-bit PCM 格式
   */
  to_pcm16(audio_data: Float32Array): Uint8Array;
}

/**
 * 章节分割器
 */
export class Chapterizer {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 为章节生成摘要
   */
  generate_chapter_summary(segments_json: string, start_time: number, end_time: number): string;
  constructor(min_duration: number, silence_threshold: number);
  /**
   * 基于规则分割章节
   * 1. 检测长时间静音
   * 2. 基于字幕密度变化
   * 3. 固定时间间隔（兜底）
   */
  split_chapters(segments_json: string, total_duration: number, job_id: string): string;
}

/**
 * 关键帧提取器
 */
export class FrameExtractor {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 分析图像亮度
   */
  analyze_brightness(image_data: Uint8Array): number;
  /**
   * 计算帧哈希（用于检测重复帧）
   */
  calculate_frame_hash(image_data: Uint8Array): bigint;
  /**
   * 根据场景变化计算关键帧时间点
   * 输入：JSON 数组 [{"time": 0.0, "score": 0.5}, ...]
   */
  detect_scene_changes(motion_scores: string, threshold: number): string;
  /**
   * 检测是否为重复帧
   */
  is_duplicate_frame(image_data: Uint8Array, threshold: number): boolean;
  constructor(interval: number);
  /**
   * 确定是否应该提取此帧
   */
  should_extract_frame(timestamp: number, last_extracted: number): boolean;
}

/**
 * Markdown 生成器
 */
export class MarkdownGenerator {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 生成完整的 Markdown 笔记
   */
  generate(
    job_json: string,
    segments_json: string,
    chapters_json: string,
    frames_json: string,
  ): string;
  /**
   * 从 JSON 数据生成 Markdown（别名）
   */
  generate_from_json(
    job_json: string,
    segments_json: string,
    chapters_json: string,
    frames_json: string,
  ): string;
  constructor(include_timestamps: boolean, include_images: boolean, include_chapters: boolean);
}

/**
 * OCR 处理器
 * 实际的 OCR 调用由 JS 端的 PaddleOCR WASM 完成
 */
export class OcrProcessor {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 清理 OCR 文本
   */
  clean_ocr_text(text: string): string;
  /**
   * 合并多帧 OCR 结果
   */
  merge_frame_texts(ocr_results: string): string;
  constructor(language: string);
  /**
   * 解析 OCR 返回的 JSON 结果
   */
  parse_ocr_result(result_json: string): string;
}

/**
 * PPTX 生成器
 */
export class PptxGenerator {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 导出为 JSON 供前端使用
   */
  export_to_json(
    job_json: string,
    segments_json: string,
    chapters_json: string,
    frames_json: string,
  ): string;
  /**
   * 生成完整的 PPTX 文件（返回 JSON 数据）
   */
  generate(
    job_json: string,
    segments_json: string,
    chapters_json: string,
    frames_json: string,
  ): string;
  constructor(title: string, author: string);
}

/**
 * 语音识别器封装
 * 实际的 Whisper WASM 调用在 JS 端完成
 */
export class SpeechRecognizer {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 合并短片段
   */
  merge_short_segments(segments_json: string, min_duration: number): string;
  constructor(language: string);
  /**
   * 解析 Whisper 返回的 JSON 结果
   */
  parse_whisper_result(result_json: string, job_id: string): string;
}

/**
 * 文本摘要规则引擎
 */
export class Summarizer {
  free(): void;
  [Symbol.dispose](): void;
  constructor(max_sentences: number);
  /**
   * 生成摘要（基于规则）
   * 1. 提取关键句（包含关键词的句子）
   * 2. 保留首尾句
   * 3. 去除重复
   */
  summarize(text: string): string;
  /**
   * 从字幕片段生成摘要
   */
  summarize_segments(segments_json: string): string;
}

/**
 * 文本处理工具
 */
export class TextProcessor {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * 提取关键词
   */
  static extract_keywords(text: string, top_n: number): string;
  /**
   * 移除重复文本
   */
  static remove_duplicates(text: string, threshold: number): string;
}

/**
 * Get processing statistics
 * Input: captions JSON array + processed output
 * Output: stats JSON string
 */
export function get_processing_stats(captions_json: string, processed_output: string): string;

/**
 * Parse SRT format and return JSON
 * Each caption has start (seconds), end (seconds), and text fields
 */
export function parse_srt(input: string): string;

/**
 * Parse YouTube TTML format and return JSON
 * Each caption has start (seconds), end (seconds), and text fields
 */
export function parse_ttml(input: string): string;

/**
 * Parse WebVTT format and return JSON
 * Each caption has start (seconds), end (seconds), and text fields
 */
export function parse_vtt(input: string): string;

/**
 * High-performance subtitle processing in Rust
 * Input: captions JSON array + options JSON
 * Output: processed Markdown text
 *
 * Options JSON format:
 * {
 *   "include_timestamps": bool,
 *   "compact_mode": bool,
 *   "sentences_per_paragraph": number,
 *   "video_url": string
 * }
 */
export function process_subtitles(captions_json: string, options_json: string): string;

/**
 * Convert captions JSON to Markdown format
 * Input should be a JSON array of captions with start, end, and text fields
 * Options (as JSON string):
 * {
 *   "title": "Video Title",
 *   "url": "https://youtube.com/watch?v=...",
 *   "duration": "10:05"
 * }
 */
export function to_markdown(captions_json: string, options_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_chapterizer_free: (a: number, b: number) => void;
  readonly __wbg_summarizer_free: (a: number, b: number) => void;
  readonly __wbg_textprocessor_free: (a: number, b: number) => void;
  readonly chapterizer_generate_chapter_summary: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
  ) => [number, number];
  readonly chapterizer_split_chapters: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => [number, number];
  readonly summarizer_summarize: (a: number, b: number, c: number) => [number, number];
  readonly summarizer_summarize_segments: (a: number, b: number, c: number) => [number, number];
  readonly textprocessor_extract_keywords: (a: number, b: number, c: number) => [number, number];
  readonly textprocessor_remove_duplicates: (a: number, b: number, c: number) => [number, number];
  readonly summarizer_new: (a: number) => number;
  readonly chapterizer_new: (a: number, b: number) => number;
  readonly __wbg_frameextractor_free: (a: number, b: number) => void;
  readonly __wbg_markdowngenerator_free: (a: number, b: number) => void;
  readonly frameextractor_analyze_brightness: (a: number, b: number, c: number) => number;
  readonly frameextractor_calculate_frame_hash: (a: number, b: number, c: number) => bigint;
  readonly frameextractor_detect_scene_changes: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => [number, number];
  readonly frameextractor_is_duplicate_frame: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => number;
  readonly frameextractor_new: (a: number) => number;
  readonly frameextractor_should_extract_frame: (a: number, b: number, c: number) => number;
  readonly markdowngenerator_generate: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
  ) => [number, number];
  readonly markdowngenerator_new: (a: number, b: number, c: number) => number;
  readonly markdowngenerator_generate_from_json: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
  ) => [number, number];
  readonly get_processing_stats: (a: number, b: number, c: number, d: number) => [number, number];
  readonly parse_srt: (a: number, b: number) => [number, number];
  readonly parse_ttml: (a: number, b: number) => [number, number];
  readonly parse_vtt: (a: number, b: number) => [number, number];
  readonly process_subtitles: (a: number, b: number, c: number, d: number) => [number, number];
  readonly to_markdown: (a: number, b: number, c: number, d: number) => [number, number];
  readonly __wbg_audioprocessor_free: (a: number, b: number) => void;
  readonly __wbg_ocrprocessor_free: (a: number, b: number) => void;
  readonly audioprocessor_calculate_energy: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => [number, number];
  readonly audioprocessor_resample_to_16khz: (a: number, b: number, c: number) => [number, number];
  readonly audioprocessor_to_pcm16: (a: number, b: number, c: number) => [number, number];
  readonly ocrprocessor_clean_ocr_text: (a: number, b: number, c: number) => [number, number];
  readonly ocrprocessor_merge_frame_texts: (a: number, b: number, c: number) => [number, number];
  readonly ocrprocessor_new: (a: number, b: number) => number;
  readonly ocrprocessor_parse_ocr_result: (a: number, b: number, c: number) => [number, number];
  readonly audioprocessor_new: (a: number, b: number) => number;
  readonly __wbg_pptxgenerator_free: (a: number, b: number) => void;
  readonly __wbg_speechrecognizer_free: (a: number, b: number) => void;
  readonly pptxgenerator_export_to_json: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
  ) => [number, number];
  readonly pptxgenerator_new: (a: number, b: number, c: number, d: number) => number;
  readonly speechrecognizer_merge_short_segments: (
    a: number,
    b: number,
    c: number,
    d: number,
  ) => [number, number];
  readonly speechrecognizer_new: (a: number, b: number) => number;
  readonly speechrecognizer_parse_whisper_result: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
  ) => [number, number];
  readonly pptxgenerator_generate: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
    g: number,
    h: number,
    i: number,
  ) => [number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>,
): Promise<InitOutput>;
