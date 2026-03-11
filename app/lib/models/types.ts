/**
 * Database Type Definitions
 * Defines TypeScript types for IndexedDB schema matching the Rust WASM models
 */

/**
 * Job status enum - 使用首字母大写格式（与 wasm.ts 保持一致）
 */
export enum JobStatus {
  Pending = "Pending",
  Processing = "Processing",
  Completed = "Completed",
  Failed = "Failed",
}

/**
 * Job status type alias for easier use
 */
export type JobStatusType = "Pending" | "Processing" | "Completed" | "Failed";

/**
 * Video job - main processing job for a video
 */
export interface VideoJob {
  id: string;
  sourceUrl?: string;
  fileName: string;
  duration: number;
  width: number;
  height: number;
  createdAt: number;
  status: JobStatus;
  progress: number;
  errorMessage?: string;
  thumbnailData?: string; // Base64 encoded thumbnail
}

/**
 * Transcript segment - subtitle/OCR text segment
 */
export interface TranscriptSegment {
  id: string;
  jobId: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  language?: string;
  createdAt: number;
}

/**
 * Key frame - extracted frame from video
 */
export interface KeyFrame {
  id: string;
  jobId: string;
  timestamp: number;
  imageData: string; // Base64 encoded image data
  ocrText?: string;
  chapterId?: string;
  createdAt: number;
  frameNumber?: number;
}

/**
 * Chapter - video chapter/section
 */
export interface Chapter {
  id: string;
  jobId: string;
  title: string;
  startTime: number;
  endTime: number;
  summary?: string;
  createdAt: number;
  frameId?: string; // Reference to representative frame
}

/**
 * Job export data - for full job export
 */
export interface JobExportData {
  job: VideoJob;
  segments: TranscriptSegment[];
  frames: KeyFrame[];
  chapters: Chapter[];
  exportedAt: number;
  version: string;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  pendingJobs: number;
  totalSegments: number;
  totalFrames: number;
  totalChapters: number;
  storageUsed: number;
}

/**
 * Query filters for jobs
 */
export interface JobQueryFilters {
  status?: JobStatus;
  fileName?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

/**
 * Export options
 */
export interface ExportOptions {
  includeFrames?: boolean;
  includeSegments?: boolean;
  includeChapters?: boolean;
  format?: "json" | "csv" | "md";
}
