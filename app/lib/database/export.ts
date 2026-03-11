/**
 * Data Export/Import Utilities
 * Provides functionality to export and import database data
 */

import type { VideoDatabase } from "./indexeddb";
import type { JobExportData, ExportOptions } from "../models/types";

/**
 * Export format types
 */
export type ExportFormat = "json" | "csv" | "md";

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  size: number;
  filename: string;
  data: string | Blob;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  jobsImported: number;
  errors: string[];
}

/**
 * Export database to file
 */
export async function exportToFile(
  db: VideoDatabase,
  jobIds?: string[],
  options: ExportOptions = {},
): Promise<ExportResult> {
  const format = (options.format || "json") as ExportFormat;
  const data = await db.exportDatabase(jobIds);

  let result: ExportResult;

  switch (format) {
    case "json":
      result = await exportAsJSON(data, options);
      break;
    case "csv":
      result = await exportAsCSV(data, options);
      break;
    case "md":
      result = await exportAsMarkdown(data, options);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  return result;
}

/**
 * Export as JSON
 */
async function exportAsJSON(data: JobExportData[], options: ExportOptions): Promise<ExportResult> {
  const exportData = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    jobs: data,
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const filename = `yt-subtitle-export-${Date.now()}.json`;

  return {
    success: true,
    format: "json",
    size: blob.size,
    filename,
    data: blob,
  };
}

/**
 * Export as CSV
 */
async function exportAsCSV(data: JobExportData[], options: ExportOptions): Promise<ExportResult> {
  const lines: string[] = [];

  for (const jobData of data) {
    const { job, segments, chapters } = jobData;

    // Job metadata
    lines.push(`# Job: ${job.fileName}`);
    lines.push(`ID,${job.id}`);
    lines.push(`Status,${job.status}`);
    lines.push(`Duration,${job.duration}`);
    lines.push(`Created,${new Date(job.createdAt).toISOString()}`);
    lines.push("");

    // Segments
    if (options.includeSegments !== false && segments.length > 0) {
      lines.push("## Segments");
      lines.push("Start Time,End Time,Text,Confidence");
      for (const segment of segments) {
        const text = segment.text.replace(/"/g, '""'); // Escape quotes
        lines.push(`${segment.startTime},${segment.endTime},"${text}",${segment.confidence}`);
      }
      lines.push("");
    }

    // Chapters
    if (options.includeChapters !== false && chapters.length > 0) {
      lines.push("## Chapters");
      lines.push("Title,Start Time,End Time,Summary");
      for (const chapter of chapters) {
        const summary = (chapter.summary || "").replace(/"/g, '""');
        lines.push(`"${chapter.title}",${chapter.startTime},${chapter.endTime},"${summary}"`);
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  const csvString = lines.join("\n");
  const blob = new Blob([csvString], { type: "text/csv" });
  const filename = `yt-subtitle-export-${Date.now()}.csv`;

  return {
    success: true,
    format: "csv",
    size: blob.size,
    filename,
    data: blob,
  };
}

/**
 * Export as Markdown
 */
async function exportAsMarkdown(
  data: JobExportData[],
  options: ExportOptions,
): Promise<ExportResult> {
  const lines: string[] = [];

  lines.push("# YouTube Subtitle Export");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  for (const jobData of data) {
    const { job, segments, frames, chapters } = jobData;

    lines.push(`## ${job.fileName}`);
    lines.push("");

    // Metadata
    lines.push("### Metadata");
    lines.push(`- **ID**: ${job.id}`);
    lines.push(`- **Duration**: ${formatDuration(job.duration)}`);
    lines.push(`- **Resolution**: ${job.width}x${job.height}`);
    lines.push(`- **Status**: ${job.status}`);
    lines.push(`- **Created**: ${new Date(job.createdAt).toISOString()}`);
    lines.push("");

    // Chapters
    if (options.includeChapters !== false && chapters.length > 0) {
      lines.push("### Chapters");
      lines.push("");
      for (const chapter of chapters) {
        lines.push(`#### ${chapter.title}`);
        lines.push(
          `**Time**: ${formatTimestamp(chapter.startTime)} - ${formatTimestamp(chapter.endTime)}`,
        );
        if (chapter.summary) {
          lines.push(`**Summary**: ${chapter.summary}`);
        }
        lines.push("");
      }
    }

    // Transcript
    if (options.includeSegments !== false && segments.length > 0) {
      lines.push("### Transcript");
      lines.push("");

      // Group segments by chapter if available
      if (chapters.length > 0) {
        for (const chapter of chapters) {
          lines.push(`#### ${chapter.title}`);
          lines.push("");
          const chapterSegments = segments.filter(
            (s) => s.startTime >= chapter.startTime && s.endTime <= chapter.endTime,
          );
          for (const segment of chapterSegments) {
            lines.push(`**[${formatTimestamp(segment.startTime)}]** ${segment.text}`);
          }
          lines.push("");
        }
      } else {
        // No chapters, just list all segments
        for (const segment of segments) {
          lines.push(`**[${formatTimestamp(segment.startTime)}]** ${segment.text}`);
        }
        lines.push("");
      }
    }

    // Frames (key frames with OCR)
    if (options.includeFrames !== false && frames.length > 0) {
      lines.push("### Key Frames");
      lines.push("");
      for (const frame of frames.slice(0, 20)) {
        // Limit to 20 frames
        lines.push(`#### Frame at ${formatTimestamp(frame.timestamp)}`);
        if (frame.ocrText) {
          lines.push(`**OCR**: ${frame.ocrText}`);
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }

  const markdown = lines.join("\n");
  const blob = new Blob([markdown], { type: "text/markdown" });
  const filename = `yt-subtitle-export-${Date.now()}.md`;

  return {
    success: true,
    format: "md",
    size: blob.size,
    filename,
    data: blob,
  };
}

/**
 * Import data from file
 */
export async function importFromFile(db: VideoDatabase, file: File): Promise<ImportResult> {
  const errors: string[] = [];
  let jobsImported = 0;

  try {
    const content = await file.text();
    const data = JSON.parse(content);

    // Validate data structure
    if (!data.jobs && !Array.isArray(data)) {
      throw new Error("Invalid file format: missing jobs array");
    }

    const jobsData: JobExportData[] = data.jobs || data;

    for (const jobData of jobsData) {
      try {
        // Validate job data
        if (!jobData.job) {
          errors.push("Skipping invalid job: missing job data");
          continue;
        }

        // Import job data
        await db.transaction("rw", [db.jobs, db.segments, db.frames, db.chapters], async () => {
          // Generate new ID to avoid conflicts
          const newJobId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

          // Add job
          await db.jobs.add({
            ...jobData.job,
            id: newJobId,
          });

          // Add segments
          if (jobData.segments && jobData.segments.length > 0) {
            const segments = jobData.segments.map((s) => ({
              ...s,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
              jobId: newJobId,
            }));
            await db.segments.bulkAdd(segments);
          }

          // Add frames
          if (jobData.frames && jobData.frames.length > 0) {
            const frames = jobData.frames.map((f) => ({
              ...f,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
              jobId: newJobId,
            }));
            await db.frames.bulkAdd(frames);
          }

          // Add chapters
          if (jobData.chapters && jobData.chapters.length > 0) {
            const chapters = jobData.chapters.map((c) => ({
              ...c,
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
              jobId: newJobId,
            }));
            await db.chapters.bulkAdd(chapters);
          }

          jobsImported++;
        });
      } catch (error) {
        errors.push(`Failed to import job ${jobData.job?.fileName || "unknown"}: ${error}`);
      }
    }
  } catch (error) {
    return {
      success: false,
      jobsImported: 0,
      errors: [`Failed to parse file: ${error}`],
    };
  }

  return {
    success: errors.length === 0,
    jobsImported,
    errors,
  };
}

/**
 * Trigger download of exported data
 */
export function downloadExport(result: ExportResult): void {
  const url = URL.createObjectURL(result.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export job as subtitles (SRT format)
 */
export async function exportAsSRT(db: VideoDatabase, jobId: string): Promise<ExportResult> {
  const { job, segments } = await db.getJobData(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  const srtLines: string[] = [];

  segments.forEach((segment, index) => {
    srtLines.push(`${index + 1}`);
    srtLines.push(`${formatSRTTime(segment.startTime)} --> ${formatSRTTime(segment.endTime)}`);
    srtLines.push(segment.text);
    srtLines.push("");
  });

  const srtContent = srtLines.join("\n");
  const blob = new Blob([srtContent], { type: "text/plain" });
  const filename = `${job.fileName}.srt`;

  return {
    success: true,
    format: "json", // SRT is treated as text
    size: blob.size,
    filename,
    data: blob,
  };
}

/**
 * Export job as subtitles (VTT format)
 */
export async function exportAsVTT(db: VideoDatabase, jobId: string): Promise<ExportResult> {
  const { job, segments } = await db.getJobData(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  const vttLines: string[] = ["WEBVTT", ""];

  segments.forEach((segment) => {
    vttLines.push(`${formatVTTTime(segment.startTime)} --> ${formatVTTTime(segment.endTime)}`);
    vttLines.push(segment.text);
    vttLines.push("");
  });

  const vttContent = vttLines.join("\n");
  const blob = new Blob([vttContent], { type: "text/vtt" });
  const filename = `${job.fileName}.vtt`;

  return {
    success: true,
    format: "json", // VTT is treated as text
    size: blob.size,
    filename,
    data: blob,
  };
}

/**
 * Export job as plain text transcript
 */
export async function exportAsTranscript(db: VideoDatabase, jobId: string): Promise<ExportResult> {
  const { job, segments } = await db.getJobData(jobId);

  if (!job) {
    throw new Error("Job not found");
  }

  const lines: string[] = [
    `# Transcript for ${job.fileName}`,
    `# Duration: ${formatDuration(job.duration)}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
  ];

  segments.forEach((segment) => {
    lines.push(`[${formatTimestamp(segment.startTime)}] ${segment.text}`);
  });

  const content = lines.join("\n");
  const blob = new Blob([content], { type: "text/plain" });
  const filename = `${job.fileName}.txt`;

  return {
    success: true,
    format: "json", // Text is treated as text
    size: blob.size,
    filename,
    data: blob,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format duration as human-readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format timestamp as HH:MM:SS
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, size: number = 2) => n.toString().padStart(size, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * Format time for SRT subtitles
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, size: number = 2) => n.toString().padStart(size, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(ms, 3)}`;
}

/**
 * Format time for VTT subtitles
 */
function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, size: number = 2) => n.toString().padStart(size, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}.${pad(ms, 3)}`;
}

/**
 * Create a backup of the entire database
 */
export async function createBackup(db: VideoDatabase): Promise<Blob> {
  const data = await db.exportDatabase();
  const backupData = {
    version: "1.0.0",
    backupDate: new Date().toISOString(),
    database: data,
  };

  const jsonString = JSON.stringify(backupData);
  return new Blob([jsonString], { type: "application/json" });
}

/**
 * Restore database from backup
 */
export async function restoreBackup(db: VideoDatabase, file: File): Promise<ImportResult> {
  const content = await file.text();
  const backup = JSON.parse(content);

  if (!backup.database || !Array.isArray(backup.database)) {
    return {
      success: false,
      jobsImported: 0,
      errors: ["Invalid backup file format"],
    };
  }

  // Clear existing data
  await db.clearAll();

  // Import backup data
  const jobsImported = await db.importDatabase(backup.database);

  return {
    success: true,
    jobsImported,
    errors: [],
  };
}
