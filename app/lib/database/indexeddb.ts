/**
 * IndexedDB Wrapper using Dexie.js
 * Provides persistent storage for video processing jobs and results
 */

import Dexie, { Table, Transaction } from 'dexie';
import {
  JobStatus,
  type VideoJob,
  type TranscriptSegment,
  type KeyFrame,
  type Chapter,
  type JobQueryFilters,
  type DatabaseStats,
  type JobExportData,
  type ExportOptions,
} from '../models/types';

/**
 * Database schema version
 */
const DB_VERSION = 1;

/**
 * Database name
 */
const DB_NAME = 'yt-subtitle-md-db';

/**
 * IndexedDB Database Class
 */
export class VideoDatabase extends Dexie {
  // Tables
  jobs!: Table<VideoJob, string>;
  segments!: Table<TranscriptSegment, string>;
  frames!: Table<KeyFrame, string>;
  chapters!: Table<Chapter, string>;

  constructor() {
    super(DB_NAME);

    // Define database schema
    this.version(DB_VERSION).stores({
      jobs: 'id, status, createdAt, fileName, sourceUrl',
      segments: 'id, jobId, startTime, endTime, createdAt',
      frames: 'id, jobId, timestamp, createdAt, chapterId',
      chapters: 'id, jobId, startTime, endTime, createdAt',
    });
  }

  // ============================================
  // JOB OPERATIONS
  // ============================================

  /**
   * Create a new job
   */
  async createJob(job: Omit<VideoJob, 'id' | 'createdAt'>): Promise<VideoJob> {
    const id = this.generateId();
    const newJob: VideoJob = {
      ...job,
      id,
      createdAt: Date.now(),
    };
    await this.jobs.add(newJob);
    return newJob;
  }

  /**
   * Get a job by ID
   */
  async getJob(id: string): Promise<VideoJob | undefined> {
    return await this.jobs.get(id);
  }

  /**
   * Get all jobs with optional filtering
   */
  async getJobs(filters?: JobQueryFilters): Promise<VideoJob[]> {
    let query = this.jobs.orderBy('createdAt').reverse();

    if (filters?.status) {
      query = this.jobs.where('status').equals(filters.status);
    }

    if (filters?.fileName) {
      query = this.jobs.filter((job) =>
        job.fileName.toLowerCase().includes(filters.fileName!.toLowerCase())
      );
    }

    let results = await query.toArray();

    // Date range filtering
    if (filters?.startDate) {
      results = results.filter((job) => job.createdAt >= filters.startDate!);
    }
    if (filters?.endDate) {
      results = results.filter((job) => job.createdAt <= filters.endDate!);
    }

    // Pagination
    if (filters?.offset || filters?.limit) {
      const offset = filters.offset || 0;
      const limit = filters.limit || results.length;
      results = results.slice(offset, offset + limit);
    }

    return results;
  }

  /**
   * Update a job
   */
  async updateJob(id: string, updates: Partial<VideoJob>): Promise<number> {
    return await this.jobs.update(id, updates);
  }

  /**
   * Update job status
   */
  async updateJobStatus(id: string, status: VideoJob['status']): Promise<number> {
    return await this.jobs.update(id, { status });
  }

  /**
   * Update job progress
   */
  async updateJobProgress(id: string, progress: number): Promise<number> {
    return await this.jobs.update(id, { progress });
  }

  /**
   * Set job error
   */
  async setJobError(id: string, errorMessage: string): Promise<number> {
    return await this.jobs.update(id, {
      status: JobStatus.Failed,
      errorMessage,
    });
  }

  /**
   * Delete a job and all related data
   */
  async deleteJob(id: string): Promise<void> {
    await this.transaction('rw', [this.jobs, this.segments, this.frames, this.chapters], async () => {
      await this.segments.where('jobId').equals(id).delete();
      await this.frames.where('jobId').equals(id).delete();
      await this.chapters.where('jobId').equals(id).delete();
      await this.jobs.delete(id);
    });
  }

  /**
   * Bulk delete jobs
   */
  async deleteJobs(ids: string[]): Promise<void> {
    await this.transaction('rw', [this.jobs, this.segments, this.frames, this.chapters], async () => {
      for (const id of ids) {
        await this.segments.where('jobId').equals(id).delete();
        await this.frames.where('jobId').equals(id).delete();
        await this.chapters.where('jobId').equals(id).delete();
        await this.jobs.delete(id);
      }
    });
  }

  // ============================================
  // SEGMENT OPERATIONS
  // ============================================

  /**
   * Add a single segment
   */
  async addSegment(segment: Omit<TranscriptSegment, 'id' | 'createdAt'>): Promise<TranscriptSegment> {
    const id = this.generateId();
    const newSegment: TranscriptSegment = {
      ...segment,
      id,
      createdAt: Date.now(),
    };
    await this.segments.add(newSegment);
    return newSegment;
  }

  /**
   * Bulk add segments for a job
   */
  async addSegments(jobId: string, segments: Omit<TranscriptSegment, 'id' | 'createdAt' | 'jobId'>[]): Promise<void> {
    const newSegments: TranscriptSegment[] = segments.map((segment) => ({
      ...segment,
      id: this.generateId(),
      jobId,
      createdAt: Date.now(),
    }));
    await this.segments.bulkAdd(newSegments);
  }

  /**
   * Get all segments for a job
   */
  async getSegments(jobId: string): Promise<TranscriptSegment[]> {
    return await this.segments.where('jobId').equals(jobId).sortBy('startTime');
  }

  /**
   * Get segments in a time range
   */
  async getSegmentsInRange(jobId: string, startTime: number, endTime: number): Promise<TranscriptSegment[]> {
    return await this.segments
      .where('jobId')
      .equals(jobId)
      .filter((segment) => segment.startTime >= startTime && segment.endTime <= endTime)
      .sortBy('startTime');
  }

  /**
   * Update a segment
   */
  async updateSegment(id: string, updates: Partial<TranscriptSegment>): Promise<number> {
    return await this.segments.update(id, updates);
  }

  /**
   * Delete all segments for a job
   */
  async deleteSegments(jobId: string): Promise<number> {
    return await this.segments.where('jobId').equals(jobId).delete();
  }

  /**
   * Get segment count for a job
   */
  async getSegmentCount(jobId: string): Promise<number> {
    return await this.segments.where('jobId').equals(jobId).count();
  }

  // ============================================
  // FRAME OPERATIONS
  // ============================================

  /**
   * Add a single frame
   */
  async addFrame(frame: Omit<KeyFrame, 'id' | 'createdAt'>): Promise<KeyFrame> {
    const id = this.generateId();
    const newFrame: KeyFrame = {
      ...frame,
      id,
      createdAt: Date.now(),
    };
    await this.frames.add(newFrame);
    return newFrame;
  }

  /**
   * Bulk add frames for a job
   */
  async addFrames(jobId: string, frames: Omit<KeyFrame, 'id' | 'createdAt' | 'jobId'>[]): Promise<void> {
    const newFrames: KeyFrame[] = frames.map((frame) => ({
      ...frame,
      id: this.generateId(),
      jobId,
      createdAt: Date.now(),
    }));
    // Use bulkAdd with allowOption for better performance with large datasets
    await this.frames.bulkAdd(newFrames, { allKeys: false });
  }

  /**
   * Get all frames for a job
   */
  async getFrames(jobId: string): Promise<KeyFrame[]> {
    return await this.frames.where('jobId').equals(jobId).sortBy('timestamp');
  }

  /**
   * Get frame by ID
   */
  async getFrame(id: string): Promise<KeyFrame | undefined> {
    return await this.frames.get(id);
  }

  /**
   * Get frames in a time range
   */
  async getFramesInRange(jobId: string, startTime: number, endTime: number): Promise<KeyFrame[]> {
    return await this.frames
      .where('jobId')
      .equals(jobId)
      .filter((frame) => frame.timestamp >= startTime && frame.timestamp <= endTime)
      .sortBy('timestamp');
  }

  /**
   * Get frames by chapter
   */
  async getFramesByChapter(chapterId: string): Promise<KeyFrame[]> {
    return await this.frames.where('chapterId').equals(chapterId).sortBy('timestamp');
  }

  /**
   * Update frame OCR text
   */
  async updateFrameOcr(id: string, ocrText: string): Promise<number> {
    return await this.frames.update(id, { ocrText });
  }

  /**
   * Link frame to chapter
   */
  async linkFrameToChapter(frameId: string, chapterId: string): Promise<number> {
    return await this.frames.update(frameId, { chapterId });
  }

  /**
   * Delete all frames for a job
   */
  async deleteFrames(jobId: string): Promise<number> {
    return await this.frames.where('jobId').equals(jobId).delete();
  }

  /**
   * Get frame count for a job
   */
  async getFrameCount(jobId: string): Promise<number> {
    return await this.frames.where('jobId').equals(jobId).count();
  }

  // ============================================
  // CHAPTER OPERATIONS
  // ============================================

  /**
   * Add a single chapter
   */
  async addChapter(chapter: Omit<Chapter, 'id' | 'createdAt'>): Promise<Chapter> {
    const id = this.generateId();
    const newChapter: Chapter = {
      ...chapter,
      id,
      createdAt: Date.now(),
    };
    await this.chapters.add(newChapter);
    return newChapter;
  }

  /**
   * Bulk add chapters for a job
   */
  async addChapters(jobId: string, chapters: Omit<Chapter, 'id' | 'createdAt' | 'jobId'>[]): Promise<void> {
    const newChapters: Chapter[] = chapters.map((chapter) => ({
      ...chapter,
      id: this.generateId(),
      jobId,
      createdAt: Date.now(),
    }));
    await this.chapters.bulkAdd(newChapters);
  }

  /**
   * Get all chapters for a job
   */
  async getChapters(jobId: string): Promise<Chapter[]> {
    return await this.chapters.where('jobId').equals(jobId).sortBy('startTime');
  }

  /**
   * Get chapter by ID
   */
  async getChapter(id: string): Promise<Chapter | undefined> {
    return await this.chapters.get(id);
  }

  /**
   * Update chapter
   */
  async updateChapter(id: string, updates: Partial<Chapter>): Promise<number> {
    return await this.chapters.update(id, updates);
  }

  /**
   * Update chapter summary
   */
  async updateChapterSummary(id: string, summary: string): Promise<number> {
    return await this.chapters.update(id, { summary });
  }

  /**
   * Delete all chapters for a job
   */
  async deleteChapters(jobId: string): Promise<number> {
    return await this.chapters.where('jobId').equals(jobId).delete();
  }

  /**
   * Get chapter count for a job
   */
  async getChapterCount(jobId: string): Promise<number> {
    return await this.chapters.where('jobId').equals(jobId).count();
  }

  // ============================================
  // COMPOSITE OPERATIONS
  // ============================================

  /**
   * Get complete job data including all related records
   */
  async getJobData(jobId: string): Promise<{
    job: VideoJob | undefined;
    segments: TranscriptSegment[];
    frames: KeyFrame[];
    chapters: Chapter[];
  }> {
    const [job, segments, frames, chapters] = await Promise.all([
      this.getJob(jobId),
      this.getSegments(jobId),
      this.getFrames(jobId),
      this.getChapters(jobId),
    ]);

    return { job, segments, frames, chapters };
  }

  /**
   * Clone a job (creates a new job with copied data)
   */
  async cloneJob(jobId: string, newFileName?: string): Promise<string | undefined> {
    const data = await this.getJobData(jobId);
    if (!data.job) return undefined;

    const newJobId = this.generateId();
    const clonedJob: VideoJob = {
      ...data.job,
      id: newJobId,
      fileName: newFileName || `Copy of ${data.job.fileName}`,
      createdAt: Date.now(),
      status: JobStatus.Pending,
    };

    await this.transaction('rw', [this.jobs, this.segments, this.frames, this.chapters], async () => {
      await this.jobs.add(clonedJob);

      const segmentsToClone = data.segments.map((s) => ({
        ...s,
        id: this.generateId(),
        jobId: newJobId,
        createdAt: Date.now(),
      }));
      if (segmentsToClone.length > 0) {
        await this.segments.bulkAdd(segmentsToClone);
      }

      const framesToClone = data.frames.map((f) => ({
        ...f,
        id: this.generateId(),
        jobId: newJobId,
        createdAt: Date.now(),
      }));
      if (framesToClone.length > 0) {
        await this.frames.bulkAdd(framesToClone);
      }

      const chaptersToClone = data.chapters.map((c) => ({
        ...c,
        id: this.generateId(),
        jobId: newJobId,
        createdAt: Date.now(),
      }));
      if (chaptersToClone.length > 0) {
        await this.chapters.bulkAdd(chaptersToClone);
      }
    });

    return newJobId;
  }

  // ============================================
  // DATABASE STATISTICS
  // ============================================

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    const [jobs, completedJobs, failedJobs, pendingJobs] = await Promise.all([
      this.jobs.count(),
      this.jobs.where('status').equals('completed').count(),
      this.jobs.where('status').equals('failed').count(),
      this.jobs.where('status').equals('pending').count(),
    ]);

    const segments = await this.segments.count();
    const frames = await this.frames.count();
    const chapters = await this.chapters.count();

    // Estimate storage size
    const storageUsed = await this.estimateStorageSize();

    return {
      totalJobs: jobs,
      completedJobs,
      failedJobs,
      pendingJobs,
      totalSegments: segments,
      totalFrames: frames,
      totalChapters: chapters,
      storageUsed,
    };
  }

  /**
   * Estimate storage size (in bytes)
   */
  private async estimateStorageSize(): Promise<number> {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      } catch {
        // Fall through to manual calculation
      }
    }

    // Manual calculation - estimate based on string lengths
    const [jobs, segments, frames, chapters] = await Promise.all([
      this.jobs.toArray(),
      this.segments.toArray(),
      this.frames.toArray(),
      this.chapters.toArray(),
    ]);

    const getSize = (obj: any) => JSON.stringify(obj).length * 2; // UTF-16

    let total = 0;
    jobs.forEach((j) => (total += getSize(j)));
    segments.forEach((s) => (total += getSize(s)));
    frames.forEach((f) => (total += getSize(f)));
    chapters.forEach((c) => (total += getSize(c)));

    return total;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Clear all data from database
   */
  async clearAll(): Promise<void> {
    await this.transaction('rw', [this.jobs, this.segments, this.frames, this.chapters], async () => {
      await this.jobs.clear();
      await this.segments.clear();
      await this.frames.clear();
      await this.chapters.clear();
    });
  }

  /**
   * Clear old jobs (older than specified days)
   */
  async clearOldJobs(daysOld: number = 30): Promise<number> {
    const cutoffDate = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const oldJobs = await this.jobs.where('createdAt').below(cutoffDate).toArray();
    const jobIds = oldJobs.map(job => job.id);
    await this.deleteJobs(jobIds);
    return jobIds.length;
  }

  /**
   * Export database to JSON
   */
  async exportDatabase(jobIds?: string[]): Promise<JobExportData[]> {
    const jobs = jobIds || (await this.jobs.toArray()).map(job => job.id);
    const exports: JobExportData[] = [];

    for (const jobId of jobs) {
      const data = await this.getJobData(jobId);
      if (data.job) {
        exports.push({
          job: data.job,
          segments: data.segments,
          frames: data.frames,
          chapters: data.chapters,
          exportedAt: Date.now(),
          version: '1.0.0',
        });
      }
    }

    return exports;
  }

  /**
   * Import database from JSON
   */
  async importDatabase(data: JobExportData[]): Promise<number> {
    let importedCount = 0;

    await this.transaction('rw', [this.jobs, this.segments, this.frames, this.chapters], async () => {
      for (const item of data) {
        // Generate new IDs to avoid conflicts
        const newJobId = this.generateId();
        const job: VideoJob = {
          ...item.job,
          id: newJobId,
          createdAt: Date.now(),
        };

        await this.jobs.add(job);

        const segments = item.segments.map((s) => ({
          ...s,
          id: this.generateId(),
          jobId: newJobId,
          createdAt: Date.now(),
        }));
        if (segments.length > 0) {
          await this.segments.bulkAdd(segments);
        }

        const frames = item.frames.map((f) => ({
          ...f,
          id: this.generateId(),
          jobId: newJobId,
          createdAt: Date.now(),
        }));
        if (frames.length > 0) {
          await this.frames.bulkAdd(frames);
        }

        const chapters = item.chapters.map((c) => ({
          ...c,
          id: this.generateId(),
          jobId: newJobId,
          createdAt: Date.now(),
        }));
        if (chapters.length > 0) {
          await this.chapters.bulkAdd(chapters);
        }

        importedCount++;
      }
    });

    return importedCount;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let dbInstance: VideoDatabase | null = null;

/**
 * Get the singleton database instance
 */
export function getDatabase(): VideoDatabase {
  if (!dbInstance) {
    dbInstance = new VideoDatabase();
  }
  return dbInstance;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Reset database (delete and recreate)
 */
export async function resetDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    await dbInstance.delete();
    dbInstance = null;
  }
  getDatabase();
}
