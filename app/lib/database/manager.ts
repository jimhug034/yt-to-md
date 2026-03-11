/**
 * 数据库模块
 *
 * 封装 Rust WASM RustSQLite3，提供类型安全的数据库操作接口
 * 使用 LocalStorage 进行持久化（可扩展到 IndexedDB）
 */

import { RustSQLite3, SQLiteHelper } from "../../../wasm/pkg";
import type { VideoJob, TranscriptSegment, KeyFrame, Chapter, JobStatus } from "../wasm";

// ============================================
// 类型定义
// ============================================

export type JobStatusType = "Pending" | "Processing" | "Completed" | "Failed";

export interface DbStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  total_segments: number;
  total_frames: number;
  total_chapters: number;
}

export interface JobInput {
  id?: string;
  source_url?: string;
  file_name: string;
  duration?: number;
  width?: number;
  height?: number;
  status?: JobStatusType;
  progress?: number;
}

export interface SegmentInput {
  id?: string;
  job_id: string;
  start_time: number;
  end_time: number;
  text: string;
  confidence?: number;
}

export interface ChapterInput {
  id?: string;
  job_id: string;
  title: string;
  start_time: number;
  end_time: number;
  summary?: string;
}

// ============================================
// 数据库管理器
// ============================================

class DatabaseManager {
  private db: RustSQLite3 | null = null;
  private isInitialized = false;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.db) {
      this.db = new RustSQLite3();
    }

    try {
      await this.db.init();
      this.isInitialized = true;
    } catch (error) {
      console.error("Database init failed:", error);
      throw error;
    }
  }

  /**
   * 确保数据库已初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
  }

  /**
   * 生成唯一 ID
   */
  generateId(): string {
    return crypto.randomUUID();
  }

  // ============================================
  // Job 操作
  // ============================================

  async createJob(input: JobInput): Promise<string> {
    this.ensureInitialized();

    const id = input.id || this.generateId();
    const now = Date.now() / 1000; // Unix timestamp in seconds

    this.db!.insert_job(
      id,
      input.source_url || null,
      input.file_name,
      input.duration || 0,
      input.width || 0,
      input.height || 0,
      input.status || "Pending",
      input.progress || 0,
    );

    return id;
  }

  async getJob(id: string): Promise<VideoJob | null> {
    this.ensureInitialized();

    try {
      const json = this.db!.get_job(id);
      return JSON.parse(json) as VideoJob;
    } catch (error) {
      console.error("Failed to get job:", error);
      return null;
    }
  }

  async getAllJobs(): Promise<VideoJob[]> {
    this.ensureInitialized();

    try {
      const json = this.db!.get_all_jobs();
      return JSON.parse(json) as VideoJob[];
    } catch (error) {
      console.error("Failed to get all jobs:", error);
      return [];
    }
  }

  async updateJobStatus(id: string, status: JobStatusType): Promise<void> {
    this.ensureInitialized();
    this.db!.update_job_status(id, status);
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    this.ensureInitialized();
    this.db!.update_job_progress(id, progress);
  }

  async deleteJob(id: string): Promise<void> {
    this.ensureInitialized();
    this.db!.delete_job(id);
  }

  // ============================================
  // Segment 操作
  // ============================================

  async createSegment(input: SegmentInput): Promise<string> {
    this.ensureInitialized();

    const id = input.id || this.generateId();

    this.db!.insert_segment(
      id,
      input.job_id,
      input.start_time,
      input.end_time,
      input.text,
      input.confidence || 1.0,
    );

    return id;
  }

  async createSegments(segments: SegmentInput[]): Promise<void> {
    this.ensureInitialized();

    for (const segment of segments) {
      await this.createSegment(segment);
    }
  }

  async getSegments(jobId: string): Promise<TranscriptSegment[]> {
    this.ensureInitialized();

    try {
      const json = this.db!.get_segments(jobId);
      return JSON.parse(json) as TranscriptSegment[];
    } catch (error) {
      console.error("Failed to get segments:", error);
      return [];
    }
  }

  // ============================================
  // Frame 操作
  // ============================================

  async createFrame(jobId: string, timestamp: number, imageData: Uint8Array): Promise<string> {
    this.ensureInitialized();

    const id = this.generateId();

    this.db!.insert_frame(id, jobId, timestamp, imageData);

    return id;
  }

  async getFrames(jobId: string): Promise<KeyFrame[]> {
    this.ensureInitialized();

    try {
      const json = this.db!.get_frames(jobId);
      return JSON.parse(json) as KeyFrame[];
    } catch (error) {
      console.error("Failed to get frames:", error);
      return [];
    }
  }

  async updateFrameOcr(frameId: string, ocrText: string): Promise<void> {
    this.ensureInitialized();
    this.db!.update_frame_ocr(frameId, ocrText);
  }

  // ============================================
  // Chapter 操作
  // ============================================

  async createChapter(input: ChapterInput): Promise<string> {
    this.ensureInitialized();

    const id = input.id || this.generateId();

    this.db!.insert_chapter(
      id,
      input.job_id,
      input.title,
      input.start_time,
      input.end_time,
      input.summary || "",
    );

    return id;
  }

  async createChapters(chapters: ChapterInput[]): Promise<void> {
    this.ensureInitialized();

    for (const chapter of chapters) {
      await this.createChapter(chapter);
    }
  }

  async getChapters(jobId: string): Promise<Chapter[]> {
    this.ensureInitialized();

    try {
      const json = this.db!.get_chapters(jobId);
      return JSON.parse(json) as Chapter[];
    } catch (error) {
      console.error("Failed to get chapters:", error);
      return [];
    }
  }

  // ============================================
  // 统计和清理
  // ============================================

  async getStats(): Promise<DbStats> {
    this.ensureInitialized();

    try {
      const json = this.db!.get_stats();
      return JSON.parse(json) as DbStats;
    } catch (error) {
      console.error("Failed to get stats:", error);
      return {
        total_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        pending_jobs: 0,
        total_segments: 0,
        total_frames: 0,
        total_chapters: 0,
      };
    }
  }

  async cleanupOldData(days: number = 30): Promise<number> {
    this.ensureInitialized();
    return this.db!.cleanup_old_data(days);
  }

  async clearDatabase(): Promise<void> {
    if (this.db) {
      await this.db.clear_database();
    }
  }

  // ============================================
  // 导出/导入
  // ============================================

  async exportJob(jobId: string): Promise<string | null> {
    this.ensureInitialized();

    try {
      return this.db!.export_job(jobId);
    } catch (error) {
      console.error("Failed to export job:", error);
      return null;
    }
  }

  /**
   * 生成创建表的 SQL
   */
  getCreateTablesSql(): string {
    return SQLiteHelper.get_create_tables_sql();
  }

  /**
   * 生成插入 job 的 SQL
   */
  generateInsertJobSql(input: JobInput & { id: string }): string {
    const now = Date.now() / 1000;
    return SQLiteHelper.insert_job_sql(
      input.id,
      input.source_url || null,
      input.file_name,
      input.duration || 0,
      input.width || 0,
      input.height || 0,
      now,
      input.status || "Pending",
      input.progress || 0,
    );
  }

  /**
   * 释放资源
   */
  destroy(): void {
    this.db = null;
    this.isInitialized = false;
  }
}

// ============================================
// 导出单例
// ============================================

export const dbManager = new DatabaseManager();
