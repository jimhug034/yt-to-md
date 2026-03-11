/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_chapterizer_free: (a: number, b: number) => void;
export const __wbg_summarizer_free: (a: number, b: number) => void;
export const __wbg_textprocessor_free: (a: number, b: number) => void;
export const chapterizer_generate_chapter_summary: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
) => [number, number];
export const chapterizer_split_chapters: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
) => [number, number];
export const summarizer_summarize: (a: number, b: number, c: number) => [number, number];
export const summarizer_summarize_segments: (a: number, b: number, c: number) => [number, number];
export const textprocessor_extract_keywords: (a: number, b: number, c: number) => [number, number];
export const textprocessor_remove_duplicates: (a: number, b: number, c: number) => [number, number];
export const summarizer_new: (a: number) => number;
export const chapterizer_new: (a: number, b: number) => number;
export const __wbg_frameextractor_free: (a: number, b: number) => void;
export const __wbg_markdowngenerator_free: (a: number, b: number) => void;
export const frameextractor_analyze_brightness: (a: number, b: number, c: number) => number;
export const frameextractor_calculate_frame_hash: (a: number, b: number, c: number) => bigint;
export const frameextractor_detect_scene_changes: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number];
export const frameextractor_is_duplicate_frame: (
  a: number,
  b: number,
  c: number,
  d: number,
) => number;
export const frameextractor_new: (a: number) => number;
export const frameextractor_should_extract_frame: (a: number, b: number, c: number) => number;
export const markdowngenerator_generate: (
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
export const markdowngenerator_new: (a: number, b: number, c: number) => number;
export const markdowngenerator_generate_from_json: (
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
export const get_processing_stats: (a: number, b: number, c: number, d: number) => [number, number];
export const parse_srt: (a: number, b: number) => [number, number];
export const parse_ttml: (a: number, b: number) => [number, number];
export const parse_vtt: (a: number, b: number) => [number, number];
export const process_subtitles: (a: number, b: number, c: number, d: number) => [number, number];
export const to_markdown: (a: number, b: number, c: number, d: number) => [number, number];
export const __wbg_audioprocessor_free: (a: number, b: number) => void;
export const __wbg_ocrprocessor_free: (a: number, b: number) => void;
export const audioprocessor_calculate_energy: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number];
export const audioprocessor_resample_to_16khz: (
  a: number,
  b: number,
  c: number,
) => [number, number];
export const audioprocessor_to_pcm16: (a: number, b: number, c: number) => [number, number];
export const ocrprocessor_clean_ocr_text: (a: number, b: number, c: number) => [number, number];
export const ocrprocessor_merge_frame_texts: (a: number, b: number, c: number) => [number, number];
export const ocrprocessor_new: (a: number, b: number) => number;
export const ocrprocessor_parse_ocr_result: (a: number, b: number, c: number) => [number, number];
export const audioprocessor_new: (a: number, b: number) => number;
export const __wbg_pptxgenerator_free: (a: number, b: number) => void;
export const __wbg_speechrecognizer_free: (a: number, b: number) => void;
export const pptxgenerator_export_to_json: (
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
export const pptxgenerator_new: (a: number, b: number, c: number, d: number) => number;
export const speechrecognizer_merge_short_segments: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number];
export const speechrecognizer_new: (a: number, b: number) => number;
export const speechrecognizer_parse_whisper_result: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
) => [number, number];
export const pptxgenerator_generate: (
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
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
