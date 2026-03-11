/**
 * React Hooks for Database Operations
 * Provides convenient hooks for using the IndexedDB database in React components
 */

import { useState, useEffect, useCallback } from "react";
import { getDatabase } from "./indexeddb";
import {
  JobStatus,
  type VideoJob,
  type TranscriptSegment,
  type KeyFrame,
  type Chapter,
} from "../models/types";

/**
 * Hook for managing jobs
 */
export function useJobs() {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const db = getDatabase();

  const refreshJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await db.getJobs();
      setJobs(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  const createJob = useCallback(
    async (fileName: string, sourceUrl?: string) => {
      try {
        const job = await db.createJob({
          sourceUrl,
          fileName,
          duration: 0,
          width: 0,
          height: 0,
          status: JobStatus.Pending,
          progress: 0,
        });
        await refreshJobs();
        return job;
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [db, refreshJobs],
  );

  const deleteJob = useCallback(
    async (jobId: string) => {
      try {
        await db.deleteJob(jobId);
        await refreshJobs();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [db, refreshJobs],
  );

  const updateJobProgress = useCallback(
    async (jobId: string, progress: number) => {
      try {
        await db.updateJobProgress(jobId, progress);
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, progress } : j)));
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [db],
  );

  const updateJobStatus = useCallback(
    async (jobId: string, status: VideoJob["status"]) => {
      try {
        await db.updateJobStatus(jobId, status);
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status } : j)));
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [db],
  );

  return {
    jobs,
    loading,
    error,
    refreshJobs,
    createJob,
    deleteJob,
    updateJobProgress,
    updateJobStatus,
  };
}

/**
 * Hook for managing a single job
 */
export function useJob(jobId: string) {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [frames, setFrames] = useState<KeyFrame[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const db = getDatabase();

  const refreshJob = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await db.getJobData(jobId);
      setJob(data.job || null);
      setSegments(data.segments);
      setFrames(data.frames);
      setChapters(data.chapters);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [db, jobId]);

  useEffect(() => {
    refreshJob();
  }, [refreshJob]);

  const addSegments = useCallback(
    async (newSegments: Omit<TranscriptSegment, "id" | "createdAt" | "jobId">[]) => {
      try {
        await db.addSegments(jobId, newSegments);
        await refreshJob();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [db, jobId, refreshJob],
  );

  const addFrames = useCallback(
    async (newFrames: Omit<KeyFrame, "id" | "createdAt" | "jobId">[]) => {
      try {
        await db.addFrames(jobId, newFrames);
        await refreshJob();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [db, jobId, refreshJob],
  );

  const addChapters = useCallback(
    async (newChapters: Omit<Chapter, "id" | "createdAt" | "jobId">[]) => {
      try {
        await db.addChapters(jobId, newChapters);
        await refreshJob();
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [db, jobId, refreshJob],
  );

  return {
    job,
    segments,
    frames,
    chapters,
    loading,
    error,
    refreshJob,
    addSegments,
    addFrames,
    addChapters,
  };
}

/**
 * Hook for database statistics
 */
export function useDatabaseStats() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    pendingJobs: 0,
    totalSegments: 0,
    totalFrames: 0,
    totalChapters: 0,
    storageUsed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const db = getDatabase();

  const refreshStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await db.getStats();
      setStats(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return { stats, loading, error, refreshStats };
}

/**
 * Hook for database operations
 */
export function useDatabase() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const db = getDatabase();

  const clearAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await db.clearAll();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [db]);

  const clearOldJobs = useCallback(
    async (daysOld: number = 30) => {
      try {
        setLoading(true);
        setError(null);
        const count = await db.clearOldJobs(daysOld);
        return count;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [db],
  );

  const exportDatabase = useCallback(
    async (jobIds?: string[]) => {
      try {
        setLoading(true);
        setError(null);
        return await db.exportDatabase(jobIds);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [db],
  );

  const importDatabase = useCallback(
    async (data: any) => {
      try {
        setLoading(true);
        setError(null);
        return await db.importDatabase(data);
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [db],
  );

  return {
    loading,
    error,
    clearAll,
    clearOldJobs,
    exportDatabase,
    importDatabase,
  };
}
