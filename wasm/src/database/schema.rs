use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// 简单的 UUID 生成（替代 uuid crate）
fn generate_uuid() -> String {
    use js_sys::Math;
    let part1 = (Math::random() * u32::MAX as f64) as u32;
    let part2 = (Math::random() * u32::MAX as f64) as u32;
    let part3 = (Math::random() * u32::MAX as f64) as u32;
    let part4 = (Math::random() * u32::MAX as f64) as u32;
    format!("{:08x}-{:04x}-{:04x}-{:04x}-{:012x}", part1, part2 >> 16, part2 & 0xFFFF, part3, part4)
}

/// 作业状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

impl Default for JobStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// 视频作业
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoJob {
    pub id: String,
    pub source_url: Option<String>,
    pub file_name: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub created_at: i64,
    pub status: JobStatus,
    pub progress: f32,
    pub error_message: Option<String>,
}

impl VideoJob {
    pub fn new(file_name: String) -> Self {
        Self {
            id: generate_uuid(),
            source_url: None,
            file_name,
            duration: 0.0,
            width: 0,
            height: 0,
            created_at: js_sys::Date::now() as i64,
            status: JobStatus::Pending,
            progress: 0.0,
            error_message: None,
        }
    }
}

/// 字幕片段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: String,
    pub job_id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
    pub confidence: f32,
}

impl TranscriptSegment {
    pub fn new(job_id: String, start_time: f64, end_time: f64, text: String) -> Self {
        Self {
            id: generate_uuid(),
            job_id,
            start_time,
            end_time,
            text,
            confidence: 1.0,
        }
    }
}

/// 关键帧
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyFrame {
    pub id: String,
    pub job_id: String,
    pub timestamp: f64,
    pub image_data: Vec<u8>, // JPEG 数据
    pub ocr_text: Option<String>,
    pub chapter_id: Option<String>,
}

impl KeyFrame {
    pub fn new(job_id: String, timestamp: f64, image_data: Vec<u8>) -> Self {
        Self {
            id: generate_uuid(),
            job_id,
            timestamp,
            image_data,
            ocr_text: None,
            chapter_id: None,
        }
    }
}

/// 章节
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub job_id: String,
    pub title: String,
    pub start_time: f64,
    pub end_time: f64,
    pub summary: String,
}

impl Chapter {
    pub fn new(job_id: String, title: String, start_time: f64, end_time: f64) -> Self {
        Self {
            id: generate_uuid(),
            job_id,
            title,
            start_time,
            end_time,
            summary: String::new(),
        }
    }
}

/// 内存数据库 - 使用 Arc<Mutex<>> 实现线程安全
#[derive(Clone)]
pub struct Database {
    jobs: Arc<Mutex<HashMap<String, VideoJob>>>,
    segments: Arc<Mutex<HashMap<String, Vec<TranscriptSegment>>>>,
    frames: Arc<Mutex<HashMap<String, Vec<KeyFrame>>>>,
    chapters: Arc<Mutex<HashMap<String, Vec<Chapter>>>>,
}

impl Default for Database {
    fn default() -> Self {
        Self::new()
    }
}

impl Database {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            segments: Arc::new(Mutex::new(HashMap::new())),
            frames: Arc::new(Mutex::new(HashMap::new())),
            chapters: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    // Job 操作
    pub fn insert_job(&self, job: VideoJob) -> Result<(), String> {
        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        jobs.insert(job.id.clone(), job);
        Ok(())
    }

    pub fn get_job(&self, job_id: &str) -> Option<VideoJob> {
        let jobs = self.jobs.lock().ok()?;
        jobs.get(job_id).cloned()
    }

    pub fn update_job_status(&self, job_id: &str, status: JobStatus) -> Result<(), String> {
        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = status;
            Ok(())
        } else {
            Err(format!("Job {} not found", job_id))
        }
    }

    pub fn update_job_progress(&self, job_id: &str, progress: f32) -> Result<(), String> {
        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            job.progress = progress;
            Ok(())
        } else {
            Err(format!("Job {} not found", job_id))
        }
    }

    pub fn update_job_metadata(
        &self,
        job_id: &str,
        duration: f64,
        width: u32,
        height: u32,
    ) -> Result<(), String> {
        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            job.duration = duration;
            job.width = width;
            job.height = height;
            Ok(())
        } else {
            Err(format!("Job {} not found", job_id))
        }
    }

    pub fn set_job_error(&self, job_id: &str, error: String) -> Result<(), String> {
        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = JobStatus::Failed;
            job.error_message = Some(error);
            Ok(())
        } else {
            Err(format!("Job {} not found", job_id))
        }
    }

    // TranscriptSegment 操作
    pub fn insert_segment(&self, segment: TranscriptSegment) -> Result<(), String> {
        let mut segments = self.segments.lock().map_err(|e| e.to_string())?;
        segments
            .entry(segment.job_id.clone())
            .or_insert_with(Vec::new)
            .push(segment);
        Ok(())
    }

    pub fn get_segments(&self, job_id: &str) -> Vec<TranscriptSegment> {
        let segments = self.segments.lock().ok();
        segments
            .and_then(|s| s.get(job_id).cloned())
            .unwrap_or_default()
    }

    pub fn get_segments_in_range(
        &self,
        job_id: &str,
        start: f64,
        end: f64,
    ) -> Vec<TranscriptSegment> {
        self.get_segments(job_id)
            .into_iter()
            .filter(|s| s.start_time >= start && s.end_time <= end)
            .collect()
    }

    // KeyFrame 操作
    pub fn insert_frame(&self, frame: KeyFrame) -> Result<(), String> {
        let mut frames = self.frames.lock().map_err(|e| e.to_string())?;
        frames
            .entry(frame.job_id.clone())
            .or_insert_with(Vec::new)
            .push(frame);
        Ok(())
    }

    pub fn get_frames(&self, job_id: &str) -> Vec<KeyFrame> {
        let frames = self.frames.lock().ok();
        frames.and_then(|f| f.get(job_id).cloned()).unwrap_or_default()
    }

    pub fn update_frame_ocr(&self, frame_id: &str, ocr_text: String) -> Result<(), String> {
        let mut frames = self.frames.lock().map_err(|e| e.to_string())?;
        for job_frames in frames.values_mut() {
            if let Some(frame) = job_frames.iter_mut().find(|f| f.id == frame_id) {
                frame.ocr_text = Some(ocr_text);
                return Ok(());
            }
        }
        Err(format!("Frame {} not found", frame_id))
    }

    pub fn link_frame_to_chapter(
        &self,
        frame_id: &str,
        chapter_id: &str,
    ) -> Result<(), String> {
        let mut frames = self.frames.lock().map_err(|e| e.to_string())?;
        for job_frames in frames.values_mut() {
            if let Some(frame) = job_frames.iter_mut().find(|f| f.id == frame_id) {
                frame.chapter_id = Some(chapter_id.to_string());
                return Ok(());
            }
        }
        Err(format!("Frame {} not found", frame_id))
    }

    // Chapter 操作
    pub fn insert_chapter(&self, chapter: Chapter) -> Result<(), String> {
        let mut chapters = self.chapters.lock().map_err(|e| e.to_string())?;
        chapters
            .entry(chapter.job_id.clone())
            .or_insert_with(Vec::new)
            .push(chapter);
        Ok(())
    }

    pub fn get_chapters(&self, job_id: &str) -> Vec<Chapter> {
        let chapters = self.chapters.lock().ok();
        chapters
            .and_then(|c| c.get(job_id).cloned())
            .unwrap_or_default()
    }

    pub fn update_chapter_summary(
        &self,
        chapter_id: &str,
        summary: String,
    ) -> Result<(), String> {
        let mut chapters = self.chapters.lock().map_err(|e| e.to_string())?;
        for job_chapters in chapters.values_mut() {
            if let Some(chapter) = job_chapters.iter_mut().find(|c| c.id == chapter_id) {
                chapter.summary = summary;
                return Ok(());
            }
        }
        Err(format!("Chapter {} not found", chapter_id))
    }

    // 清理操作
    pub fn clear_job(&self, job_id: &str) -> Result<(), String> {
        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        let mut segments = self.segments.lock().map_err(|e| e.to_string())?;
        let mut frames = self.frames.lock().map_err(|e| e.to_string())?;
        let mut chapters = self.chapters.lock().map_err(|e| e.to_string())?;

        jobs.remove(job_id);
        segments.remove(job_id);
        frames.remove(job_id);
        chapters.remove(job_id);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_job_operations() {
        let db = Database::new();
        let job = VideoJob::new("test.mp4".to_string());
        let job_id = job.id.clone();

        db.insert_job(job).unwrap();

        let retrieved = db.get_job(&job_id).unwrap();
        assert_eq!(retrieved.file_name, "test.mp4");
        assert_eq!(retrieved.status, JobStatus::Pending);

        db.update_job_status(&job_id, JobStatus::Processing)
            .unwrap();
        let updated = db.get_job(&job_id).unwrap();
        assert_eq!(updated.status, JobStatus::Processing);
    }

    #[test]
    fn test_database_segment_operations() {
        let db = Database::new();
        let job_id = "job-1".to_string();

        let segment1 = TranscriptSegment::new(job_id.clone(), 0.0, 5.0, "Hello".to_string());
        let segment2 = TranscriptSegment::new(job_id.clone(), 5.0, 10.0, "World".to_string());

        db.insert_segment(segment1).unwrap();
        db.insert_segment(segment2).unwrap();

        let segments = db.get_segments(&job_id);
        assert_eq!(segments.len(), 2);
    }

    #[test]
    fn test_database_frame_operations() {
        let db = Database::new();
        let job_id = "job-1".to_string();

        let frame = KeyFrame::new(job_id.clone(), 5.0, vec![1, 2, 3, 4]);
        let frame_id = frame.id.clone();

        db.insert_frame(frame).unwrap();

        let frames = db.get_frames(&job_id);
        assert_eq!(frames.len(), 1);

        db.update_frame_ocr(&frame_id, "OCR Text".to_string())
            .unwrap();

        let frames = db.get_frames(&job_id);
        assert_eq!(frames[0].ocr_text, Some("OCR Text".to_string()));
    }

    #[test]
    fn test_database_chapter_operations() {
        let db = Database::new();
        let job_id = "job-1".to_string();

        let chapter = Chapter::new(job_id.clone(), "Intro".to_string(), 0.0, 60.0);
        let chapter_id = chapter.id.clone();

        db.insert_chapter(chapter).unwrap();

        let chapters = db.get_chapters(&job_id);
        assert_eq!(chapters.len(), 1);

        db.update_chapter_summary(&chapter_id, "Summary text".to_string())
            .unwrap();

        let chapters = db.get_chapters(&job_id);
        assert_eq!(chapters[0].summary, "Summary text");
    }
}
