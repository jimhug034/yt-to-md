/**
 * Rust SQLite3 包装器
 * 纯 Rust WASM 实现的数据持久化，基于 web-sys LocalStorage API
 */

import initWasm, { RustSQLite3 } from '@/app/lib/pkg';

let dbInstance: RustSQLite3 | null = null;
let isInitialized = false;

/**
 * 初始化 Rust SQLite3 数据库
 */
export async function initRustSQLite3(): Promise<void> {
  if (isInitialized) {
    return;
  }

  // 初始化 WASM 模块
  await initWasm();

  // 创建数据库实例
  dbInstance = new RustSQLite3();

  // 初始化数据库（从 LocalStorage 加载）
  dbInstance.init();

  isInitialized = true;
  console.log('Rust SQLite3 database initialized');
}

/**
 * 确保数据库已初始化
 */
function ensureInitialized(): RustSQLite3 {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initRustSQLite3() first.');
  }
  return dbInstance;
}

// ============================================
// 类型定义
// ============================================

export interface JobRow {
  id: string;
  source_url: string | null;
  file_name: string;
  duration: number;
  width: number;
  height: number;
  created_at: number;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  progress: number;
  error_message: string | null;
}

export interface SegmentRow {
  id: string;
  job_id: string;
  start_time: number;
  end_time: number;
  text: string;
  confidence: number;
}

export interface FrameRow {
  id: string;
  job_id: string;
  timestamp: number;
  image_data: number[];
  ocr_text: string | null;
  chapter_id: string | null;
}

export interface ChapterRow {
  id: string;
  job_id: string;
  title: string;
  start_time: number;
  end_time: number;
  summary: string;
}

export interface DatabaseStats {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  total_segments: number;
  total_frames: number;
  total_chapters: number;
}

// ============================================
// Job 操作
// ============================================

export function createJob(job: {
  id?: string;
  source_url?: string | null;
  file_name: string;
  duration?: number;
  width?: number;
  height?: number;
  status?: string;
  progress?: number;
}): string {
  const db = ensureInitialized();
  const id = job.id || generateUUID();

  db.insert_job(
    id,
    job.source_url ?? null,
    job.file_name,
    job.duration ?? 0,
    job.width ?? 0,
    job.height ?? 0,
    job.status ?? 'Pending',
    job.progress ?? 0
  );

  return id;
}

export function getJob(id: string): JobRow | null {
  const db = ensureInitialized();
  try {
    const result = db.get_job(id);
    return JSON.parse(result);
  } catch {
    return null;
  }
}

export function getAllJobs(): JobRow[] {
  const db = ensureInitialized();
  try {
    const result = db.get_all_jobs();
    return JSON.parse(result);
  } catch {
    return [];
  }
}

export function updateJobStatus(id: string, status: string): void {
  const db = ensureInitialized();
  db.update_job_status(id, status);
}

export function updateJobProgress(id: string, progress: number): void {
  const db = ensureInitialized();
  db.update_job_progress(id, progress);
}

export function deleteJob(id: string): void {
  const db = ensureInitialized();
  db.delete_job(id);
}

// ============================================
// Segment 操作
// ============================================

export function createSegment(segment: {
  id?: string;
  job_id: string;
  start_time: number;
  end_time: number;
  text: string;
  confidence?: number;
}): string {
  const db = ensureInitialized();
  const id = segment.id || generateUUID();

  db.insert_segment(
    id,
    segment.job_id,
    segment.start_time,
    segment.end_time,
    segment.text,
    segment.confidence ?? 1.0
  );

  return id;
}

export function getSegments(jobId: string): SegmentRow[] {
  const db = ensureInitialized();
  try {
    const result = db.get_segments(jobId);
    return JSON.parse(result);
  } catch {
    return [];
  }
}

// ============================================
// Frame 操作
// ============================================

export function createFrame(frame: {
  id?: string;
  job_id: string;
  timestamp: number;
  image_data: number[] | Uint8Array;
}): string {
  const db = ensureInitialized();
  const id = frame.id || generateUUID();

  // 转换为 Uint8Array
  const data = frame.image_data instanceof Uint8Array
    ? frame.image_data
    : new Uint8Array(frame.image_data);
  db.insert_frame(id, frame.job_id, frame.timestamp, data);

  return id;
}

export function getFrames(jobId: string): FrameRow[] {
  const db = ensureInitialized();
  try {
    const result = db.get_frames(jobId);
    return JSON.parse(result);
  } catch {
    return [];
  }
}

export function updateFrameOcr(frameId: string, ocrText: string): void {
  const db = ensureInitialized();
  db.update_frame_ocr(frameId, ocrText);
}

// ============================================
// Chapter 操作
// ============================================

export function createChapter(chapter: {
  id?: string;
  job_id: string;
  title: string;
  start_time: number;
  end_time: number;
  summary?: string;
}): string {
  const db = ensureInitialized();
  const id = chapter.id || generateUUID();

  db.insert_chapter(
    id,
    chapter.job_id,
    chapter.title,
    chapter.start_time,
    chapter.end_time,
    chapter.summary ?? ''
  );

  return id;
}

export function getChapters(jobId: string): ChapterRow[] {
  const db = ensureInitialized();
  try {
    const result = db.get_chapters(jobId);
    return JSON.parse(result);
  } catch {
    return [];
  }
}

// ============================================
// 统计和清理
// ============================================

export function getStats(): DatabaseStats {
  const db = ensureInitialized();
  try {
    const result = db.get_stats();
    return JSON.parse(result);
  } catch {
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

export function cleanupOldData(days: number = 30): number {
  const db = ensureInitialized();
  return db.cleanup_old_data(days);
}

// ============================================
// 导出/清理
// ============================================

export function exportJobData(jobId: string): string | null {
  const db = ensureInitialized();
  try {
    return db.export_job(jobId);
  } catch {
    return null;
  }
}

export function clearDatabase(): void {
  const db = ensureInitialized();
  db.clear_database();
}

// ============================================
// 工具函数
// ============================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 保存数据库（手动触发）
 * 大多数操作会自动保存，但此函数可用于确保数据持久化
 */
export function saveDatabase(): void {
  const db = ensureInitialized();
  db.save();
}
