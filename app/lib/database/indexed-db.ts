/**
 * IndexedDB 持久化存储
 *
 * 使用 IndexedDB 替代 LocalStorage，提供更大的存储容量
 * 用于存储大量帧数据
 */

const DB_NAME = 'yt_subtitle_db';
const DB_VERSION = 1;
const STORES = {
  jobs: 'jobs',
  segments: 'segments',
  frames: 'frames',
  chapters: 'chapters',
} as const;

// ============================================
// 类型定义
// ============================================

export interface DbFrame {
  id: string;
  job_id: string;
  timestamp: number;
  image_data: Uint8Array;
  ocr_text?: string;
  chapter_id?: string;
}

export interface DbSegment {
  id: string;
  job_id: string;
  start_time: number;
  end_time: number;
  text: string;
  confidence: number;
}

export interface DbChapter {
  id: string;
  job_id: string;
  title: string;
  start_time: number;
  end_time: number;
  summary: string;
}

export interface DbJob {
  id: string;
  source_url?: string;
  file_name: string;
  duration: number;
  width: number;
  height: number;
  created_at: number;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  progress: number;
  error_message?: string;
}

// ============================================
// IndexedDB 管理器
// ============================================

class IndexedDBManager {
  private db: IDBDatabase | null = null;

  /**
   * 打开数据库
   */
  async open(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建 object stores
        if (!db.objectStoreNames.contains(STORES.jobs)) {
          const jobStore = db.createObjectStore(STORES.jobs, { keyPath: 'id' });
          jobStore.createIndex('status', 'status', { unique: false });
          jobStore.createIndex('created_at', 'created_at', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.segments)) {
          const segmentStore = db.createObjectStore(STORES.segments, { keyPath: 'id' });
          segmentStore.createIndex('job_id', 'job_id', { unique: false });
          segmentStore.createIndex('start_time', 'start_time', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.frames)) {
          const frameStore = db.createObjectStore(STORES.frames, { keyPath: 'id' });
          frameStore.createIndex('job_id', 'job_id', { unique: false });
          frameStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.chapters)) {
          const chapterStore = db.createObjectStore(STORES.chapters, { keyPath: 'id' });
          chapterStore.createIndex('job_id', 'job_id', { unique: false });
          chapterStore.createIndex('start_time', 'start_time', { unique: false });
        }
      };
    });
  }

  /**
   * 确保数据库已打开
   */
  private ensureOpen(): void {
    if (!this.db) {
      throw new Error('Database not opened. Call open() first.');
    }
  }

  /**
   * 获取 object store
   */
  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    this.ensureOpen();

    const transaction = this.db!.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // ============================================
  // Job 操作
  // ============================================

  async putJob(job: DbJob): Promise<void> {
    const store = this.getStore(STORES.jobs, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(job);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getJob(id: string): Promise<DbJob | undefined> {
    const store = this.getStore(STORES.jobs);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllJobs(): Promise<DbJob[]> {
    const store = this.getStore(STORES.jobs);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteJob(id: string): Promise<void> {
    const store = this.getStore(STORES.jobs, 'readwrite');

    // 同时删除关联数据
    const transaction = this.db!.transaction([STORES.jobs, STORES.segments, STORES.frames, STORES.chapters], 'readwrite');

    return new Promise((resolve, reject) => {
      let completed = 0;
      const total = 4;

      const checkComplete = () => {
        completed++;
        if (completed === total) resolve();
      };

      // 删除 job
      const jobStore = transaction.objectStore(STORES.jobs);
      const jobRequest = jobStore.delete(id);
      jobRequest.onsuccess = checkComplete;
      jobRequest.onerror = () => reject(jobRequest.error);

      // 删除关联的 segments
      const segmentStore = transaction.objectStore(STORES.segments);
      const segmentIndex = segmentStore.index('job_id');
      const segmentRequest = segmentIndex.openCursor(IDBKeyRange.only(id));
      segmentRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      segmentRequest.onerror = () => reject(segmentRequest.error);

      // 删除关联的 frames
      const frameStore = transaction.objectStore(STORES.frames);
      const frameIndex = frameStore.index('job_id');
      const frameRequest = frameIndex.openCursor(IDBKeyRange.only(id));
      frameRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      frameRequest.onerror = () => reject(frameRequest.error);

      // 删除关联的 chapters
      const chapterStore = transaction.objectStore(STORES.chapters);
      const chapterIndex = chapterStore.index('job_id');
      const chapterRequest = chapterIndex.openCursor(IDBKeyRange.only(id));
      chapterRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          checkComplete();
        }
      };
      chapterRequest.onerror = () => reject(chapterRequest.error);
    });
  }

  // ============================================
  // Segment 操作
  // ============================================

  async putSegment(segment: DbSegment): Promise<void> {
    const store = this.getStore(STORES.segments, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(segment);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async putSegments(segments: DbSegment[]): Promise<void> {
    const store = this.getStore(STORES.segments, 'readwrite');

    for (const segment of segments) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(segment);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getSegments(jobId: string): Promise<DbSegment[]> {
    const store = this.getStore(STORES.segments);
    const index = store.index('job_id');

    return new Promise((resolve, reject) => {
      const request = index.getAll(jobId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Frame 操作
  // ============================================

  async putFrame(frame: DbFrame): Promise<void> {
    const store = this.getStore(STORES.frames, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(frame);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async putFrames(frames: DbFrame[]): Promise<void> {
    const store = this.getStore(STORES.frames, 'readwrite');

    for (const frame of frames) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(frame);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getFrames(jobId: string): Promise<DbFrame[]> {
    const store = this.getStore(STORES.frames);
    const index = store.index('job_id');

    return new Promise((resolve, reject) => {
      const request = index.getAll(jobId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async updateFrameOcr(frameId: string, ocrText: string): Promise<void> {
    const store = this.getStore(STORES.frames, 'readwrite');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(frameId);
      getRequest.onsuccess = () => {
        const frame = getRequest.result;
        if (frame) {
          frame.ocr_text = ocrText;
          const putRequest = store.put(frame);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ============================================
  // Chapter 操作
  // ============================================

  async putChapter(chapter: DbChapter): Promise<void> {
    const store = this.getStore(STORES.chapters, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(chapter);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async putChapters(chapters: DbChapter[]): Promise<void> {
    const store = this.getStore(STORES.chapters, 'readwrite');

    for (const chapter of chapters) {
      await new Promise<void>((resolve, reject) => {
        const request = store.put(chapter);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getChapters(jobId: string): Promise<DbChapter[]> {
    const store = this.getStore(STORES.chapters);
    const index = store.index('job_id');

    return new Promise((resolve, reject) => {
      const request = index.getAll(jobId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // 统计操作
  // ============================================

  async getStats(): Promise<{
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    pending_jobs: number;
  }> {
    const jobs = await this.getAllJobs();

    return {
      total_jobs: jobs.length,
      completed_jobs: jobs.filter(j => j.status === 'Completed').length,
      failed_jobs: jobs.filter(j => j.status === 'Failed').length,
      pending_jobs: jobs.filter(j => j.status === 'Pending').length,
    };
  }

  /**
   * 清理旧数据
   */
  async cleanupOldData(days: number = 30): Promise<number> {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const jobs = await this.getAllJobs();

    const toDelete = jobs.filter(
      job => job.created_at < cutoffTime &&
              (job.status === 'Completed' || job.status === 'Failed')
    );

    for (const job of toDelete) {
      await this.deleteJob(job.id);
    }

    return toDelete.length;
  }

  /**
   * 清空数据库
   */
  async clear(): Promise<void> {
    if (!this.db) return;

    const stores = Object.values(STORES);
    const transaction = this.db.transaction(stores, 'readwrite');

    for (const storeName of stores) {
      const store = transaction.objectStore(storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ============================================
// 导出单例
// ============================================

export const indexedDb = new IndexedDBManager();
