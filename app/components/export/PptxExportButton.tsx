/**
 * PPTX Export Button Component
 * 提供导出为 PowerPoint 的按钮组件
 */

"use client";

import React, { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { usePptxExport } from "../../hooks/usePptxExport";
import type { Chapter, KeyFrame, TranscriptSegment } from "../../lib/export";

export interface PptxExportButtonProps {
  /** 视频标题 */
  videoTitle: string;
  /** 章节数据 */
  chapters: Chapter[];
  /** 字幕片段数据 */
  segments: TranscriptSegment[];
  /** 关键帧数据 */
  frames: KeyFrame[];
  /** 缩略图数据 (base64) */
  thumbnailData?: string;
  /** 按钮文本 */
  label?: string;
  /** 按钮变体 */
  variant?: "primary" | "secondary" | "ghost";
  /** 按钮大小 */
  size?: "sm" | "md" | "lg";
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 导出选项 */
  exportOptions?: Parameters<typeof usePptxExport>[0];
}

export function PptxExportButton({
  videoTitle,
  chapters,
  segments,
  frames,
  thumbnailData,
  label = "Export to PPTX",
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  exportOptions = {},
}: PptxExportButtonProps) {
  const [showProgress, setShowProgress] = useState(false);
  const { exportAndDownload, state } = usePptxExport({
    ...exportOptions,
    onExportComplete: () => {
      setTimeout(() => setShowProgress(false), 2000);
    },
    onExportError: (error) => {
      console.error("PPTX export failed:", error);
      setTimeout(() => setShowProgress(false), 3000);
    },
  });

  const handleExport = async () => {
    setShowProgress(true);
    await exportAndDownload(videoTitle, chapters, segments, frames, thumbnailData);
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-600 hover:bg-gray-700 text-white",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700 border border-gray-300",
  };

  const isExporting = state.isExporting;

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={disabled || isExporting}
        className={`
          flex items-center gap-2 rounded-md font-medium transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${className}
        `}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        <span>{isExporting ? "Exporting..." : label}</span>
      </button>

      {/* 进度浮层 */}
      {showProgress && (isExporting || state.message) && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[250px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {state.isExporting ? "Exporting..." : state.error ? "Error" : "Complete"}
              </span>
              <span className="text-xs text-gray-500">
                {state.currentSlide} / {state.totalSlides}
              </span>
            </div>

            {/* 进度条 */}
            {state.isExporting && state.totalSlides > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            )}

            {/* 状态消息 */}
            <p className="text-xs text-gray-600 truncate">{state.message || state.error}</p>

            {/* 错误时显示重试按钮 */}
            {state.error && !state.isExporting && (
              <button
                onClick={handleExport}
                className="mt-2 w-full text-sm text-blue-600 hover:text-blue-700"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * PPTX Export Control Panel Component
 * 提供更详细的导出控制和预览
 */
export interface PptxExportControlProps {
  videoTitle: string;
  chapters: Chapter[];
  segments: TranscriptSegment[];
  frames: KeyFrame[];
  thumbnailData?: string;
}

export function PptxExportControl({
  videoTitle,
  chapters,
  segments,
  frames,
  thumbnailData,
}: PptxExportControlProps) {
  const [options, setOptions] = useState({
    includeTitleSlide: true,
    includeTableOfContents: true,
    includeThankYouSlide: true,
    includeTimestampsInNotes: true,
    layout: "16x9" as const,
  });

  const { exportAndDownload, state } = usePptxExport({
    ...options,
  });

  const handleExport = async () => {
    await exportAndDownload(videoTitle, chapters, segments, frames, thumbnailData);
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Export to PowerPoint</h3>
        <p className="text-sm text-gray-600">
          Generate a presentation with {chapters.length} chapters and {frames.length} frames
        </p>
      </div>

      {/* 导出选项 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.includeTitleSlide}
            onChange={(e) => setOptions({ ...options, includeTitleSlide: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Include title slide</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.includeTableOfContents}
            onChange={(e) => setOptions({ ...options, includeTableOfContents: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Include table of contents</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.includeThankYouSlide}
            onChange={(e) => setOptions({ ...options, includeThankYouSlide: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Include thank you slide</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.includeTimestampsInNotes}
            onChange={(e) => setOptions({ ...options, includeTimestampsInNotes: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Include timestamps in notes</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Layout:</span>
          <select
            value={options.layout}
            onChange={(e) => setOptions({ ...options, layout: e.target.value as any })}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="16x9">16:9 (Widescreen)</option>
            <option value="16x10">16:10</option>
            <option value="4x3">4:3 (Standard)</option>
            <option value="A4">A4</option>
            <option value="LETTER">Letter</option>
          </select>
        </div>
      </div>

      {/* 进度显示 */}
      {state.isExporting && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{state.message}</span>
            <span className="text-gray-500">
              {state.currentSlide} / {state.totalSlides}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 导出按钮 */}
      <button
        onClick={handleExport}
        disabled={state.isExporting}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
      >
        {state.isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export PPTX
          </>
        )}
      </button>

      {/* 错误提示 */}
      {state.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
          {state.error}
        </div>
      )}
    </div>
  );
}
