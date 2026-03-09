/**
 * React Hook for PPTX Export
 * 提供便捷的 PPTX 导出功能
 */

import { useState, useCallback, useRef } from "react";
import type {
  PptxExportOptions,
  PptxExportResult,
  Chapter,
  KeyFrame,
  TranscriptSegment,
} from "../lib/export";

export interface PptxExportState {
  isExporting: boolean;
  progress: number;
  totalSlides: number;
  currentSlide: number;
  message: string;
  error: string | null;
}

export interface UsePptxExportOptions extends PptxExportOptions {
  /** 导出完成后的回调 */
  onExportComplete?: (result: PptxExportResult) => void;
  /** 导出失败后的回调 */
  onExportError?: (error: string) => void;
}

export function usePptxExport(options: UsePptxExportOptions = {}) {
  const [state, setState] = useState<PptxExportState>({
    isExporting: false,
    progress: 0,
    totalSlides: 0,
    currentSlide: 0,
    message: "",
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      isExporting: false,
      progress: 0,
      totalSlides: 0,
      currentSlide: 0,
      message: "",
      error: null,
    });
  }, []);

  /**
   * 导出 PPTX
   */
  const exportPptx = useCallback(
    async (
      videoTitle: string,
      chapters: Chapter[],
      segments: TranscriptSegment[],
      frames: KeyFrame[],
      thumbnailData?: string,
    ): Promise<PptxExportResult> => {
      // 动态导入以避免 SSR 问题
      const { createPptxExporter } = await import("../lib/export");

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setState({
        isExporting: true,
        progress: 0,
        totalSlides: 0,
        currentSlide: 0,
        message: "Initializing...",
        error: null,
      });

      try {
        const exporter = createPptxExporter({
          ...options,
          onProgress: (current, total, message) => {
            if (signal.aborted) return;

            setState((prev) => ({
              ...prev,
              currentSlide: current,
              totalSlides: total,
              progress: total > 0 ? (current / total) * 100 : 0,
              message,
            }));
          },
        });

        const result = await exporter.generateFromVideoData(
          videoTitle,
          chapters,
          segments,
          frames,
          thumbnailData,
        );

        if (signal.aborted) {
          throw new Error("Export was cancelled");
        }

        if (result.success) {
          setState({
            isExporting: false,
            progress: 100,
            totalSlides: result.slideCount || 0,
            currentSlide: result.slideCount || 0,
            message: "Export completed successfully!",
            error: null,
          });

          options.onExportComplete?.(result);
        } else {
          setState({
            isExporting: false,
            progress: 0,
            totalSlides: 0,
            currentSlide: 0,
            message: "",
            error: result.error || "Export failed",
          });

          options.onExportError?.(result.error || "Export failed");
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        setState({
          isExporting: false,
          progress: 0,
          totalSlides: 0,
          currentSlide: 0,
          message: "",
          error: errorMessage,
        });

        options.onExportError?.(errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    [options],
  );

  /**
   * 导出并直接下载
   */
  const exportAndDownload = useCallback(
    async (
      videoTitle: string,
      chapters: Chapter[],
      segments: TranscriptSegment[],
      frames: KeyFrame[],
      thumbnailData?: string,
    ): Promise<PptxExportResult> => {
      const result = await exportPptx(videoTitle, chapters, segments, frames, thumbnailData);

      if (result.success) {
        const { createPptxExporter } = await import("../lib/export");
        const exporter = createPptxExporter(options);
        await exporter.download(result);
      }

      return result;
    },
    [exportPptx, options],
  );

  /**
   * 取消导出
   */
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({
      ...prev,
      isExporting: false,
      message: "Export cancelled",
    }));
  }, []);

  return {
    exportPptx,
    exportAndDownload,
    cancel,
    reset,
    state,
  };
}
