/* @ts-self-types="./yt_subtitle_wasm.d.ts" */

/**
 * 音频提取器 - WASM 辅助函数
 * 实际的音频提取在 JS 端通过 Web Audio API 完成
 */
export class AudioProcessor {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    AudioProcessorFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_audioprocessor_free(ptr, 0);
  }
  /**
   * 计算音频能量（用于静音检测）
   * @param {Float32Array} audio_data
   * @param {number} window_size
   * @returns {Float32Array}
   */
  calculate_energy(audio_data, window_size) {
    const ptr0 = passArrayF32ToWasm0(audio_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.audioprocessor_calculate_energy(this.__wbg_ptr, ptr0, len0, window_size);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
  }
  /**
   * @param {number} sample_rate
   * @param {number} channels
   */
  constructor(sample_rate, channels) {
    const ret = wasm.audioprocessor_new(sample_rate, channels);
    this.__wbg_ptr = ret >>> 0;
    AudioProcessorFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * 重采样音频数据到 16kHz (Whisper 要求的采样率)
   * @param {Float32Array} audio_data
   * @returns {Float32Array}
   */
  resample_to_16khz(audio_data) {
    const ptr0 = passArrayF32ToWasm0(audio_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.audioprocessor_resample_to_16khz(this.__wbg_ptr, ptr0, len0);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
  }
  /**
   * 将音频数据转换为 16-bit PCM 格式
   * @param {Float32Array} audio_data
   * @returns {Uint8Array}
   */
  to_pcm16(audio_data) {
    const ptr0 = passArrayF32ToWasm0(audio_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.audioprocessor_to_pcm16(this.__wbg_ptr, ptr0, len0);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
  }
}
if (Symbol.dispose) AudioProcessor.prototype[Symbol.dispose] = AudioProcessor.prototype.free;

/**
 * 章节分割器
 */
export class Chapterizer {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ChapterizerFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_chapterizer_free(ptr, 0);
  }
  /**
   * 为章节生成摘要
   * @param {string} segments_json
   * @param {number} start_time
   * @param {number} end_time
   * @returns {string}
   */
  generate_chapter_summary(segments_json, start_time, end_time) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(
        segments_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.chapterizer_generate_chapter_summary(
        this.__wbg_ptr,
        ptr0,
        len0,
        start_time,
        end_time,
      );
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {number} min_duration
   * @param {number} silence_threshold
   */
  constructor(min_duration, silence_threshold) {
    const ret = wasm.chapterizer_new(min_duration, silence_threshold);
    this.__wbg_ptr = ret >>> 0;
    ChapterizerFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * 基于规则分割章节
   * 1. 检测长时间静音
   * 2. 基于字幕密度变化
   * 3. 固定时间间隔（兜底）
   * @param {string} segments_json
   * @param {number} total_duration
   * @param {string} job_id
   * @returns {string}
   */
  split_chapters(segments_json, total_duration, job_id) {
    let deferred3_0;
    let deferred3_1;
    try {
      const ptr0 = passStringToWasm0(
        segments_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len0 = WASM_VECTOR_LEN;
      const ptr1 = passStringToWasm0(job_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len1 = WASM_VECTOR_LEN;
      const ret = wasm.chapterizer_split_chapters(
        this.__wbg_ptr,
        ptr0,
        len0,
        total_duration,
        ptr1,
        len1,
      );
      deferred3_0 = ret[0];
      deferred3_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
  }
}
if (Symbol.dispose) Chapterizer.prototype[Symbol.dispose] = Chapterizer.prototype.free;

/**
 * 关键帧提取器
 */
export class FrameExtractor {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    FrameExtractorFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_frameextractor_free(ptr, 0);
  }
  /**
   * 分析图像亮度
   * @param {Uint8Array} image_data
   * @returns {number}
   */
  analyze_brightness(image_data) {
    const ptr0 = passArray8ToWasm0(image_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.frameextractor_analyze_brightness(this.__wbg_ptr, ptr0, len0);
    return ret;
  }
  /**
   * 计算帧哈希（用于检测重复帧）
   * @param {Uint8Array} image_data
   * @returns {bigint}
   */
  calculate_frame_hash(image_data) {
    const ptr0 = passArray8ToWasm0(image_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.frameextractor_calculate_frame_hash(this.__wbg_ptr, ptr0, len0);
    return BigInt.asUintN(64, ret);
  }
  /**
   * 根据场景变化计算关键帧时间点
   * 输入：JSON 数组 [{"time": 0.0, "score": 0.5}, ...]
   * @param {string} motion_scores
   * @param {number} threshold
   * @returns {string}
   */
  detect_scene_changes(motion_scores, threshold) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(
        motion_scores,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.frameextractor_detect_scene_changes(this.__wbg_ptr, ptr0, len0, threshold);
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * 检测是否为重复帧
   * @param {Uint8Array} image_data
   * @param {number} threshold
   * @returns {boolean}
   */
  is_duplicate_frame(image_data, threshold) {
    const ptr0 = passArray8ToWasm0(image_data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.frameextractor_is_duplicate_frame(this.__wbg_ptr, ptr0, len0, threshold);
    return ret !== 0;
  }
  /**
   * @param {number} interval
   */
  constructor(interval) {
    const ret = wasm.frameextractor_new(interval);
    this.__wbg_ptr = ret >>> 0;
    FrameExtractorFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * 确定是否应该提取此帧
   * @param {number} timestamp
   * @param {number} last_extracted
   * @returns {boolean}
   */
  should_extract_frame(timestamp, last_extracted) {
    const ret = wasm.frameextractor_should_extract_frame(this.__wbg_ptr, timestamp, last_extracted);
    return ret !== 0;
  }
}
if (Symbol.dispose) FrameExtractor.prototype[Symbol.dispose] = FrameExtractor.prototype.free;

/**
 * Markdown 生成器
 */
export class MarkdownGenerator {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    MarkdownGeneratorFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_markdowngenerator_free(ptr, 0);
  }
  /**
   * 生成完整的 Markdown 笔记
   * @param {string} job_json
   * @param {string} segments_json
   * @param {string} chapters_json
   * @param {string} frames_json
   * @returns {string}
   */
  generate(job_json, segments_json, chapters_json, frames_json) {
    let deferred5_0;
    let deferred5_1;
    try {
      const ptr0 = passStringToWasm0(job_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ptr1 = passStringToWasm0(
        segments_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len1 = WASM_VECTOR_LEN;
      const ptr2 = passStringToWasm0(
        chapters_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len2 = WASM_VECTOR_LEN;
      const ptr3 = passStringToWasm0(frames_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len3 = WASM_VECTOR_LEN;
      const ret = wasm.markdowngenerator_generate(
        this.__wbg_ptr,
        ptr0,
        len0,
        ptr1,
        len1,
        ptr2,
        len2,
        ptr3,
        len3,
      );
      deferred5_0 = ret[0];
      deferred5_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
  }
  /**
   * 从 JSON 数据生成 Markdown（别名）
   * @param {string} job_json
   * @param {string} segments_json
   * @param {string} chapters_json
   * @param {string} frames_json
   * @returns {string}
   */
  generate_from_json(job_json, segments_json, chapters_json, frames_json) {
    let deferred5_0;
    let deferred5_1;
    try {
      const ptr0 = passStringToWasm0(job_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ptr1 = passStringToWasm0(
        segments_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len1 = WASM_VECTOR_LEN;
      const ptr2 = passStringToWasm0(
        chapters_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len2 = WASM_VECTOR_LEN;
      const ptr3 = passStringToWasm0(frames_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len3 = WASM_VECTOR_LEN;
      const ret = wasm.markdowngenerator_generate_from_json(
        this.__wbg_ptr,
        ptr0,
        len0,
        ptr1,
        len1,
        ptr2,
        len2,
        ptr3,
        len3,
      );
      deferred5_0 = ret[0];
      deferred5_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
  }
  /**
   * @param {boolean} include_timestamps
   * @param {boolean} include_images
   * @param {boolean} include_chapters
   */
  constructor(include_timestamps, include_images, include_chapters) {
    const ret = wasm.markdowngenerator_new(include_timestamps, include_images, include_chapters);
    this.__wbg_ptr = ret >>> 0;
    MarkdownGeneratorFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
}
if (Symbol.dispose) MarkdownGenerator.prototype[Symbol.dispose] = MarkdownGenerator.prototype.free;

/**
 * OCR 处理器
 * 实际的 OCR 调用由 JS 端的 PaddleOCR WASM 完成
 */
export class OcrProcessor {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    OcrProcessorFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_ocrprocessor_free(ptr, 0);
  }
  /**
   * 清理 OCR 文本
   * @param {string} text
   * @returns {string}
   */
  clean_ocr_text(text) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.ocrprocessor_clean_ocr_text(this.__wbg_ptr, ptr0, len0);
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * 合并多帧 OCR 结果
   * @param {string} ocr_results
   * @returns {string}
   */
  merge_frame_texts(ocr_results) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(ocr_results, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.ocrprocessor_merge_frame_texts(this.__wbg_ptr, ptr0, len0);
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {string} language
   */
  constructor(language) {
    const ptr0 = passStringToWasm0(language, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ocrprocessor_new(ptr0, len0);
    this.__wbg_ptr = ret >>> 0;
    OcrProcessorFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * 解析 OCR 返回的 JSON 结果
   * @param {string} result_json
   * @returns {string}
   */
  parse_ocr_result(result_json) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(result_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.ocrprocessor_parse_ocr_result(this.__wbg_ptr, ptr0, len0);
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
}
if (Symbol.dispose) OcrProcessor.prototype[Symbol.dispose] = OcrProcessor.prototype.free;

/**
 * PPTX 生成器
 */
export class PptxGenerator {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    PptxGeneratorFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_pptxgenerator_free(ptr, 0);
  }
  /**
   * 导出为 JSON 供前端使用
   * @param {string} job_json
   * @param {string} segments_json
   * @param {string} chapters_json
   * @param {string} frames_json
   * @returns {string}
   */
  export_to_json(job_json, segments_json, chapters_json, frames_json) {
    let deferred5_0;
    let deferred5_1;
    try {
      const ptr0 = passStringToWasm0(job_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ptr1 = passStringToWasm0(
        segments_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len1 = WASM_VECTOR_LEN;
      const ptr2 = passStringToWasm0(
        chapters_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len2 = WASM_VECTOR_LEN;
      const ptr3 = passStringToWasm0(frames_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len3 = WASM_VECTOR_LEN;
      const ret = wasm.pptxgenerator_export_to_json(
        this.__wbg_ptr,
        ptr0,
        len0,
        ptr1,
        len1,
        ptr2,
        len2,
        ptr3,
        len3,
      );
      deferred5_0 = ret[0];
      deferred5_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
  }
  /**
   * 生成完整的 PPTX 文件（返回 JSON 数据）
   * @param {string} job_json
   * @param {string} segments_json
   * @param {string} chapters_json
   * @param {string} frames_json
   * @returns {string}
   */
  generate(job_json, segments_json, chapters_json, frames_json) {
    let deferred5_0;
    let deferred5_1;
    try {
      const ptr0 = passStringToWasm0(job_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ptr1 = passStringToWasm0(
        segments_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len1 = WASM_VECTOR_LEN;
      const ptr2 = passStringToWasm0(
        chapters_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len2 = WASM_VECTOR_LEN;
      const ptr3 = passStringToWasm0(frames_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len3 = WASM_VECTOR_LEN;
      const ret = wasm.pptxgenerator_generate(
        this.__wbg_ptr,
        ptr0,
        len0,
        ptr1,
        len1,
        ptr2,
        len2,
        ptr3,
        len3,
      );
      deferred5_0 = ret[0];
      deferred5_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
  }
  /**
   * @param {string} title
   * @param {string} author
   */
  constructor(title, author) {
    const ptr0 = passStringToWasm0(title, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(author, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.pptxgenerator_new(ptr0, len0, ptr1, len1);
    this.__wbg_ptr = ret >>> 0;
    PptxGeneratorFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
}
if (Symbol.dispose) PptxGenerator.prototype[Symbol.dispose] = PptxGenerator.prototype.free;

/**
 * 语音识别器封装
 * 实际的 Whisper WASM 调用在 JS 端完成
 */
export class SpeechRecognizer {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    SpeechRecognizerFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_speechrecognizer_free(ptr, 0);
  }
  /**
   * 合并短片段
   * @param {string} segments_json
   * @param {number} min_duration
   * @returns {string}
   */
  merge_short_segments(segments_json, min_duration) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(
        segments_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.speechrecognizer_merge_short_segments(
        this.__wbg_ptr,
        ptr0,
        len0,
        min_duration,
      );
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * @param {string} language
   */
  constructor(language) {
    const ptr0 = passStringToWasm0(language, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.speechrecognizer_new(ptr0, len0);
    this.__wbg_ptr = ret >>> 0;
    SpeechRecognizerFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * 解析 Whisper 返回的 JSON 结果
   * @param {string} result_json
   * @param {string} job_id
   * @returns {string}
   */
  parse_whisper_result(result_json, job_id) {
    let deferred3_0;
    let deferred3_1;
    try {
      const ptr0 = passStringToWasm0(result_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ptr1 = passStringToWasm0(job_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len1 = WASM_VECTOR_LEN;
      const ret = wasm.speechrecognizer_parse_whisper_result(
        this.__wbg_ptr,
        ptr0,
        len0,
        ptr1,
        len1,
      );
      deferred3_0 = ret[0];
      deferred3_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
  }
}
if (Symbol.dispose) SpeechRecognizer.prototype[Symbol.dispose] = SpeechRecognizer.prototype.free;

/**
 * 文本摘要规则引擎
 */
export class Summarizer {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    SummarizerFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_summarizer_free(ptr, 0);
  }
  /**
   * @param {number} max_sentences
   */
  constructor(max_sentences) {
    const ret = wasm.summarizer_new(max_sentences);
    this.__wbg_ptr = ret >>> 0;
    SummarizerFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * 生成摘要（基于规则）
   * 1. 提取关键句（包含关键词的句子）
   * 2. 保留首尾句
   * 3. 去除重复
   * @param {string} text
   * @returns {string}
   */
  summarize(text) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.summarizer_summarize(this.__wbg_ptr, ptr0, len0);
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * 从字幕片段生成摘要
   * @param {string} segments_json
   * @returns {string}
   */
  summarize_segments(segments_json) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(
        segments_json,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
      );
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.summarizer_summarize_segments(this.__wbg_ptr, ptr0, len0);
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
}
if (Symbol.dispose) Summarizer.prototype[Symbol.dispose] = Summarizer.prototype.free;

/**
 * 文本处理工具
 */
export class TextProcessor {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    TextProcessorFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_textprocessor_free(ptr, 0);
  }
  /**
   * 提取关键词
   * @param {string} text
   * @param {number} top_n
   * @returns {string}
   */
  static extract_keywords(text, top_n) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.textprocessor_extract_keywords(ptr0, len0, top_n);
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
  /**
   * 移除重复文本
   * @param {string} text
   * @param {number} threshold
   * @returns {string}
   */
  static remove_duplicates(text, threshold) {
    let deferred2_0;
    let deferred2_1;
    try {
      const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.textprocessor_remove_duplicates(ptr0, len0, threshold);
      deferred2_0 = ret[0];
      deferred2_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
}
if (Symbol.dispose) TextProcessor.prototype[Symbol.dispose] = TextProcessor.prototype.free;

/**
 * Get processing statistics
 * Input: captions JSON array + processed output
 * Output: stats JSON string
 * @param {string} captions_json
 * @param {string} processed_output
 * @returns {string}
 */
export function get_processing_stats(captions_json, processed_output) {
  let deferred3_0;
  let deferred3_1;
  try {
    const ptr0 = passStringToWasm0(captions_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(
      processed_output,
      wasm.__wbindgen_malloc,
      wasm.__wbindgen_realloc,
    );
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.get_processing_stats(ptr0, len0, ptr1, len1);
    deferred3_0 = ret[0];
    deferred3_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
  }
}

/**
 * Parse SRT format and return JSON
 * Each caption has start (seconds), end (seconds), and text fields
 * @param {string} input
 * @returns {string}
 */
export function parse_srt(input) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_srt(ptr0, len0);
    deferred2_0 = ret[0];
    deferred2_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
}

/**
 * Parse YouTube TTML format and return JSON
 * Each caption has start (seconds), end (seconds), and text fields
 * @param {string} input
 * @returns {string}
 */
export function parse_ttml(input) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_ttml(ptr0, len0);
    deferred2_0 = ret[0];
    deferred2_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
}

/**
 * Parse WebVTT format and return JSON
 * Each caption has start (seconds), end (seconds), and text fields
 * @param {string} input
 * @returns {string}
 */
export function parse_vtt(input) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ptr0 = passStringToWasm0(input, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_vtt(ptr0, len0);
    deferred2_0 = ret[0];
    deferred2_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
}

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
 * @param {string} captions_json
 * @param {string} options_json
 * @returns {string}
 */
export function process_subtitles(captions_json, options_json) {
  let deferred3_0;
  let deferred3_1;
  try {
    const ptr0 = passStringToWasm0(captions_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.process_subtitles(ptr0, len0, ptr1, len1);
    deferred3_0 = ret[0];
    deferred3_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
  }
}

/**
 * Convert captions JSON to Markdown format
 * Input should be a JSON array of captions with start, end, and text fields
 * Options (as JSON string):
 * {
 *   "title": "Video Title",
 *   "url": "https://youtube.com/watch?v=...",
 *   "duration": "10:05"
 * }
 * @param {string} captions_json
 * @param {string} options_json
 * @returns {string}
 */
export function to_markdown(captions_json, options_json) {
  let deferred3_0;
  let deferred3_1;
  try {
    const ptr0 = passStringToWasm0(captions_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.to_markdown(ptr0, len0, ptr1, len1);
    deferred3_0 = ret[0];
    deferred3_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
  }
}

function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_string_get_395e606bd0ee4427: function (arg0, arg1) {
      const obj = arg1;
      const ret = typeof obj === "string" ? obj : undefined;
      var ptr1 = isLikeNone(ret)
        ? 0
        : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbg___wbindgen_throw_6ddd609b62940d55: function (arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbg_new_fd94ca5c9639abd2: function (arg0) {
      const ret = new Date(arg0);
      return ret;
    },
    __wbg_random_5bb86cae65a45bf6: function () {
      const ret = Math.random();
      return ret;
    },
    __wbg_toISOString_87e7eaab337f7dcc: function (arg0) {
      const ret = arg0.toISOString();
      return ret;
    },
    __wbindgen_cast_0000000000000001: function (arg0) {
      // Cast intrinsic for `I64 -> Externref`.
      const ret = arg0;
      return ret;
    },
    __wbindgen_init_externref_table: function () {
      const table = wasm.__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, undefined);
      table.set(offset + 0, undefined);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    },
  };
  return {
    __proto__: null,
    "./yt_subtitle_wasm_bg.js": import0,
  };
}

const AudioProcessorFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_audioprocessor_free(ptr >>> 0, 1));
const ChapterizerFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_chapterizer_free(ptr >>> 0, 1));
const FrameExtractorFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_frameextractor_free(ptr >>> 0, 1));
const MarkdownGeneratorFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_markdowngenerator_free(ptr >>> 0, 1));
const OcrProcessorFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_ocrprocessor_free(ptr >>> 0, 1));
const PptxGeneratorFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_pptxgenerator_free(ptr >>> 0, 1));
const SpeechRecognizerFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_speechrecognizer_free(ptr >>> 0, 1));
const SummarizerFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_summarizer_free(ptr >>> 0, 1));
const TextProcessorFinalization =
  typeof FinalizationRegistry === "undefined"
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_textprocessor_free(ptr >>> 0, 1));

function getArrayF32FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
  if (
    cachedDataViewMemory0 === null ||
    cachedDataViewMemory0.buffer.detached === true ||
    (cachedDataViewMemory0.buffer.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
  if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
    cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
  }
  return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
  return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 4, 4) >>> 0;
  getFloat32ArrayMemory0().set(arg, ptr / 4);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0()
      .subarray(ptr, ptr + buf.length)
      .set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr;
  }

  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;

  const mem = getUint8ArrayMemory0();

  let offset = 0;

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7f) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);

    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }

  WASM_VECTOR_LEN = offset;
  return ptr;
}

let cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length,
    };
  };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  wasmModule = module;
  cachedDataViewMemory0 = null;
  cachedFloat32ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}

async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);

        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn(
            "`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",
            e,
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }

  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }

  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;

  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        "using deprecated parameters for the initialization function; pass a single object instead",
      );
    }
  }

  if (module_or_path === undefined) {
    module_or_path = new URL("yt_subtitle_wasm_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (
    typeof module_or_path === "string" ||
    (typeof Request === "function" && module_or_path instanceof Request) ||
    (typeof URL === "function" && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path);
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
