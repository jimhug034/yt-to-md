// Rust SQLite3 实现 - 基于 web-sys Storage API
// 提供类似 SQLite 的 CRUD 操作，完全在 Rust WASM 端实现

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{Window, Storage};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};

use crate::database::schema::{VideoJob, TranscriptSegment, KeyFrame, Chapter, JobStatus};

const DB_NAME: &str = "yt_subtitle_db";
const JOBS_KEY: &str = "jobs";
const SEGMENTS_KEY: &str = "segments";
const FRAMES_KEY: &str = "frames";
const CHAPTERS_KEY: &str = "chapters";

/// 获取 LocalStorage
fn get_storage() -> Result<Storage, JsValue> {
    let window = web_sys::window().expect("no global `window` exists");
    window.local_storage().map_err(|_| JsValue::from_str("Failed to get local_storage"))?
        .ok_or_else(|| JsValue::from_str("Local storage is not available"))
}

/// 序列化数据到 JSON
fn serialize_to_json<T: Serialize>(data: &T) -> Result<String, JsValue> {
    serde_json::to_string(data)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// 从 JSON 反序列化
fn deserialize_from_json<T: for<'de> Deserialize<'de>>(json: &str) -> Result<T, JsValue> {
    serde_json::from_str(json)
        .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))
}

/// Rust SQLite3 数据库实现
#[wasm_bindgen]
pub struct RustSQLite3 {
    jobs: Arc<Mutex<HashMap<String, VideoJob>>>,
    segments: Arc<Mutex<HashMap<String, Vec<TranscriptSegment>>>>,
    frames: Arc<Mutex<HashMap<String, Vec<KeyFrame>>>>,
    chapters: Arc<Mutex<HashMap<String, Vec<Chapter>>>>,
    loaded: Arc<Mutex<bool>>,
}

#[wasm_bindgen]
impl RustSQLite3 {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            segments: Arc::new(Mutex::new(HashMap::new())),
            frames: Arc::new(Mutex::new(HashMap::new())),
            chapters: Arc::new(Mutex::new(HashMap::new())),
            loaded: Arc::new(Mutex::new(false)),
        }
    }

    /// 初始化数据库 - 从 LocalStorage 加载数据
    #[wasm_bindgen]
    pub fn init(&self) -> Result<(), JsValue> {
        let mut loaded = self.loaded.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        if *loaded {
            return Ok(());
        }

        let storage = get_storage()?;

        // 加载 jobs
        if let Some(jobs_json) = storage.get(JOBS_KEY).ok().flatten() {
            if let Ok(jobs_map) = deserialize_from_json::<HashMap<String, VideoJob>>(&jobs_json) {
                *self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))? = jobs_map;
            }
        }

        // 加载 segments
        if let Some(segments_json) = storage.get(SEGMENTS_KEY).ok().flatten() {
            if let Ok(segments_map) = deserialize_from_json::<HashMap<String, Vec<TranscriptSegment>>>(&segments_json) {
                *self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))? = segments_map;
            }
        }

        // 加载 frames
        if let Some(frames_json) = storage.get(FRAMES_KEY).ok().flatten() {
            if let Ok(frames_map) = deserialize_from_json::<HashMap<String, Vec<KeyFrame>>>(&frames_json) {
                *self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))? = frames_map;
            }
        }

        // 加载 chapters
        if let Some(chapters_json) = storage.get(CHAPTERS_KEY).ok().flatten() {
            if let Ok(chapters_map) = deserialize_from_json::<HashMap<String, Vec<Chapter>>>(&chapters_json) {
                *self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))? = chapters_map;
            }
        }

        *loaded = true;
        Ok(())
    }

    /// 保存数据到 LocalStorage
    #[wasm_bindgen]
    pub fn save(&self) -> Result<(), JsValue> {
        let storage = get_storage()?;

        // 保存 jobs
        let jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        storage.set(JOBS_KEY, &serialize_to_json(&*jobs)?)?;

        // 保存 segments
        let segments = self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        storage.set(SEGMENTS_KEY, &serialize_to_json(&*segments)?)?;

        // 保存 frames
        let frames = self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        storage.set(FRAMES_KEY, &serialize_to_json(&*frames)?)?;

        // 保存 chapters
        let chapters = self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        storage.set(CHAPTERS_KEY, &serialize_to_json(&*chapters)?)?;

        Ok(())
    }

    /// ============================================
    /// JOB 操作
    /// ============================================

    #[wasm_bindgen]
    pub fn insert_job(
        &self,
        id: &str,
        source_url: Option<String>,
        file_name: &str,
        duration: f64,
        width: u32,
        height: u32,
        status: &str,
        progress: f32,
    ) -> Result<(), JsValue> {
        let job = VideoJob {
            id: id.to_string(),
            source_url,
            file_name: file_name.to_string(),
            duration,
            width,
            height,
            created_at: js_sys::Date::now() as i64,
            status: parse_status(status),
            progress,
            error_message: None,
        };

        let mut jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        jobs.insert(id.to_string(), job);
        self.save()?;
        Ok(())
    }

    #[wasm_bindgen]
    pub fn get_job(&self, id: &str) -> Result<String, JsValue> {
        let jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        if let Some(job) = jobs.get(id) {
            serialize_to_json(job)
        } else {
            Err(JsValue::from_str("Job not found"))
        }
    }

    #[wasm_bindgen]
    pub fn get_all_jobs(&self) -> Result<String, JsValue> {
        let jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let job_vec: Vec<&VideoJob> = jobs.values().collect();
        serialize_to_json(&job_vec)
    }

    #[wasm_bindgen]
    pub fn update_job_status(&self, id: &str, status: &str) -> Result<(), JsValue> {
        let mut jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        if let Some(job) = jobs.get_mut(id) {
            job.status = parse_status(status);
            self.save()?;
            Ok(())
        } else {
            Err(JsValue::from_str("Job not found"))
        }
    }

    #[wasm_bindgen]
    pub fn update_job_progress(&self, id: &str, progress: f32) -> Result<(), JsValue> {
        let mut jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        if let Some(job) = jobs.get_mut(id) {
            job.progress = progress;
            self.save()?;
            Ok(())
        } else {
            Err(JsValue::from_str("Job not found"))
        }
    }

    #[wasm_bindgen]
    pub fn delete_job(&self, id: &str) -> Result<(), JsValue> {
        let mut jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut segments = self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut frames = self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut chapters = self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;

        jobs.remove(id);
        segments.remove(id);
        frames.remove(id);
        chapters.remove(id);

        self.save()?;
        Ok(())
    }

    /// ============================================
    /// SEGMENT 操作
    /// ============================================

    #[wasm_bindgen]
    pub fn insert_segment(
        &self,
        id: &str,
        job_id: &str,
        start_time: f64,
        end_time: f64,
        text: &str,
        confidence: f32,
    ) -> Result<(), JsValue> {
        let segment = TranscriptSegment {
            id: id.to_string(),
            job_id: job_id.to_string(),
            start_time,
            end_time,
            text: text.to_string(),
            confidence,
        };

        let mut segments = self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        segments.entry(job_id.to_string()).or_insert_with(Vec::new).push(segment);
        self.save()?;
        Ok(())
    }

    #[wasm_bindgen]
    pub fn get_segments(&self, job_id: &str) -> Result<String, JsValue> {
        let segments = self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        if let Some(seg) = segments.get(job_id) {
            serialize_to_json(seg)
        } else {
            serialize_to_json(&Vec::<TranscriptSegment>::new())
        }
    }

    /// ============================================
    /// FRAME 操作
    /// ============================================

    #[wasm_bindgen]
    pub fn insert_frame(
        &self,
        id: &str,
        job_id: &str,
        timestamp: f64,
        image_data: &[u8],
    ) -> Result<(), JsValue> {
        let frame = KeyFrame {
            id: id.to_string(),
            job_id: job_id.to_string(),
            timestamp,
            image_data: image_data.to_vec(),
            ocr_text: None,
            chapter_id: None,
        };

        let mut frames = self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        frames.entry(job_id.to_string()).or_insert_with(Vec::new).push(frame);
        self.save()?;
        Ok(())
    }

    #[wasm_bindgen]
    pub fn get_frames(&self, job_id: &str) -> Result<String, JsValue> {
        let frames = self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        if let Some(fr) = frames.get(job_id) {
            serialize_to_json(fr)
        } else {
            serialize_to_json(&Vec::<KeyFrame>::new())
        }
    }

    #[wasm_bindgen]
    pub fn update_frame_ocr(&self, frame_id: &str, ocr_text: &str) -> Result<(), JsValue> {
        let mut frames = self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        for job_frames in frames.values_mut() {
            if let Some(frame) = job_frames.iter_mut().find(|f| f.id == frame_id) {
                frame.ocr_text = Some(ocr_text.to_string());
                self.save()?;
                return Ok(());
            }
        }
        Err(JsValue::from_str("Frame not found"))
    }

    /// ============================================
    /// CHAPTER 操作
    /// ============================================

    #[wasm_bindgen]
    pub fn insert_chapter(
        &self,
        id: &str,
        job_id: &str,
        title: &str,
        start_time: f64,
        end_time: f64,
        summary: &str,
    ) -> Result<(), JsValue> {
        let chapter = Chapter {
            id: id.to_string(),
            job_id: job_id.to_string(),
            title: title.to_string(),
            start_time,
            end_time,
            summary: summary.to_string(),
        };

        let mut chapters = self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        chapters.entry(job_id.to_string()).or_insert_with(Vec::new).push(chapter);
        self.save()?;
        Ok(())
    }

    #[wasm_bindgen]
    pub fn get_chapters(&self, job_id: &str) -> Result<String, JsValue> {
        let chapters = self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        if let Some(ch) = chapters.get(job_id) {
            serialize_to_json(ch)
        } else {
            serialize_to_json(&Vec::<Chapter>::new())
        }
    }

    /// ============================================
    /// 统计和清理
    /// ============================================

    #[wasm_bindgen]
    pub fn get_stats(&self) -> Result<String, JsValue> {
        let jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let segments = self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let frames = self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let chapters = self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;

        let stats = serde_json::json!({
            "total_jobs": jobs.len(),
            "completed_jobs": jobs.values().filter(|j| matches!(j.status, JobStatus::Completed)).count(),
            "failed_jobs": jobs.values().filter(|j| matches!(j.status, JobStatus::Failed)).count(),
            "pending_jobs": jobs.values().filter(|j| matches!(j.status, JobStatus::Pending)).count(),
            "total_segments": segments.values().map(|v| v.len()).sum::<usize>(),
            "total_frames": frames.values().map(|v| v.len()).sum::<usize>(),
            "total_chapters": chapters.values().map(|v| v.len()).sum::<usize>(),
        });

        Ok(stats.to_string())
    }

    #[wasm_bindgen]
    pub fn cleanup_old_data(&self, days: i32) -> Result<usize, JsValue> {
        let cutoff = (js_sys::Date::now() / 1000.0) - (days as f64 * 86400.0);

        let mut jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut segments = self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut frames = self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut chapters = self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;

        let mut removed_count = 0;

        let jobs_to_remove: Vec<String> = jobs
            .iter()
            .filter(|(_, job)| {
                job.created_at < cutoff as i64
                    && (matches!(job.status, JobStatus::Completed) || matches!(job.status, JobStatus::Failed))
            })
            .map(|(id, _)| id.clone())
            .collect();

        for id in &jobs_to_remove {
            jobs.remove(id);
            segments.remove(id);
            frames.remove(id);
            chapters.remove(id);
            removed_count += 1;
        }

        if removed_count > 0 {
            self.save()?;
        }

        Ok(removed_count)
    }

    /// ============================================
    /// 导出/导入
    /// ============================================

    #[wasm_bindgen]
    pub fn export_job(&self, job_id: &str) -> Result<String, JsValue> {
        let jobs = self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let segments = self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let frames = self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let chapters = self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))?;

        let job = jobs.get(job_id).ok_or_else(|| JsValue::from_str("Job not found"))?;
        let job_segments = segments.get(job_id).cloned().unwrap_or_default();
        let job_frames = frames.get(job_id).cloned().unwrap_or_default();
        let job_chapters = chapters.get(job_id).cloned().unwrap_or_default();

        let export_data = serde_json::json!({
            "job": job,
            "segments": job_segments,
            "frames": job_frames,
            "chapters": job_chapters,
            "exported_at": js_sys::Date::now() as i64,
            "version": "1.0.0"
        });

        Ok(export_data.to_string())
    }

    #[wasm_bindgen]
    pub fn clear_database(&self) -> Result<(), JsValue> {
        let storage = get_storage()?;
        storage.delete(JOBS_KEY)?;
        storage.delete(SEGMENTS_KEY)?;
        storage.delete(FRAMES_KEY)?;
        storage.delete(CHAPTERS_KEY)?;

        *self.jobs.lock().map_err(|e| JsValue::from_str(&e.to_string()))? = HashMap::new();
        *self.segments.lock().map_err(|e| JsValue::from_str(&e.to_string()))? = HashMap::new();
        *self.frames.lock().map_err(|e| JsValue::from_str(&e.to_string()))? = HashMap::new();
        *self.chapters.lock().map_err(|e| JsValue::from_str(&e.to_string()))? = HashMap::new();

        Ok(())
    }
}

/// 解析状态字符串
fn parse_status(status: &str) -> JobStatus {
    match status {
        "Pending" => JobStatus::Pending,
        "Processing" => JobStatus::Processing,
        "Completed" => JobStatus::Completed,
        "Failed" => JobStatus::Failed,
        _ => JobStatus::Pending,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_status() {
        assert_eq!(parse_status("Pending"), JobStatus::Pending);
        assert_eq!(parse_status("Processing"), JobStatus::Processing);
        assert_eq!(parse_status("Completed"), JobStatus::Completed);
        assert_eq!(parse_status("Failed"), JobStatus::Failed);
        assert_eq!(parse_status("Unknown"), JobStatus::Pending);
    }
}
