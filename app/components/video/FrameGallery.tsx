"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { KeyFrame } from "@/app/lib/wasm";
import { Image as ImageIcon, Maximize2, Download, Search, Grid3x3, List, X } from "lucide-react";

interface FrameGalleryProps {
  frames: KeyFrame[];
  isProcessing?: boolean;
}

type ViewMode = "grid" | "list";

export function FrameGallery({ frames, isProcessing = false }: FrameGalleryProps) {
  const [selectedFrame, setSelectedFrame] = useState<KeyFrame | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const createImageUrl = useCallback(
    (frame: KeyFrame) => {
      if (imageUrls.has(frame.id)) {
        return imageUrls.get(frame.id)!;
      }

      if (frame.image_data && frame.image_data.length > 0) {
        const uint8Array = new Uint8Array(frame.image_data);
        const blob = new Blob([uint8Array], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        setImageUrls((prev) => new Map(prev).set(frame.id, url));
        return url;
      }
      return null;
    },
    [imageUrls],
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  const filteredFrames = frames.filter((frame) => {
    if (!searchQuery.trim()) return true;
    const timeStr = formatTime(frame.timestamp);
    const ocrText = frame.ocr_text?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return timeStr.includes(query) || ocrText.includes(query);
  });

  const downloadFrame = useCallback(
    (frame: KeyFrame) => {
      const url = createImageUrl(frame);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `frame-${formatTime(frame.timestamp)}.jpg`;
        a.click();
      }
    },
    [createImageUrl, formatTime],
  );

  const downloadAllFrames = useCallback(() => {
    // In a real app, this would create a ZIP file
    frames.forEach((frame, index) => {
      setTimeout(() => downloadFrame(frame), index * 100);
    });
  }, [frames, downloadFrame]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
              <ImageIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Key Frames
              </h2>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                {frames.length} {frames.length === 1 ? "frame" : "frames"} extracted
                {isProcessing && " (processing...)"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    : "bg-transparent text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                aria-label="Grid view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${
                  viewMode === "list"
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    : "bg-transparent text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {frames.length > 0 && (
              <button
                onClick={downloadAllFrames}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Download all frames"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        {frames.length > 5 && (
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by timestamp or OCR text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        )}
      </div>

      {/* Content */}
      {frames.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            {isProcessing ? (
              <ImageIcon className="w-8 h-8 text-gray-400 animate-pulse" />
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {isProcessing ? "Extracting frames..." : "No frames extracted yet"}
          </p>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 md:p-6">
              {filteredFrames.map((frame) => {
                const imageUrl = createImageUrl(frame);
                return (
                  <div
                    key={frame.id}
                    className="group relative aspect-video bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setSelectedFrame(frame)}
                  >
                    {imageUrl ? (
                      <>
                        <img
                          src={imageUrl}
                          alt={`Frame at ${formatTime(frame.timestamp)}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-white text-xs font-mono font-medium">
                                {formatTime(frame.timestamp)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadFrame(frame);
                                }}
                                className="p-1.5 bg-white/20 hover:bg-white/30 rounded backdrop-blur-sm transition-colors"
                                aria-label="Download frame"
                              >
                                <Download className="w-3 h-3 text-white" />
                              </button>
                            </div>
                            {frame.ocr_text && (
                              <p className="text-white/80 text-xs mt-1 line-clamp-1">
                                {frame.ocr_text}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Expand icon on hover */}
                        <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-3 h-3 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <ImageIcon className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* List View */}
          {viewMode === "list" && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {filteredFrames.map((frame) => {
                const imageUrl = createImageUrl(frame);
                return (
                  <div
                    key={frame.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedFrame(frame)}
                  >
                    <div className="w-24 h-14 flex-shrink-0 bg-gray-100 dark:bg-gray-900 rounded overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`Frame at ${formatTime(frame.timestamp)}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatTime(frame.timestamp)}
                      </p>
                      {frame.ocr_text && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {frame.ocr_text}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFrame(frame);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      aria-label="Download frame"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* No search results */}
          {filteredFrames.length === 0 && searchQuery && (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              No frames match "{searchQuery}"
            </div>
          )}
        </>
      )}

      {/* Lightbox Modal */}
      {selectedFrame && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedFrame(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setSelectedFrame(null)}
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const imageUrl = createImageUrl(selectedFrame);
              return imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Frame at ${formatTime(selectedFrame.timestamp)}`}
                  className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                />
              ) : null;
            })()}

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-mono text-lg">
                    {formatTime(selectedFrame.timestamp)}
                  </p>
                  {selectedFrame.ocr_text && (
                    <p className="text-white/80 text-sm mt-1 max-w-2xl">{selectedFrame.ocr_text}</p>
                  )}
                </div>
                <button
                  onClick={() => downloadFrame(selectedFrame)}
                  className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-colors"
                  aria-label="Download frame"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
