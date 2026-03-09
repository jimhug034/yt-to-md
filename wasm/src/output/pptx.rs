// PPTX 生成模块
// 输出 JSON 数据供前端 JS 库生成 PPTX

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// 本地定义类型以避免 wasm-bindgen 问题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoJob {
    pub file_name: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: String,
    pub job_id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub job_id: String,
    pub title: String,
    pub start_time: f64,
    pub end_time: f64,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyFrame {
    pub id: String,
    pub job_id: String,
    pub timestamp: f64,
    pub image_data: Vec<u8>,
}

/// PPTX 幻灯片内容
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideContent {
    pub title: String,
    pub body: String,
    pub image_data: Option<Vec<u8>>,
    pub notes: Option<String>,
}

/// PPTX 生成器
#[wasm_bindgen]
pub struct PptxGenerator {
    title: String,
    author: String,
}

#[wasm_bindgen]
impl PptxGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(title: String, author: String) -> Self {
        Self { title, author }
    }

    /// 生成完整的 PPTX 文件（返回 JSON 数据）
    #[wasm_bindgen]
    pub fn generate(
        &self,
        job_json: &str,
        segments_json: &str,
        chapters_json: &str,
        frames_json: &str,
    ) -> String {
        let job: VideoJob = match serde_json::from_str(job_json) {
            Ok(v) => v,
            Err(_) => return "[]".to_string(),
        };

        let segments: Vec<TranscriptSegment> = match serde_json::from_str(segments_json) {
            Ok(v) => v,
            Err(_) => Vec::new(),
        };

        let chapters: Vec<Chapter> = match serde_json::from_str(chapters_json) {
            Ok(v) => v,
            Err(_) => Vec::new(),
        };

        let frames: Vec<KeyFrame> = match serde_json::from_str(frames_json) {
            Ok(v) => v,
            Err(_) => Vec::new(),
        };

        let slide_data = self.prepare_slides(&job, &segments, &chapters, &frames);
        serde_json::to_string(&slide_data).unwrap_or_default()
    }

    /// 准备幻灯片数据
    fn prepare_slides(
        &self,
        job: &VideoJob,
        segments: &[TranscriptSegment],
        chapters: &[Chapter],
        frames: &[KeyFrame],
    ) -> Vec<SlideContent> {
        let mut slides = Vec::new();

        // 标题页
        slides.push(SlideContent {
            title: job.file_name.clone(),
            body: format!("Duration: {:.1} seconds", job.duration),
            image_data: frames.first().map(|f| f.image_data.clone()),
            notes: None,
        });

        // 目录页
        if !chapters.is_empty() {
            let toc = chapters
                .iter()
                .map(|c| format!("{}: {}", self.format_time(c.start_time), c.title))
                .collect::<Vec<_>>()
                .join("\n");

            slides.push(SlideContent {
                title: "Table of Contents".to_string(),
                body: toc,
                image_data: None,
                notes: None,
            });
        }

        // 章节页
        for (i, chapter) in chapters.iter().enumerate() {
            let chapter_frames: Vec<_> = frames
                .iter()
                .filter(|f| {
                    f.timestamp >= chapter.start_time
                        && f.timestamp <= chapter.end_time
                })
                .collect();

            let body = if chapter.summary.is_empty() {
                self.get_segments_text(segments, chapter.start_time, chapter.end_time)
            } else {
                chapter.summary.clone()
            };

            slides.push(SlideContent {
                title: format!("{}: {}", i + 1, chapter.title),
                body,
                image_data: chapter_frames.first().map(|f| f.image_data.clone()),
                notes: None,
            });

            // 内容详情页（如果章节内容较长）
            let segment_count = segments
                .iter()
                .filter(|s| {
                    s.start_time >= chapter.start_time && s.end_time <= chapter.end_time
                })
                .count();

            if segment_count > 5 {
                let detail_text = self.get_segments_text(
                    segments,
                    chapter.start_time,
                    chapter.end_time,
                );

                slides.push(SlideContent {
                    title: format!("Details: {}", chapter.title),
                    body: detail_text.chars().take(500).collect::<String>(),
                    image_data: chapter_frames.get(1).map(|f| f.image_data.clone()),
                    notes: None,
                });
            }
        }

        // 结束页
        slides.push(SlideContent {
            title: "Thank You".to_string(),
            body: format!("Generated from {}", job.file_name),
            image_data: frames.last().map(|f| f.image_data.clone()),
            notes: None,
        });

        slides
    }

    /// 获取时间范围内的字幕文本
    fn get_segments_text(&self, segments: &[TranscriptSegment], start: f64, end: f64) -> String {
        segments
            .iter()
            .filter(|s| s.start_time >= start && s.end_time <= end)
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(300)
            .collect::<String>()
    }

    /// 格式化时间
    fn format_time(&self, seconds: f64) -> String {
        let mins = (seconds / 60.0) as u32;
        let secs = (seconds % 60.0) as u32;
        format!("{:02}:{:02}", mins, secs)
    }

    /// 导出为 JSON 供前端使用
    #[wasm_bindgen]
    pub fn export_to_json(
        &self,
        job_json: &str,
        segments_json: &str,
        chapters_json: &str,
        frames_json: &str,
    ) -> String {
        let job: VideoJob = match serde_json::from_str(job_json) {
            Ok(v) => v,
            Err(_) => return "[]".to_string(),
        };

        let segments: Vec<TranscriptSegment> =
            match serde_json::from_str(segments_json) {
                Ok(v) => v,
                Err(_) => Vec::new(),
            };

        let chapters: Vec<Chapter> = match serde_json::from_str(chapters_json) {
            Ok(v) => v,
            Err(_) => Vec::new(),
        };

        let frames: Vec<KeyFrame> = match serde_json::from_str(frames_json) {
            Ok(v) => v,
            Err(_) => Vec::new(),
        };

        let slides = self.prepare_slides(&job, &segments, &chapters, &frames);

        serde_json::to_string(&slides).unwrap_or_default()
    }
}

/// 简化的幻灯片数据结构（用于 JSON 导出）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleSlide {
    pub title: String,
    pub content: String,
    pub image_base64: Option<String>,
    pub notes: Option<String>,
}

/// 从 SlideContent 转换
impl From<SlideContent> for SimpleSlide {
    fn from(slide: SlideContent) -> Self {
        Self {
            title: slide.title,
            content: slide.body,
            image_base64: slide.image_data.map(|data| {
                // 简化的 base64 编码 - 实际编码在 JS 端完成
                format!("data:image/jpeg;base64,<binary_data_{}_bytes>", data.len())
            }),
            notes: slide.notes,
        }
    }
}
