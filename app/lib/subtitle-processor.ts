/**
 * 字幕处理模块 - 使用 Rust WASM 实现高性能处理
 *
 * 性能优化：
 * - Rust 编译为 WASM，性能接近原生
 * - 预分配内存，避免频繁分配
 * - 高效的字符串操作
 */

import type { SubtitleEntry } from './youtube';

// WASM 模块懒加载
let wasmModule: any = null;
let wasmInitPromise: Promise<any> | null = null;

/**
 * 初始化 WASM 模块
 */
async function initWASM(): Promise<any> {
  if (wasmModule) return wasmModule;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    try {
      const module = await import('./wasm/yt_subtitle_wasm');
      await module.default();
      wasmModule = module;
      console.log('[WASM] Subtitle processor loaded');
      return module;
    } catch (error) {
      console.warn('[WASM] Failed to load, using JS fallback:', error);
      return null;
    }
  })();

  return wasmInitPromise;
}

export interface SubtitleProcessorOptions {
  /** 是否保留时间戳 */
  includeTimestamps?: boolean;
  /** 是否使用简洁模式（合并段落） */
  compactMode?: boolean;
  /** 每个段落的句子数量 */
  sentencesPerParagraph?: number;
  /** 视频URL（用于生成时间戳链接） */
  videoUrl?: string;
}

export interface ProcessorStats {
  totalEntries: number;
  mergedSentences: number;
  finalParagraphs: number;
  totalDurationMs: number;
}

/**
 * 将 SubtitleEntry 转换为 WASM 需要的格式
 */
function entriesToWasmFormat(entries: SubtitleEntry[]): string {
  const wasmFormat = entries.map((e) => ({
    start: e.startTime / 1000, // 转换为秒
    end: e.endTime / 1000,
    text: e.text,
  }));
  return JSON.stringify(wasmFormat);
}

/**
 * 处理字幕条目，生成格式化的 Markdown（使用 Rust WASM）
 *
 * @param entries - 字幕条目数组
 * @param options - 处理选项
 * @returns 格式化的 Markdown 文本
 */
export async function processSubtitles(
  entries: SubtitleEntry[],
  options: SubtitleProcessorOptions = {}
): Promise<string> {
  const {
    includeTimestamps = false,
    compactMode = true,
    sentencesPerParagraph = 4,
    videoUrl = '',
  } = options;

  if (entries.length === 0) return '';

  // 尝试使用 WASM 处理
  try {
    const wasm = await initWASM();
    if (wasm && wasm.process_subtitles) {
      const captionsJson = entriesToWasmFormat(entries);
      const optionsJson = JSON.stringify({
        include_timestamps: includeTimestamps,
        compact_mode: compactMode,
        sentences_per_paragraph: sentencesPerParagraph,
        video_url: videoUrl,
      });

      const result = wasm.process_subtitles(captionsJson, optionsJson);
      console.log(`[WASM] Processed ${entries.length} entries in ${compactMode ? 'compact' : 'original'} mode`);
      return result;
    }
  } catch (error) {
    console.warn('[WASM] Processing failed, using JS fallback:', error);
  }

  // Fallback: 使用 JavaScript 实现
  return processSubtitlesJS(entries, options);
}

/**
 * JavaScript fallback 实现（保留用于兼容性）
 */
function processSubtitlesJS(
  entries: SubtitleEntry[],
  options: SubtitleProcessorOptions
): string {
  const { compactMode = true, includeTimestamps = false, videoUrl = '' } = options;

  if (!compactMode) {
    // 原始模式
    return entries
      .map((entry) => {
        const text = entry.text.trim();
        if (!text) return '';

        if (includeTimestamps && videoUrl) {
          const timestamp = formatTimestampLink(entry.startTime, videoUrl);
          return `${timestamp} ${text}`;
        }
        return text;
      })
      .filter((s) => s)
      .join('\n\n');
  }

  // 紧凑模式
  const sentences = mergeSegmentsJS(entries);
  const paragraphs = groupParagraphsJS(sentences, options.sentencesPerParagraph || 4);

  return paragraphs.join('\n\n');
}

/**
 * 格式化时间戳链接（JS 版本）
 */
function formatTimestampLink(startTime: number, videoUrl: string): string {
  const minutes = Math.floor(startTime / 60000);
  const seconds = Math.floor((startTime % 60000) / 1000);
  const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const timeInSeconds = Math.floor(startTime / 1000);
  return `[${timestamp}](${videoUrl}&t=${timeInSeconds})`;
}

/**
 * 合并片段成句子（JS 版本）
 */
function mergeSegmentsJS(entries: SubtitleEntry[]): string[] {
  if (entries.length === 0) return [];

  const sentences: string[] = [];
  let currentSentence = '';

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const text = entry.text.trim();
    if (!text) continue;

    if (currentSentence) {
      currentSentence += text;
    } else {
      currentSentence = text;
    }

    const trimmedText = text.trim();
    if (/[。！？.!?]$/.test(trimmedText)) {
      sentences.push(cleanTextJS(currentSentence));
      currentSentence = '';
    } else if (i < entries.length - 1) {
      const nextEntry = entries[i + 1];
      const gap = nextEntry.startTime - entry.endTime;
      if (gap > 2000 && currentSentence) {
        sentences.push(cleanTextJS(currentSentence));
        currentSentence = '';
      }
    }
  }

  if (currentSentence) {
    sentences.push(cleanTextJS(currentSentence));
  }

  return sentences.filter((s) => s.length > 0);
}

/**
 * 组合成段落（JS 版本）
 */
function groupParagraphsJS(sentences: string[], sentencesPerParagraph: number): string[] {
  if (sentences.length === 0) return [];

  const paragraphs: string[] = [];
  const currentParagraph: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    currentParagraph.push(sentences[i]);

    const shouldEnd =
      currentParagraph.length >= sentencesPerParagraph ||
      /[。！？]$/.test(sentences[i]);

    if (shouldEnd && currentParagraph.length >= 2) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph.length = 0;
    }
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  return paragraphs;
}

/**
 * 清理文本（JS 版本）
 */
function cleanTextJS(text: string): string {
  let cleaned = text;
  const fillerPatterns = [
    /\b(嗯|啊|噢|呃|额|那个|这个|然后呢|就是|那就是|对不对|是不是)\b[，,]?\s*/g,
    /\b(uh|um|ah|oh|er)\b[，,]?\s*/gi,
  ];

  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * 获取字幕统计信息（使用 WASM）
 */
export async function getSubtitleStats(
  entries: SubtitleEntry[],
  processedOutput?: string
): Promise<{
  totalEntries: number;
  totalDuration: number;
  averageDuration: number;
  wordCount: number;
}> {
  if (entries.length === 0) {
    return { totalEntries: 0, totalDuration: 0, averageDuration: 0, wordCount: 0 };
  }

  const totalDuration = entries[entries.length - 1].endTime - entries[0].startTime;
  const averageDuration = totalDuration / entries.length;

  // 如果有 WASM，使用它获取更详细的统计
  if (processedOutput) {
    try {
      const wasm = await initWASM();
      if (wasm && wasm.get_processing_stats) {
        const captionsJson = entriesToWasmFormat(entries);
        const statsJson = wasm.get_processing_stats(captionsJson, processedOutput);
        const stats = JSON.parse(statsJson);
        return {
          totalEntries: stats.total_entries || entries.length,
          totalDuration: stats.total_duration_ms || totalDuration,
          averageDuration,
          wordCount: 0, // WASM 暂未提供字数统计
        };
      }
    } catch (e) {
      // Ignore error, use fallback
    }
  }

  // 字数估算
  const fullText = entries.map((e) => e.text).join(' ');
  const hasChinese = /[\u4e00-\u9fa5]/.test(fullText);
  const wordCount = hasChinese
    ? fullText.replace(/[^\u4e00-\u9fa5]/g, '').length
    : fullText.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    totalEntries: entries.length,
    totalDuration,
    averageDuration,
    wordCount,
  };
}

/**
 * 同步版本的处理函数（用于已加载 WASM 的情况）
 */
export function processSubtitlesSync(
  entries: SubtitleEntry[],
  options: SubtitleProcessorOptions = {}
): string {
  // 这个函数只在 WASM 已加载后调用
  // 否则返回空字符串，调用者应该使用 async 版本
  return '';
}
