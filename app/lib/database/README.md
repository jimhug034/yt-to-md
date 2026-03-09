/**
 * Database Usage Examples
 * This file demonstrates how to use the IndexedDB database
 */

import {
  getDatabase,
  exportToFile,
  importFromFile,
  downloadExport,
  exportAsSRT,
  exportAsVTT,
  exportAsTranscript,
  type VideoJob,
  type TranscriptSegment,
} from './index';

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize database and create a new job
 */
async function createNewJob(fileName: string, sourceUrl?: string) {
  const db = getDatabase();

  const job = await db.createJob({
    sourceUrl,
    fileName,
    duration: 0,
    width: 0,
    height: 0,
    status: 'pending',
    progress: 0,
  });

  console.log('Created job:', job.id);
  return job;
}

// ============================================
// JOB OPERATIONS
// ============================================

/**
 * Get a job by ID
 */
async function getJob(jobId: string) {
  const db = getDatabase();
  const job = await db.getJob(jobId);
  return job;
}

/**
 * List all jobs with filtering
 */
async function listJobs() {
  const db = getDatabase();

  // Get all jobs
  const allJobs = await db.getJobs();

  // Get only completed jobs
  const completedJobs = await db.getJobs({ status: 'completed' });

  // Get jobs with pagination
  const paginatedJobs = await db.getJobs({
    limit: 10,
    offset: 0,
  });

  return { allJobs, completedJobs, paginatedJobs };
}

/**
 * Update job progress
 */
async function updateProgress(jobId: string, progress: number) {
  const db = getDatabase();
  await db.updateJobProgress(jobId, progress);
}

/**
 * Update job status
 */
async function updateStatus(jobId: string, status: VideoJob['status']) {
  const db = getDatabase();
  await db.updateJobStatus(jobId, status);
}

/**
 * Handle job error
 */
async function handleJobError(jobId: string, errorMessage: string) {
  const db = getDatabase();
  await db.setJobError(jobId, errorMessage);
}

/**
 * Delete a job and all related data
 */
async function deleteJob(jobId: string) {
  const db = getDatabase();
  await db.deleteJob(jobId);
}

// ============================================
// SEGMENT OPERATIONS
// ============================================

/**
 * Add transcript segments to a job
 */
async function addTranscriptSegments(
  jobId: string,
  segments: Array<{ startTime: number; endTime: number; text: string }>
) {
  const db = getDatabase();

  // Bulk add segments for better performance
  await db.addSegments(
    jobId,
    segments.map((s) => ({
      ...s,
      confidence: 1.0,
    }))
  );
}

/**
 * Get all segments for a job
 */
async function getTranscript(jobId: string) {
  const db = getDatabase();
  const segments = await db.getSegments(jobId);
  return segments;
}

/**
 * Get segments in a time range
 */
async function getSegmentsInRange(jobId: string, startTime: number, endTime: number) {
  const db = getDatabase();
  const segments = await db.getSegmentsInRange(jobId, startTime, endTime);
  return segments;
}

// ============================================
// FRAME OPERATIONS
// ============================================

/**
 * Add key frames to a job
 */
async function addKeyFrames(
  jobId: string,
  frames: Array<{ timestamp: number; imageData: string; frameNumber?: number }>
) {
  const db = getDatabase();
  await db.addFrames(jobId, frames);
}

/**
 * Get all frames for a job
 */
async function getKeyFrames(jobId: string) {
  const db = getDatabase();
  const frames = await db.getFrames(jobId);
  return frames;
}

/**
 * Update OCR text for a frame
 */
async function updateFrameOCR(frameId: string, ocrText: string) {
  const db = getDatabase();
  await db.updateFrameOcr(frameId, ocrText);
}

// ============================================
// CHAPTER OPERATIONS
// ============================================

/**
 * Add chapters to a job
 */
async function addChapters(
  jobId: string,
  chapters: Array<{ title: string; startTime: number; endTime: number }>
) {
  const db = getDatabase();
  await db.addChapters(
    jobId,
    chapters.map((c) => ({
      ...c,
      summary: '',
    }))
  );
}

/**
 * Get all chapters for a job
 */
async function getChapters(jobId: string) {
  const db = getDatabase();
  const chapters = await db.getChapters(jobId);
  return chapters;
}

/**
 * Update chapter summary
 */
async function updateChapterSummary(chapterId: string, summary: string) {
  const db = getDatabase();
  await db.updateChapterSummary(chapterId, summary);
}

// ============================================
// COMPOSITE OPERATIONS
// ============================================

/**
 * Get complete job data (job + segments + frames + chapters)
 */
async function getCompleteJobData(jobId: string) {
  const db = getDatabase();
  const data = await db.getJobData(jobId);
  return data;
}

/**
 * Clone a job (creates a copy)
 */
async function cloneJob(jobId: string, newFileName?: string) {
  const db = getDatabase();
  const newJobId = await db.cloneJob(jobId, newFileName);
  return newJobId;
}

// ============================================
// EXPORT/IMPORT
// ============================================

/**
 * Export job as JSON
 */
async function exportJobAsJSON(jobId: string) {
  const db = getDatabase();
  const result = await exportToFile(db, [jobId], { format: 'json' });
  downloadExport(result);
}

/**
 * Export job as Markdown
 */
async function exportJobAsMarkdown(jobId: string) {
  const db = getDatabase();
  const result = await exportToFile(db, [jobId], { format: 'md' });
  downloadExport(result);
}

/**
 * Export job as SRT subtitles
 */
async function exportJobAsSRT(jobId: string) {
  const db = getDatabase();
  const result = await exportAsSRT(db, jobId);
  downloadExport(result);
}

/**
 * Export job as VTT subtitles
 */
async function exportJobAsVTT(jobId: string) {
  const db = getDatabase();
  const result = await exportAsVTT(db, jobId);
  downloadExport(result);
}

/**
 * Export job as plain text transcript
 */
async function exportJobAsTranscript(jobId: string) {
  const db = getDatabase();
  const result = await exportAsTranscript(db, jobId);
  downloadExport(result);
}

/**
 * Import jobs from a file
 */
async function importJobsFromFile(file: File) {
  const db = getDatabase();
  const result = await importFromFile(db, file);

  if (result.success) {
    console.log(`Successfully imported ${result.jobsImported} jobs`);
  } else {
    console.error('Import failed:', result.errors);
  }

  return result;
}

// ============================================
// DATABASE MAINTENANCE
// ============================================

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  const db = getDatabase();
  const stats = await db.getStats();
  return stats;
}

/**
 * Clear old jobs (older than specified days)
 */
async function cleanupOldJobs(daysOld: number = 30) {
  const db = getDatabase();
  const deletedCount = await db.clearOldJobs(daysOld);
  console.log(`Deleted ${deletedCount} old jobs`);
}

/**
 * Clear all database data
 */
async function clearAllData() {
  const db = getDatabase();
  await db.clearAll();
  console.log('All data cleared');
}

// ============================================
// REACT HOOK EXAMPLE
// ============================================

/**
 * Example React hook for using the database
 * This would typically be in a separate hooks file
 */
/*
import { useState, useEffect } from 'react';
import { getDatabase, type VideoJob } from './database';

export function useJobs() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDatabase();
    db.getJobs().then((data) => {
      setJobs(data);
      setLoading(false);
    });
  }, []);

  const createJob = async (fileName: string, sourceUrl?: string) => {
    const db = getDatabase();
    const job = await db.createJob({
      sourceUrl,
      fileName,
      duration: 0,
      width: 0,
      height: 0,
      status: 'pending',
      progress: 0,
    });
    setJobs((prev) => [job, ...prev]);
    return job;
  };

  const deleteJob = async (jobId: string) => {
    const db = getDatabase();
    await db.deleteJob(jobId);
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  return { jobs, loading, createJob, deleteJob };
}
*/
