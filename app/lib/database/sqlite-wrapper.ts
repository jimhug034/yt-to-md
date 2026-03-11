/**
 * SQLite Wrapper for WASM
 * 使用 sql.js 或类似库在浏览器中实现 SQLite 功能
 */

// @ts-ignore - sql.js doesn't have built-in types
import initSqlJs from "sql.js";

export type QueryResult = any[][] | { [key: string]: any }[];

export class SQLiteDatabase {
  private db: any = null;
  private SQL: any = null;
  private isInitialized: boolean = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.SQL = await initSqlJs({
        // 从 CDN 加载 WASM 文件
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
      });

      this.db = new this.SQL.Database();
      this.createTables();
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize SQLite:", error);
      throw error;
    }
  }

  private createTables(): void {
    if (!this.db) return;

    // 创建作业表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        source_url TEXT,
        file_name TEXT NOT NULL,
        duration REAL,
        width INTEGER,
        height INTEGER,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        options_json TEXT,
        error_message TEXT
      )
    `);

    // 创建字幕片段表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS transcript_segments (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        text TEXT NOT NULL,
        confidence REAL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      )
    `);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_segments_time ON transcript_segments(start_time)");

    // 创建关键帧表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS key_frames (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        timestamp REAL NOT NULL,
        image_data BLOB NOT NULL,
        ocr_text TEXT,
        chapter_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      )
    `);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_frames_timestamp ON key_frames(timestamp)");

    // 创建章节表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        title TEXT NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        summary TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id)
      )
    `);
  }

  // Job 操作
  insertJob(job: {
    id: string;
    source_url: string | null;
    file_name: string;
    duration: number;
    width: number;
    height: number;
    created_at: number;
    status: string;
    error_message: string | null;
  }): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.run(
      `INSERT INTO jobs (id, source_url, file_name, duration, width, height, created_at, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.source_url,
        job.file_name,
        job.duration,
        job.width,
        job.height,
        job.created_at,
        job.status,
        job.error_message,
      ],
    );
  }

  getJob(jobId: string): any {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare("SELECT * FROM jobs WHERE id = ?");
    const result = stmt.get(jobId);
    stmt.free();

    return result;
  }

  updateJobStatus(jobId: string, status: string): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.run("UPDATE jobs SET status = ? WHERE id = ?", [status, jobId]);
  }

  // Segment 操作
  insertSegment(segment: {
    id: string;
    job_id: string;
    start_time: number;
    end_time: number;
    text: string;
    confidence: number;
  }): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.run(
      `INSERT INTO transcript_segments (id, job_id, start_time, end_time, text, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        segment.id,
        segment.job_id,
        segment.start_time,
        segment.end_time,
        segment.text,
        segment.confidence,
        Date.now(),
      ],
    );
  }

  getSegments(jobId: string): any[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare(
      "SELECT * FROM transcript_segments WHERE job_id = ? ORDER BY start_time",
    );
    const results: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row);
    }
    stmt.free();

    return results;
  }

  // Frame 操作
  insertFrame(frame: {
    id: string;
    job_id: string;
    timestamp: number;
    image_data: Uint8Array;
    ocr_text: string | null;
  }): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.run(
      `INSERT INTO key_frames (id, job_id, timestamp, image_data, ocr_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [frame.id, frame.job_id, frame.timestamp, frame.image_data, frame.ocr_text, Date.now()],
    );
  }

  getFrames(jobId: string): any[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare("SELECT * FROM key_frames WHERE job_id = ? ORDER BY timestamp");
    const results: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row);
    }
    stmt.free();

    return results;
  }

  // Chapter 操作
  insertChapter(chapter: {
    id: string;
    job_id: string;
    title: string;
    start_time: number;
    end_time: number;
    summary: string;
  }): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.run(
      `INSERT INTO chapters (id, job_id, title, start_time, end_time, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        chapter.id,
        chapter.job_id,
        chapter.title,
        chapter.start_time,
        chapter.end_time,
        chapter.summary,
        Date.now(),
      ],
    );
  }

  getChapters(jobId: string): any[] {
    if (!this.db) throw new Error("Database not initialized");

    const stmt = this.db.prepare("SELECT * FROM chapters WHERE job_id = ? ORDER BY start_time");
    const results: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row);
    }
    stmt.free();

    return results;
  }

  // 清理操作
  clearJob(jobId: string): void {
    if (!this.db) throw new Error("Database not initialized");

    this.db.run("DELETE FROM key_frames WHERE job_id = ?", [jobId]);
    this.db.run("DELETE FROM transcript_segments WHERE job_id = ?", [jobId]);
    this.db.run("DELETE FROM chapters WHERE job_id = ?", [jobId]);
    this.db.run("DELETE FROM jobs WHERE id = ?", [jobId]);
  }

  // 导出数据库
  export(): Uint8Array {
    if (!this.db) throw new Error("Database not initialized");
    return this.db.export();
  }

  // 导入数据库
  import(data: Uint8Array): void {
    if (!this.db) throw new Error("Database not initialized");
    this.db = new this.SQL.Database(data);
    this.isInitialized = true;
  }

  // 释放资源
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
  }
}

// 单例
export let sqliteDb: SQLiteDatabase | null = null;

export async function getSQLiteDatabase(): Promise<SQLiteDatabase> {
  if (!sqliteDb) {
    sqliteDb = new SQLiteDatabase();
    await sqliteDb.init();
  }
  return sqliteDb;
}

export function closeSQLiteDatabase() {
  sqliteDb?.close();
  sqliteDb = null;
}

/**
 * 导出数据库到文件
 */
export async function exportDatabaseToFile(db: SQLiteDatabase, filename: string): Promise<void> {
  const data = db.export();
  // @ts-ignore - Uint8Array is valid for Blob
  const blob = new Blob([data], { type: "application/x-sqlite3" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * 从文件导入数据库
 */
export async function importDatabaseFromFile(file: File): Promise<SQLiteDatabase> {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  const db = new SQLiteDatabase();
  await db.init();
  db.import(data);

  return db;
}
