"use client";

import { useRef, useState, useCallback } from "react";
import {
  Upload,
  Link as LinkIcon,
  FileVideo,
  X,
  AlertCircle,
  CheckCircle2,
  Youtube,
} from "lucide-react";

interface VideoUploaderProps {
  onVideoSelect: (source: { type: "file" | "url"; data: string | File }) => void;
  isLoading?: boolean;
  useWhisper?: boolean;
  useOcr?: boolean;
  onToggleWhisper?: (enabled: boolean) => void;
  onToggleOcr?: (enabled: boolean) => void;
}

// Video file size limits (in bytes)
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const SUPPORTED_VIDEO_FORMATS = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
];

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
];

export function VideoUploader({
  onVideoSelect,
  isLoading = false,
  useWhisper = true,
  useOcr = true,
  onToggleWhisper,
  onToggleOcr,
}: VideoUploaderProps) {
  const [urlInput, setUrlInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isValidVideoFile = (file: File): boolean => {
    if (!file.type) {
      // If no type, check extension
      const validExtensions = [".mp4", ".webm", ".mov", ".avi", ".mpeg", ".mkv"];
      return validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    }
    return SUPPORTED_VIDEO_FORMATS.includes(file.type) || file.type.startsWith("video/");
  };

  const extractYoutubeVideoId = useCallback((input: string): string | null => {
    for (const pattern of YOUTUBE_PATTERNS) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }, []);

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    if (!isValidVideoFile(file)) {
      return {
        valid: false,
        error: "Invalid file format. Please upload a video file (MP4, WebM, MOV, AVI)",
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`,
      };
    }
    return { valid: true };
  }, []);

  const handleFileChange = useCallback(
    (file: File) => {
      setDragError(null);
      const validation = validateFile(file);
      if (!validation.valid) {
        setDragError(validation.error || "Invalid file");
        return;
      }
      setSelectedFile(file);
      onVideoSelect({ type: "file", data: file });
    },
    [onVideoSelect, validateFile],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
      setDragError(null);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      dragCounterRef.current = 0;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileChange(file);
      }
    },
    [handleFileChange],
  );

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setDragError(null);

      if (!urlInput.trim()) {
        setDragError("Please enter a URL");
        return;
      }

      const videoId = extractYoutubeVideoId(urlInput.trim());
      if (videoId) {
        // Valid YouTube URL
        onVideoSelect({ type: "url", data: urlInput.trim() });
      } else if (urlInput.trim().startsWith("http")) {
        // Direct video URL
        onVideoSelect({ type: "url", data: urlInput.trim() });
      } else {
        setDragError("Invalid URL. Please enter a valid YouTube or video URL");
      }
    },
    [urlInput, onVideoSelect, extractYoutubeVideoId],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileChange(file);
      }
    },
    [handleFileChange],
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const getUploadZoneClassName = () => {
    const baseClasses =
      "relative border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-all duration-300";
    if (dragActive) {
      return `${baseClasses} border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/20`;
    }
    if (dragError) {
      return `${baseClasses} border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20`;
    }
    if (selectedFile) {
      return `${baseClasses} border-green-500 bg-green-50 dark:bg-green-900/20`;
    }
    return `${baseClasses} border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Processing Options */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Processing Options
        </h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useWhisper}
              onChange={(e) => onToggleWhisper?.(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Enable Whisper Transcription
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useOcr}
              onChange={(e) => onToggleOcr?.(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Enable OCR Text Recognition
            </span>
          </label>
        </div>
      </div>
      {/* File Upload Area */}
      <div
        className={getUploadZoneClassName()}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.webm,.mov,.avi,.mpeg,.mkv"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isLoading}
        />

        {selectedFile ? (
          // File selected state
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={clearFile}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 inline mr-1" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                Change File
              </button>
            </div>
          </div>
        ) : (
          // Default state
          <div className="space-y-4">
            <div
              className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center transition-colors ${
                dragActive ? "bg-blue-100 dark:bg-blue-900/30" : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              {dragActive ? (
                <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-bounce" />
              ) : (
                <FileVideo className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              )}
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {dragActive ? "Drop your video here" : "Upload a video file"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Drag and drop or click to browse
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select Video File
            </button>
            {dragError && (
              <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-sm mt-2">
                <AlertCircle className="w-4 h-4" />
                <span>{dragError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
            or
          </span>
        </div>
      </div>

      {/* URL Input */}
      <form onSubmit={handleUrlSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Paste a video URL
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <Youtube className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setDragError(null);
              }}
              disabled={isLoading}
              className={`w-full pl-11 pr-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                dragError && urlInput
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={!urlInput.trim() || isLoading}
            className="px-6 py-3 bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow whitespace-nowrap"
          >
            Load URL
          </button>
        </div>
        {dragError && urlInput && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{dragError}</span>
          </div>
        )}
      </form>

      {/* Supported Formats Info */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="font-medium">Supported formats:</span>
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">MP4</span>
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">WebM</span>
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">MOV</span>
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">AVI</span>
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">YouTube</span>
        <span className="ml-2">Max file size: 500MB</span>
      </div>
    </div>
  );
}
