/**
 * PPTX Export Module
 * 使用 pptxgenjs 库将视频处理结果导出为 PowerPoint 文件
 *
 * 功能：
 * - 从 chapters 和 frames 生成幻灯片
 * - 每个章节一张幻灯片
 * - 关键帧作为幻灯片图片
 * - 字幕作为演讲者备注
 * - 支持模板自定义
 * - 处理大文件和内存问题
 */

import pptxgenjs from "pptxgenjs";
import type { Chapter, KeyFrame, TranscriptSegment } from "../wasm";

// 定义 Slide 类型（pptxgenjs 没有导出 Slide 类型）
type Slide = ReturnType<pptxgenjs["addSlide"]>;

// 定义 SlideLayout 类型
type SlideLayout = "16x9" | "16x10" | "4x3" | "A4" | "LETTER";

// ============================================
// 类型定义
// ============================================

/**
 * PPTX 导出选项
 */
export interface PptxExportOptions {
  /** 演示文稿标题 */
  title?: string;
  /** 作者名称 */
  author?: string;
  /** 主题名称 */
  subject?: string;
  /** 幻灯片尺寸 (16:9, 4:3, A4, etc.) */
  layout?: "16x9" | "16x10" | "4x3" | "A4" | "LETTER";
  /** 主色调 */
  masterColor?: string;
  /** 辅助色 */
  accentColor?: string;
  /** 背景色 */
  backgroundColor?: string;
  /** 文本颜色 */
  textColor?: string;
  /** 字体 */
  fontFace?: string;
  /** 标题字号 */
  titleFontSize?: number;
  /** 正文字号 */
  bodyFontSize?: number;
  /** 备注字号 */
  notesFontSize?: number;
  /** 是否生成目录页 */
  includeTableOfContents?: boolean;
  /** 是否生成封面页 */
  includeTitleSlide?: boolean;
  /** 是否生成结束页 */
  includeThankYouSlide?: boolean;
  /** 是否在备注中包含时间戳 */
  includeTimestampsInNotes?: boolean;
  /** 图片缩放模式 (cover, contain, crop) */
  imageFit?: "cover" | "contain" | "crop";
  /** 每个章节最多生成的幻灯片数 */
  maxSlidesPerChapter?: number;
  /** 每张幻灯片最大字符数 */
  maxCharsPerSlide?: number;
  /** 进度回调 */
  onProgress?: (current: number, total: number, message: string) => void;
}

/**
 * 幻灯片内容数据
 */
export interface SlideContent {
  /** 幻灯片标题 */
  title: string;
  /** 幻灯片正文内容 */
  body: string;
  /** 图片数据 (base64 或 URL) */
  imageData?: string | { data: string; type: string };
  /** 演讲者备注 */
  notes?: string;
  /** 时间戳（用于备注） */
  timestamp?: number;
}

/**
 * 章节详情
 */
export interface ChapterDetail {
  /** 章节信息 */
  chapter: Chapter;
  /** 关联的字幕片段 */
  segments: TranscriptSegment[];
  /** 关联的关键帧 */
  frames: KeyFrame[];
}

/**
 * PPTX 导出结果
 */
export interface PptxExportResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 文件名 */
  filename?: string;
  /** Blob URL */
  url?: string;
  /** 幻灯片数量 */
  slideCount?: number;
  /** 文件大小（字节） */
  fileSize?: number;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_OPTIONS: Required<PptxExportOptions> = {
  title: "Video Presentation",
  author: "YouTube Subtitle MD",
  subject: "Generated from Video",
  layout: "16x9",
  masterColor: "005696",
  accentColor: "ED650A",
  backgroundColor: "FFFFFF",
  textColor: "000000",
  fontFace: "Arial",
  titleFontSize: 36,
  bodyFontSize: 18,
  notesFontSize: 12,
  includeTableOfContents: true,
  includeTitleSlide: true,
  includeThankYouSlide: true,
  includeTimestampsInNotes: true,
  imageFit: "cover",
  maxSlidesPerChapter: 3,
  maxCharsPerSlide: 500,
  onProgress: () => {},
};

// ============================================
// PPTX 导出器类
// ============================================

export class PptxExporter {
  private options: Required<PptxExportOptions>;
  private pres: pptxgenjs;
  private totalSlides = 0;
  private currentSlide = 0;

  constructor(options: PptxExportOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.pres = new pptxgenjs();
    this.initializePresentation();
  }

  /**
   * 初始化演示文稿
   */
  private initializePresentation(): void {
    // 设置元数据
    this.pres.author = this.options.author;
    this.pres.company = this.options.author;
    this.pres.subject = this.options.subject;
    this.pres.title = this.options.title;

    // 设置布局
    this.pres.layout = this.options.layout as SlideLayout;

    // 定义主母版
    this.pres.defineSlideMaster({
      title: "MASTER_SLIDE",
      background: { color: this.options.backgroundColor },
      objects: [
        {
          rect: {
            x: 0,
            y: 6.9,
            w: "100%",
            h: 0.6,
            fill: { color: this.options.masterColor },
          },
        },
      ],
    });
  }

  /**
   * 生成进度报告
   */
  private reportProgress(message: string): void {
    this.options.onProgress(this.currentSlide, this.totalSlides, message);
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * 生成封面页
   */
  private addTitleSlide(videoTitle: string, thumbnailData?: string): Slide {
    const slide = this.pres.addSlide({
      masterName: "MASTER_SLIDE",
    });

    // 标题
    slide.addText(videoTitle || this.options.title, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1.5,
      fontSize: 44,
      fontFace: this.options.fontFace,
      color: this.options.textColor,
      bold: true,
      align: "center",
      valign: "middle",
    });

    // 副标题
    slide.addText(`Generated by ${this.options.author}`, {
      x: 0.5,
      y: 3.2,
      w: 9,
      h: 0.5,
      fontSize: this.options.bodyFontSize,
      fontFace: this.options.fontFace,
      color: this.options.textColor,
      align: "center",
    });

    // 日期
    const today = new Date().toLocaleDateString();
    slide.addText(today, {
      x: 0.5,
      y: 3.8,
      w: 9,
      h: 0.4,
      fontSize: 14,
      fontFace: this.options.fontFace,
      color: this.options.textColor,
      align: "center",
    });

    // 缩略图（如果有）
    if (thumbnailData) {
      slide.addImage({
        data: thumbnailData.startsWith("data:")
          ? thumbnailData
          : `data:image/jpeg;base64,${thumbnailData}`,
        x: 3,
        y: 4.5,
        w: 4,
        h: 2.25,
        sizing: {
          type: this.options.imageFit,
          w: 4,
          h: 2.25,
        },
      });
    }

    this.currentSlide++;
    this.reportProgress("Created title slide");

    return slide;
  }

  /**
   * 生成目录页
   */
  private addTableOfContentsSlide(chapters: Chapter[]): Slide {
    const slide = this.pres.addSlide({
      masterName: "MASTER_SLIDE",
    });

    // 标题
    slide.addText("Table of Contents", {
      x: 0.5,
      y: 0.8,
      w: 9,
      h: 0.8,
      fontSize: this.options.titleFontSize,
      fontFace: this.options.fontFace,
      color: this.options.textColor,
      bold: true,
    });

    // 目录内容
    const tocItems = chapters.map((chapter, index) => ({
      text: `${index + 1}. ${chapter.title}`,
      options: {
        fontSize: this.options.bodyFontSize,
        fontFace: this.options.fontFace,
        color: this.options.textColor,
        breakLine: true,
      },
    }));

    slide.addText(tocItems, {
      x: 1,
      y: 1.8,
      w: 8,
      h: 4,
      fontFace: this.options.fontFace,
      color: this.options.textColor,
      bullet: false,
    });

    this.currentSlide++;
    this.reportProgress("Created table of contents");

    return slide;
  }

  /**
   * 添加章节幻灯片
   */
  private addChapterSlides(chapterDetail: ChapterDetail): Slide[] {
    const slides: Slide[] = [];
    const { chapter, segments, frames } = chapterDetail;
    const maxSlides = Math.min(Math.ceil(segments.length / 5), this.options.maxSlidesPerChapter);

    // 获取章节摘要或生成摘要
    const summary = chapter.summary || this.generateSummary(segments);

    // 主章节页
    const mainSlide = this.pres.addSlide({
      masterName: "MASTER_SLIDE",
    });

    // 章节标题和时间
    const titleText = `${chapter.title}`;
    const timeText = `${this.formatTimestamp(chapter.start_time)} - ${this.formatTimestamp(chapter.end_time)}`;

    mainSlide.addText(
      [
        {
          text: titleText,
          options: {
            fontSize: this.options.titleFontSize,
            fontFace: this.options.fontFace,
            color: this.options.textColor,
            bold: true,
          },
        },
        {
          text: `\n${timeText}`,
          options: {
            fontSize: 16,
            fontFace: this.options.fontFace,
            color: this.options.textColor,
          },
        },
      ],
      {
        x: 0.5,
        y: 0.5,
        w: "40%",
        h: 1.5,
      },
    );

    // 添加图片（如果有）
    const coverFrame = this.getBestFrame(frames, chapter.start_time, chapter.end_time);
    let imageData: string | undefined;

    if (coverFrame) {
      imageData = this.frameToBase64(coverFrame);
      if (imageData) {
        mainSlide.addImage({
          data: imageData,
          x: 5.5,
          y: 1,
          w: 4,
          h: 2.25,
          sizing: {
            type: this.options.imageFit,
            w: 4,
            h: 2.25,
          },
        });
      }
    }

    // 章节摘要
    mainSlide.addText(summary, {
      x: 0.5,
      y: 2.2,
      w: imageData ? 4.5 : 9,
      h: 3.5,
      fontSize: this.options.bodyFontSize,
      fontFace: this.options.fontFace,
      color: this.options.textColor,
      valign: "top",
    });

    // 添加演讲者备注
    const notes = this.generateNotes(segments, chapter);
    if (notes) {
      mainSlide.addNotes(notes);
    }

    slides.push(mainSlide);
    this.currentSlide++;
    this.reportProgress(`Created chapter slide: ${chapter.title}`);

    // 如果内容较多，添加详情页
    if (segments.length > 5 && maxSlides > 1) {
      const detailSlides = this.addDetailSlides(chapterDetail);
      slides.push(...detailSlides);
    }

    return slides;
  }

  /**
   * 添加详情幻灯片
   */
  private addDetailSlides(chapterDetail: ChapterDetail): Slide[] {
    const slides: Slide[] = [];
    const { chapter, segments, frames } = chapterDetail;

    const segmentsPerSlide = Math.ceil(
      segments.length / Math.min(this.options.maxSlidesPerChapter - 1, 2),
    );

    for (let i = 0; i < segments.length; i += segmentsPerSlide) {
      const slideSegments = segments.slice(i, i + segmentsPerSlide);
      const slide = this.pres.addSlide({
        masterName: "MASTER_SLIDE",
      });

      // 标题
      slide.addText(`${chapter.title} (Details)`, {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.6,
        fontSize: this.options.titleFontSize,
        fontFace: this.options.fontFace,
        color: this.options.textColor,
        bold: true,
      });

      // 内容
      const content = slideSegments
        .map((s) => s.text)
        .join(" ")
        .slice(0, this.options.maxCharsPerSlide);

      slide.addText(content, {
        x: 0.5,
        y: 1.3,
        w: 5,
        h: 5,
        fontSize: this.options.bodyFontSize,
        fontFace: this.options.fontFace,
        color: this.options.textColor,
        valign: "top",
      });

      // 添加图片
      const frameIndex = Math.floor(i / segmentsPerSlide);
      const frame = frames[frameIndex];
      if (frame) {
        const imageData = this.frameToBase64(frame);
        if (imageData) {
          slide.addImage({
            data: imageData,
            x: 6,
            y: 1.3,
            w: 3.5,
            h: 2,
            sizing: {
              type: this.options.imageFit,
              w: 3.5,
              h: 2,
            },
          });
        }
      }

      // 备注
      const notes = this.generateNotes(slideSegments, chapter);
      if (notes) {
        slide.addNotes(notes);
      }

      slides.push(slide);
      this.currentSlide++;
      this.reportProgress(`Created detail slide ${slides.length} for: ${chapter.title}`);
    }

    return slides;
  }

  /**
   * 生成结束页
   */
  private addThankYouSlide(): Slide {
    const slide = this.pres.addSlide({
      masterName: "MASTER_SLIDE",
    });

    slide.addText("Thank You", {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 1.5,
      fontSize: 48,
      fontFace: this.options.fontFace,
      color: this.options.textColor,
      bold: true,
      align: "center",
      valign: "middle",
    });

    slide.addText(`Generated by ${this.options.author}`, {
      x: 0.5,
      y: 4.2,
      w: 9,
      h: 0.5,
      fontSize: this.options.bodyFontSize,
      fontFace: this.options.fontFace,
      color: this.options.textColor,
      align: "center",
    });

    this.currentSlide++;
    this.reportProgress("Created thank you slide");

    return slide;
  }

  /**
   * 生成摘要
   */
  private generateSummary(segments: TranscriptSegment[]): string {
    const text = segments
      .map((s) => s.text)
      .join(" ")
      .slice(0, this.options.maxCharsPerSlide);

    // 移除不完整的句子
    const lastPeriod = Math.max(
      text.lastIndexOf("."),
      text.lastIndexOf("!"),
      text.lastIndexOf("?"),
      text.lastIndexOf("。"),
      text.lastIndexOf("！"),
      text.lastIndexOf("？"),
    );

    if (lastPeriod > this.options.maxCharsPerSlide * 0.5) {
      return text.slice(0, lastPeriod + 1);
    }

    return text + "...";
  }

  /**
   * 生成演讲者备注
   */
  private generateNotes(segments: TranscriptSegment[], chapter?: Chapter): string {
    const notes: string[] = [];

    if (chapter && this.options.includeTimestampsInNotes) {
      notes.push(`Chapter: ${chapter.title}`);
      notes.push(
        `Time: ${this.formatTimestamp(chapter.start_time)} - ${this.formatTimestamp(chapter.end_time)}`,
      );
      notes.push("");
    }

    if (this.options.includeTimestampsInNotes) {
      segments.forEach((segment) => {
        const time = this.formatTimestamp(segment.start_time);
        notes.push(`[${time}] ${segment.text}`);
      });
    } else {
      notes.push(segments.map((s) => s.text).join(" "));
    }

    return notes.join("\n");
  }

  /**
   * 获取最佳关键帧
   */
  private getBestFrame(
    frames: KeyFrame[],
    startTime: number,
    endTime: number,
  ): KeyFrame | undefined {
    // 筛选在章节时间范围内的帧
    const chapterFrames = frames.filter((f) => f.timestamp >= startTime && f.timestamp <= endTime);

    if (chapterFrames.length === 0) {
      return frames[0];
    }

    // 返回最接近章节中间位置的帧
    const middleTime = (startTime + endTime) / 2;
    return chapterFrames.reduce((best, frame) => {
      const bestDiff = Math.abs(best.timestamp - middleTime);
      const frameDiff = Math.abs(frame.timestamp - middleTime);
      return frameDiff < bestDiff ? frame : best;
    });
  }

  /**
   * 将帧数据转换为 base64
   */
  private frameToBase64(frame: KeyFrame): string | undefined {
    try {
      // 假设 image_data 是 JPEG 格式的字节数组
      const uint8Array = new Uint8Array(frame.image_data);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      return `data:image/jpeg;base64,${btoa(binary)}`;
    } catch (error) {
      console.warn("Failed to convert frame to base64:", error);
      return undefined;
    }
  }

  /**
   * 将字幕片段按章节分组
   */
  private groupSegmentsByChapters(
    segments: TranscriptSegment[],
    chapters: Chapter[],
  ): Map<string, TranscriptSegment[]> {
    const grouped = new Map<string, TranscriptSegment[]>();

    // 初始化
    chapters.forEach((chapter) => {
      grouped.set(chapter.id, []);
    });

    // 分组
    segments.forEach((segment) => {
      const chapter = chapters.find(
        (ch) => segment.start_time >= ch.start_time && segment.end_time <= ch.end_time,
      );
      if (chapter) {
        const group = grouped.get(chapter.id) || [];
        group.push(segment);
        grouped.set(chapter.id, group);
      }
    });

    return grouped;
  }

  /**
   * 导出为 Blob
   */
  private async exportToBlob(filename: string): Promise<PptxExportResult> {
    try {
      // pptxgenjs 3.x 使用 write 方法并设置 outputType
      const result = await this.pres.write({ outputType: "blob" });
      const blob = result as Blob;

      const url = URL.createObjectURL(blob);

      return {
        success: true,
        filename,
        url,
        slideCount: this.currentSlide,
        fileSize: blob.size,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================
  // 公共 API
  // ============================================

  /**
   * 从视频处理数据生成完整的 PPTX
   */
  public async generateFromVideoData(
    videoTitle: string,
    chapters: Chapter[],
    segments: TranscriptSegment[],
    frames: KeyFrame[],
    thumbnailData?: string,
  ): Promise<PptxExportResult> {
    try {
      // 估算总幻灯片数
      const estimatedSlides =
        (this.options.includeTitleSlide ? 1 : 0) +
        (this.options.includeTableOfContents && chapters.length > 0 ? 1 : 0) +
        chapters.length * Math.min(this.options.maxSlidesPerChapter, 2) +
        (this.options.includeThankYouSlide ? 1 : 0);

      this.totalSlides = estimatedSlides;
      this.currentSlide = 0;

      this.reportProgress("Starting PPTX generation...");

      // 添加封面页
      if (this.options.includeTitleSlide) {
        this.addTitleSlide(videoTitle, thumbnailData);
      }

      // 添加目录页
      if (this.options.includeTableOfContents && chapters.length > 0) {
        this.addTableOfContentsSlide(chapters);
      }

      // 添加章节幻灯片
      const segmentGroups = this.groupSegmentsByChapters(segments, chapters);

      for (const chapter of chapters) {
        const chapterSegments = segmentGroups.get(chapter.id) || [];
        const chapterFrames = frames.filter(
          (f) => f.timestamp >= chapter.start_time && f.timestamp <= chapter.end_time,
        );

        if (chapterSegments.length > 0 || chapterFrames.length > 0) {
          this.addChapterSlides({
            chapter,
            segments: chapterSegments,
            frames: chapterFrames,
          });
        }
      }

      // 添加结束页
      if (this.options.includeThankYouSlide) {
        this.addThankYouSlide();
      }

      this.reportProgress("Generating PPTX file...");

      // 生成文件名
      const sanitizedTitle = videoTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
      const filename = `${sanitizedTitle}_presentation.pptx`;

      return await this.exportToBlob(filename);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 从幻灯片内容数组生成 PPTX
   */
  public async generateFromSlideContents(
    slides: SlideContent[],
    title?: string,
  ): Promise<PptxExportResult> {
    try {
      this.totalSlides = slides.length;
      this.currentSlide = 0;

      this.reportProgress("Generating slides from content...");

      for (const slideContent of slides) {
        const slide = this.pres.addSlide({
          masterName: "MASTER_SLIDE",
        });

        // 标题
        slide.addText(slideContent.title, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 0.8,
          fontSize: this.options.titleFontSize,
          fontFace: this.options.fontFace,
          color: this.options.textColor,
          bold: true,
        });

        // 内容
        let x = 0.5;
        let width = 9;

        // 如果有图片，调整布局
        if (slideContent.imageData) {
          const imageData =
            typeof slideContent.imageData === "string"
              ? slideContent.imageData
              : `data:${slideContent.imageData.type};base64,${slideContent.imageData.data}`;

          slide.addImage({
            data: imageData,
            x: 5.5,
            y: 1.5,
            w: 4,
            h: 2.25,
            sizing: {
              type: this.options.imageFit,
              w: 4,
              h: 2.25,
            },
          });

          x = 0.5;
          width = 4.5;
        }

        slide.addText(slideContent.body, {
          x,
          y: 1.5,
          w: width,
          h: 4,
          fontSize: this.options.bodyFontSize,
          fontFace: this.options.fontFace,
          color: this.options.textColor,
          valign: "top",
        });

        // 备注
        if (slideContent.notes) {
          slide.addNotes(slideContent.notes);
        }

        this.currentSlide++;
        this.reportProgress(`Created slide: ${slideContent.title}`);
      }

      const filename = `${title ? title.replace(/[^a-zA-Z0-9]/g, "_") : "presentation"}.pptx`;

      return await this.exportToBlob(filename);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 下载生成的 PPTX 文件
   */
  public async download(result: PptxExportResult): Promise<void> {
    if (!result.success || !result.url) {
      throw new Error("Cannot download: PPTX generation failed");
    }

    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename || "presentation.pptx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 延迟释放 URL
    setTimeout(() => URL.revokeObjectURL(result.url!), 1000);
  }

  /**
   * 生成并直接下载
   */
  public async generateAndDownload(
    videoTitle: string,
    chapters: Chapter[],
    segments: TranscriptSegment[],
    frames: KeyFrame[],
    thumbnailData?: string,
  ): Promise<PptxExportResult> {
    const result = await this.generateFromVideoData(
      videoTitle,
      chapters,
      segments,
      frames,
      thumbnailData,
    );

    if (result.success) {
      await this.download(result);
    }

    return result;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 PPTX 导出器实例
 */
export function createPptxExporter(options?: PptxExportOptions): PptxExporter {
  return new PptxExporter(options);
}

/**
 * 快速导出函数 - 一步生成并下载 PPTX
 */
export async function exportToPptx(
  videoTitle: string,
  chapters: Chapter[],
  segments: TranscriptSegment[],
  frames: KeyFrame[],
  options?: PptxExportOptions,
): Promise<PptxExportResult> {
  const exporter = createPptxExporter(options);
  return exporter.generateAndDownload(videoTitle, chapters, segments, frames);
}

/**
 * 从幻灯片内容快速导出
 */
export async function exportSlidesToPptx(
  slides: SlideContent[],
  title?: string,
  options?: PptxExportOptions,
): Promise<PptxExportResult> {
  const exporter = createPptxExporter(options);
  const result = await exporter.generateFromSlideContents(slides, title);

  if (result.success) {
    await exporter.download(result);
  }

  return result;
}

// ============================================
// 内存管理工具
// ============================================

/**
 * 分批处理大量数据
 */
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);

    // 让出主线程以避免阻塞
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return results;
}

/**
 * 优化帧数据以减少内存使用
 */
export function optimizeFrames(frames: KeyFrame[]): KeyFrame[] {
  return frames.map((frame) => {
    // 这里可以添加图像压缩逻辑
    // 目前只返回原始数据
    return frame;
  });
}

/**
 * 清理旧的 Blob URL
 */
export function revokeBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}
