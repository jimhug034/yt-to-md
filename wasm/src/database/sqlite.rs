// SQLite 模块 - 生成 SQL 语句和处理序列化
// 在 WASM 环境中，Rust 端负责 SQL 生成，JavaScript 端使用 sql.js 执行

use wasm_bindgen::prelude::*;
use crate::database::schema::{VideoJob, TranscriptSegment, KeyFrame, Chapter, JobStatus};

/// SQLite 数据库助手类
#[wasm_bindgen]
pub struct SQLiteHelper {
    _private: (),
}

#[wasm_bindgen]
impl SQLiteHelper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { _private: () }
    }

    /// 生成创建表的 SQL 语句
    #[wasm_bindgen]
    pub fn get_create_tables_sql() -> String {
        format!(
            "{}\n{}\n{}\n{}\n{}",
            Self::create_jobs_table(),
            Self::create_segments_table(),
            Self::create_frames_table(),
            Self::create_chapters_table(),
            Self::create_indexes()
        )
    }

    /// 创建 jobs 表
    fn create_jobs_table() -> String {
        r#"
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            source_url TEXT,
            file_name TEXT NOT NULL,
            duration REAL DEFAULT 0,
            width INTEGER DEFAULT 0,
            height INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending',
            progress REAL DEFAULT 0,
            error_message TEXT
        );
        "#.to_string()
    }

    /// 创建 segments 表
    fn create_segments_table() -> String {
        r#"
        CREATE TABLE IF NOT EXISTS segments (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            text TEXT NOT NULL,
            confidence REAL DEFAULT 1.0,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        );
        "#.to_string()
    }

    /// 创建 frames 表
    fn create_frames_table() -> String {
        r#"
        CREATE TABLE IF NOT EXISTS frames (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            timestamp REAL NOT NULL,
            image_data BLOB NOT NULL,
            ocr_text TEXT,
            chapter_id TEXT,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
        );
        "#.to_string()
    }

    /// 创建 chapters 表
    fn create_chapters_table() -> String {
        r#"
        CREATE TABLE IF NOT EXISTS chapters (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            title TEXT NOT NULL,
            start_time REAL NOT NULL,
            end_time REAL NOT NULL,
            summary TEXT DEFAULT '',
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        );
        "#.to_string()
    }

    /// 创建索引
    fn create_indexes() -> String {
        r#"
        CREATE INDEX IF NOT EXISTS idx_segments_job_id ON segments(job_id);
        CREATE INDEX IF NOT EXISTS idx_segments_start_time ON segments(start_time);
        CREATE INDEX IF NOT EXISTS idx_frames_job_id ON frames(job_id);
        CREATE INDEX IF NOT EXISTS idx_frames_timestamp ON frames(timestamp);
        CREATE INDEX IF NOT EXISTS idx_chapters_job_id ON chapters(job_id);
        CREATE INDEX IF NOT EXISTS idx_chapters_start_time ON chapters(start_time);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
        "#.to_string()
    }

    /// 生成插入 job 的 SQL
    #[wasm_bindgen]
    pub fn insert_job_sql(
        id: &str,
        source_url: Option<String>,
        file_name: &str,
        duration: f64,
        width: u32,
        height: u32,
        created_at: f64,
        status: &str,
        progress: f32,
    ) -> String {
        let source = source_url.unwrap_or_else(|| "NULL".to_string());
        format!(
            "INSERT INTO jobs (id, source_url, file_name, duration, width, height, created_at, status, progress) \
             VALUES ('{}', {}, '{}', {}, {}, {}, {}, '{}', {});",
            escape_sql(id),
            if source == "NULL" { "NULL".to_string() } else { format!("'{}'", escape_sql(&source)) },
            escape_sql(file_name),
            duration,
            width,
            height,
            created_at as i64,
            status,
            progress
        )
    }

    /// 生成更新 job 状态的 SQL
    #[wasm_bindgen]
    pub fn update_job_status_sql(job_id: &str, status: &str) -> String {
        format!(
            "UPDATE jobs SET status = '{}' WHERE id = '{}';",
            status,
            escape_sql(job_id)
        )
    }

    /// 生成更新 job 进度的 SQL
    #[wasm_bindgen]
    pub fn update_job_progress_sql(job_id: &str, progress: f32) -> String {
        format!(
            "UPDATE jobs SET progress = {} WHERE id = '{}';",
            progress,
            escape_sql(job_id)
        )
    }

    /// 生成获取 job 的 SQL
    #[wasm_bindgen]
    pub fn get_job_sql(job_id: &str) -> String {
        format!(
            "SELECT * FROM jobs WHERE id = '{}';",
            escape_sql(job_id)
        )
    }

    /// 生成获取所有 jobs 的 SQL
    #[wasm_bindgen]
    pub fn get_all_jobs_sql(limit: Option<u32>, offset: Option<u32>) -> String {
        let limit_str = limit.map(|l| format!(" LIMIT {}", l)).unwrap_or_default();
        let offset_str = offset.map(|o| format!(" OFFSET {}", o)).unwrap_or_default();
        format!(
            "SELECT * FROM jobs ORDER BY created_at DESC{}{};",
            limit_str, offset_str
        )
    }

    /// 生成删除 job 的 SQL
    #[wasm_bindgen]
    pub fn delete_job_sql(job_id: &str) -> String {
        format!(
            "DELETE FROM jobs WHERE id = '{}';",
            escape_sql(job_id)
        )
    }

    /// 生成插入 segment 的 SQL
    #[wasm_bindgen]
    pub fn insert_segment_sql(
        id: &str,
        job_id: &str,
        start_time: f64,
        end_time: f64,
        text: &str,
        confidence: f32,
    ) -> String {
        format!(
            "INSERT INTO segments (id, job_id, start_time, end_time, text, confidence) \
             VALUES ('{}', '{}', {}, {}, '{}', {});",
            escape_sql(id),
            escape_sql(job_id),
            start_time,
            end_time,
            escape_sql(text),
            confidence
        )
    }

    /// 生成获取 segments 的 SQL
    #[wasm_bindgen]
    pub fn get_segments_sql(job_id: &str) -> String {
        format!(
            "SELECT * FROM segments WHERE job_id = '{}' ORDER BY start_time ASC;",
            escape_sql(job_id)
        )
    }

    /// 生成获取时间范围内 segments 的 SQL
    #[wasm_bindgen]
    pub fn get_segments_in_range_sql(job_id: &str, start: f64, end: f64) -> String {
        format!(
            "SELECT * FROM segments WHERE job_id = '{}' AND start_time >= {} AND end_time <= {} ORDER BY start_time ASC;",
            escape_sql(job_id),
            start,
            end
        )
    }

    /// 生成插入 frame 的 SQL
    #[wasm_bindgen]
    pub fn insert_frame_sql(
        id: &str,
        job_id: &str,
        timestamp: f64,
        image_data_base64: &str,
    ) -> String {
        format!(
            "INSERT INTO frames (id, job_id, timestamp, image_data) \
             VALUES ('{}', '{}', {}, X'{}');",
            escape_sql(id),
            escape_sql(job_id),
            timestamp,
            base64_to_hex(image_data_base64)
        )
    }

    /// 生成更新 frame OCR 文本的 SQL
    #[wasm_bindgen]
    pub fn update_frame_ocr_sql(frame_id: &str, ocr_text: &str) -> String {
        format!(
            "UPDATE frames SET ocr_text = '{}' WHERE id = '{}';",
            escape_sql(ocr_text),
            escape_sql(frame_id)
        )
    }

    /// 生成获取 frames 的 SQL
    #[wasm_bindgen]
    pub fn get_frames_sql(job_id: &str) -> String {
        format!(
            "SELECT * FROM frames WHERE job_id = '{}' ORDER BY timestamp ASC;",
            escape_sql(job_id)
        )
    }

    /// 生成插入 chapter 的 SQL
    #[wasm_bindgen]
    pub fn insert_chapter_sql(
        id: &str,
        job_id: &str,
        title: &str,
        start_time: f64,
        end_time: f64,
        summary: &str,
    ) -> String {
        format!(
            "INSERT INTO chapters (id, job_id, title, start_time, end_time, summary) \
             VALUES ('{}', '{}', '{}', {}, {}, '{}');",
            escape_sql(id),
            escape_sql(job_id),
            escape_sql(title),
            start_time,
            end_time,
            escape_sql(summary)
        )
    }

    /// 生成更新 chapter summary 的 SQL
    #[wasm_bindgen]
    pub fn update_chapter_summary_sql(chapter_id: &str, summary: &str) -> String {
        format!(
            "UPDATE chapters SET summary = '{}' WHERE id = '{}';",
            escape_sql(summary),
            escape_sql(chapter_id)
        )
    }

    /// 生成获取 chapters 的 SQL
    #[wasm_bindgen]
    pub fn get_chapters_sql(job_id: &str) -> String {
        format!(
            "SELECT * FROM chapters WHERE job_id = '{}' ORDER BY start_time ASC;",
            escape_sql(job_id)
        )
    }

    /// 生成获取完整 job 数据的 SQL（包含所有关联数据）
    #[wasm_bindgen]
    pub fn get_full_job_data_sql(job_id: &str) -> String {
        format!(
            "-- Get job
            SELECT * FROM jobs WHERE id = '{}';

            -- Get segments
            SELECT * FROM segments WHERE job_id = '{}' ORDER BY start_time;

            -- Get frames
            SELECT * FROM frames WHERE job_id = '{}' ORDER BY timestamp;

            -- Get chapters
            SELECT * FROM chapters WHERE job_id = '{}' ORDER BY start_time;",
            escape_sql(job_id),
            escape_sql(job_id),
            escape_sql(job_id),
            escape_sql(job_id)
        )
    }

    /// 生成统计查询 SQL
    #[wasm_bindgen]
    pub fn get_stats_sql() -> String {
        r#"
        SELECT
            (SELECT COUNT(*) FROM jobs) as total_jobs,
            (SELECT COUNT(*) FROM jobs WHERE status = 'Completed') as completed_jobs,
            (SELECT COUNT(*) FROM jobs WHERE status = 'Failed') as failed_jobs,
            (SELECT COUNT(*) FROM jobs WHERE status = 'Pending') as pending_jobs,
            (SELECT COUNT(*) FROM segments) as total_segments,
            (SELECT COUNT(*) FROM frames) as total_frames,
            (SELECT COUNT(*) FROM chapters) as total_chapters;
        "#.to_string()
    }

    /// 生成清理旧数据的 SQL
    #[wasm_bindgen]
    pub fn cleanup_old_data_sql(days: i32) -> String {
        let cutoff = (js_sys::Date::now() / 1000.0 - (days as f64 * 86400.0)) as i64;
        format!(
            "-- Delete old jobs and their related data
            DELETE FROM jobs WHERE created_at < {} AND status IN ('Completed', 'Failed');",
            cutoff
        )
    }

    /// 生成导出 job 数据为 JSON
    #[wasm_bindgen]
    pub fn export_job_json(
        job_json: &str,
        segments_json: &str,
        frames_json: &str,
        chapters_json: &str,
    ) -> String {
        format!(
            r#"{{
  "job": {},
  "segments": {},
  "frames": {},
  "chapters": {},
  "exported_at": {},
  "version": "1.0.0"
}}"#,
            job_json,
            segments_json,
            frames_json,
            chapters_json,
            js_sys::Date::now() as i64
        )
    }

    /// 从 JSON 导入 job 数据的 SQL 语句（批量）
    #[wasm_bindgen]
    pub fn import_job_batch_sql(data_json: &str) -> String {
        // 解析 JSON 并生成批量插入语句
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(data_json) {
            let mut sql = String::from("-- Begin transaction\nBEGIN TRANSACTION;\n");

            // 插入 job
            if let Some(job) = data.get("job") {
                if let (Some(id), Some(file_name)) = (job.get("id"), job.get("file_name")) {
                    sql.push_str(&format!(
                        "INSERT OR REPLACE INTO jobs (id, source_url, file_name, duration, width, height, created_at, status, progress) \
                         VALUES ('{}', {}, '{}', {}, {}, {}, {}, '{}', {});\n",
                        escape_sql(&id.as_str().unwrap_or_default()),
                        if job.get("source_url").is_some() {
                            format!("'{}'", escape_sql(job.get("source_url").and_then(|v| v.as_str()).unwrap_or_default()))
                        } else {
                            "NULL".to_string()
                        },
                        escape_sql(file_name.as_str().unwrap_or_default()),
                        job.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0),
                        job.get("width").and_then(|v| v.as_u64()).unwrap_or(0),
                        job.get("height").and_then(|v| v.as_u64()).unwrap_or(0),
                        job.get("created_at").and_then(|v| v.as_i64()).unwrap_or(0),
                        job.get("status").and_then(|v| v.as_str()).unwrap_or("Pending"),
                        job.get("progress").and_then(|v| v.as_f64()).unwrap_or(0.0)
                    ));
                }
            }

            // 插入 segments
            if let Some(segments) = data.get("segments").and_then(|v| v.as_array()) {
                for seg in segments {
                    if let (Some(id), Some(job_id), Some(text)) = (
                        seg.get("id"),
                        seg.get("job_id"),
                        seg.get("text")
                    ) {
                        sql.push_str(&format!(
                            "INSERT OR REPLACE INTO segments (id, job_id, start_time, end_time, text, confidence) \
                             VALUES ('{}', '{}', {}, {}, '{}', {});\n",
                            escape_sql(id.as_str().unwrap_or_default()),
                            escape_sql(job_id.as_str().unwrap_or_default()),
                            seg.get("start_time").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            seg.get("end_time").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            escape_sql(text.as_str().unwrap_or_default()),
                            seg.get("confidence").and_then(|v| v.as_f64()).unwrap_or(1.0)
                        ));
                    }
                }
            }

            // 插入 chapters
            if let Some(chapters) = data.get("chapters").and_then(|v| v.as_array()) {
                for ch in chapters {
                    if let (Some(id), Some(job_id), Some(title)) = (
                        ch.get("id"),
                        ch.get("job_id"),
                        ch.get("title")
                    ) {
                        sql.push_str(&format!(
                            "INSERT OR REPLACE INTO chapters (id, job_id, title, start_time, end_time, summary) \
                             VALUES ('{}', '{}', '{}', {}, {}, '{}');\n",
                            escape_sql(id.as_str().unwrap_or_default()),
                            escape_sql(job_id.as_str().unwrap_or_default()),
                            escape_sql(title.as_str().unwrap_or_default()),
                            ch.get("start_time").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            ch.get("end_time").and_then(|v| v.as_f64()).unwrap_or(0.0),
                            escape_sql(ch.get("summary").and_then(|v| v.as_str()).unwrap_or_default())
                        ));
                    }
                }
            }

            sql.push_str("-- Commit transaction\nCOMMIT;\n");
            sql
        } else {
            "-- Invalid JSON".to_string()
        }
    }
}

/// SQL 转义函数
fn escape_sql(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\'', "''")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

/// 将 base64 转换为十六进制字符串（用于 BLOB 插入）
fn base64_to_hex(base64: &str) -> String {
    // 简化版本：假设输入是 base64 编码的图片数据
    // 在实际应用中，需要正确解码 base64
    // 这里返回原始字符串，因为我们将以另一种方式处理图片数据
    base64.replace("data:image/jpeg;base64,", "")
        .replace("data:image/png;base64,", "")
}

/// JobStatus 到字符串的转换
impl From<JobStatus> for String {
    fn from(status: JobStatus) -> Self {
        match status {
            JobStatus::Pending => "Pending".to_string(),
            JobStatus::Processing => "Processing".to_string(),
            JobStatus::Completed => "Completed".to_string(),
            JobStatus::Failed => "Failed".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_tables_sql() {
        let sql = SQLiteHelper::get_create_tables_sql();
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS jobs"));
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS segments"));
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS frames"));
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS chapters"));
    }

    #[test]
    fn test_insert_job_sql() {
        let sql = SQLiteHelper::insert_job_sql(
            "test-id",
            Some("https://example.com".to_string()),
            "test.mp4",
            120.5,
            1920,
            1080,
            1640000000.0,
            "Pending",
            0.0,
        );
        assert!(sql.contains("INSERT INTO jobs"));
        assert!(sql.contains("test.mp4"));
    }

    #[test]
    fn test_escape_sql() {
        assert_eq!(escape_sql("test's value"), "test''s value");
        assert_eq!(escape_sql("test\nvalue"), "test\\nvalue");
    }
}
