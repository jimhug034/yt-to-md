/**
 * 内容结构化模块
 *
 * 集成 Rust WASM 的文本总结和章节分析功能
 */

import { Summarizer, Chapterizer, TextProcessor } from '../../../wasm/pkg';
import type { TranscriptSegment, Chapter } from '../wasm';

// ============================================
// 类型定义
// ============================================

export interface SummaryOptions {
  removeFillers?: boolean;
  mergeDuplicates?: boolean;
  minSentenceLength?: number;
  maxSentences?: number;
}

export interface ChapterSplitOptions {
  minChapterDuration?: number; // 最小章节时长（秒）
  silenceThreshold?: number; // 静音阈值（秒）
  fixedInterval?: number; // 固定间隔（秒）
}

export interface ChapterWithSummary extends Chapter {
  segments: TranscriptSegment[];
  keywords: string[];
}

// ============================================
// 文本总结器
// ============================================

class TextSummarizer {
  private summarizer: Summarizer;

  constructor(options: SummaryOptions = {}) {
    const maxSentences = options.maxSentences || 3;
    this.summarizer = new Summarizer(maxSentences);
  }

  /**
   * 生成文本摘要
   */
  summarize(text: string): string {
    return this.summarizer.summarize(text);
  }

  /**
   * 从字幕片段生成摘要
   */
  summarizeFromSegments(segments: TranscriptSegment[]): string {
    const segmentsJson = JSON.stringify(segments);
    return this.summarizer.summarize_segments(segmentsJson);
  }

  /**
   * 清理文本：移除填充词、重复内容
   */
  cleanText(text: string, options: SummaryOptions = {}): string {
    let cleaned = text;

    // 移除重复内容
    if (options.mergeDuplicates !== false) {
      cleaned = TextProcessor.remove_duplicates(cleaned, 0.85);
    }

    // 移除填充词
    if (options.removeFillers !== false) {
      cleaned = this.removeFillerWords(cleaned);
    }

    return cleaned.trim();
  }

  /**
   * 移除填充词
   */
  private removeFillerWords(text: string): string {
    const fillerWords = [
      '嗯', '啊', '哦', '呃', '那个', '这个', '就是', '然后', '因为',
      'um', 'uh', 'er', 'like', 'you know', 'so', 'because', 'then',
    ];

    let cleaned = text;
    for (const filler of fillerWords) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    }

    // 清理多余空格
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * 提取关键词
   */
  extractKeywords(text: string, topN = 10): string[] {
    const keywordsJson = TextProcessor.extract_keywords(text, topN);
    try {
      return JSON.parse(keywordsJson);
    } catch {
      return [];
    }
  }
}

// ============================================
// 章节分析器
// ============================================

class ContentChapterizer {
  private chapterizer: Chapterizer;

  constructor(options: ChapterSplitOptions = {}) {
    const minDuration = options.minChapterDuration || 60; // 默认 60 秒
    const silenceThreshold = options.silenceThreshold || 3; // 默认 3 秒静音
    this.chapterizer = new Chapterizer(minDuration, silenceThreshold);
  }

  /**
   * 从字幕片段生成章节
   */
  generateChapters(
    segments: TranscriptSegment[],
    jobId: string,
    totalDuration: number
  ): Chapter[] {
    const segmentsJson = JSON.stringify(segments);
    const chaptersJson = this.chapterizer.split_chapters(
      segmentsJson,
      totalDuration,
      jobId
    );

    try {
      return JSON.parse(chaptersJson);
    } catch {
      return [];
    }
  }

  /**
   * 为章节生成摘要
   */
  generateChapterSummary(
    segments: TranscriptSegment[],
    startTime: number,
    endTime: number
  ): string {
    const segmentsJson = JSON.stringify(segments);
    return this.chapterizer.generate_chapter_summary(
      segmentsJson,
      startTime,
      endTime
    );
  }

  /**
   * 为所有章节生成摘要和关键词
   */
  enrichChapters(
    chapters: Chapter[],
    segments: TranscriptSegment[]
  ): ChapterWithSummary[] {
    return chapters.map((chapter) => {
      const chapterSegments = segments.filter(
        (s) => s.start_time >= chapter.start_time && s.end_time <= chapter.end_time
      );

      const summary = this.generateChapterSummary(
        chapterSegments,
        chapter.start_time,
        chapter.end_time
      );

      // 提取关键词
      const chapterText = chapterSegments.map((s) => s.text).join(' ');
      const summarizer = new TextSummarizer();
      const keywords = summarizer.extractKeywords(chapterText, 5);

      return {
        ...chapter,
        summary,
        segments: chapterSegments,
        keywords,
      };
    });
  }
}

// ============================================
// 内容分析器（整合）
// ============================================

interface AnalysisResult {
  summary: string;
  keywords: string[];
  chapters: ChapterWithSummary[];
  readingTime: number; // 预估阅读时间（分钟）
}

class ContentAnalyzer {
  private summarizer: TextSummarizer;
  private chapterizer: ContentChapterizer;

  constructor(
    summaryOptions?: SummaryOptions,
    chapterOptions?: ChapterSplitOptions
  ) {
    this.summarizer = new TextSummarizer(summaryOptions);
    this.chapterizer = new ContentChapterizer(chapterOptions);
  }

  /**
   * 分析转录内容，生成摘要、章节和关键词
   */
  analyze(
    segments: TranscriptSegment[],
    jobId: string,
    totalDuration: number
  ): AnalysisResult {
    // 生成整体摘要
    const fullText = segments.map((s) => s.text).join(' ');
    const summary = this.summarizer.summarize(fullText);

    // 提取关键词
    const keywords = this.summarizer.extractKeywords(fullText);

    // 生成章节
    const chapters = this.chapterizer.generateChapters(segments, jobId, totalDuration);

    // 为章节添加摘要和关键词
    const enrichedChapters = this.chapterizer.enrichChapters(chapters, segments);

    // 计算阅读时间（假设平均阅读速度为 200 词/分钟）
    const wordCount = fullText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      summary,
      keywords,
      chapters: enrichedChapters,
      readingTime,
    };
  }

  /**
   * 仅生成摘要
   */
  summarize(segments: TranscriptSegment[]): string {
    return this.summarizer.summarizeFromSegments(segments);
  }

  /**
   * 仅生成章节
   */
  chapterize(
    segments: TranscriptSegment[],
    jobId: string,
    totalDuration: number
  ): ChapterWithSummary[] {
    const chapters = this.chapterizer.generateChapters(segments, jobId, totalDuration);
    return this.chapterizer.enrichChapters(chapters, segments);
  }

  /**
   * 清理转录文本
   */
  cleanTranscript(segments: TranscriptSegment[]): TranscriptSegment[] {
    const cleanedSegments: TranscriptSegment[] = [];

    for (const segment of segments) {
      const cleanedText = this.summarizer.cleanText(segment.text);
      if (cleanedText.length > 0) {
        cleanedSegments.push({
          ...segment,
          text: cleanedText,
        });
      }
    }

    return cleanedSegments;
  }
}

// ============================================
// 导出
// ============================================

export {
  TextSummarizer,
  ContentChapterizer,
  ContentAnalyzer,
};
