// Markdown 生成模块（扩展现有功能）

use wasm_bindgen::prelude::*;

// 本地定义类型以避免 wasm-bindgen 问题
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoJob {
    pub file_name: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub created_at: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranscriptSegment {
    pub id: String,
    pub job_id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Chapter {
    pub id: String,
    pub job_id: String,
    pub title: String,
    pub start_time: f64,
    pub end_time: f64,
    pub summary: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct KeyFrame {
    pub id: String,
    pub job_id: String,
    pub timestamp: f64,
    pub ocr_text: Option<String>,
}

/// Markdown 生成器
#[wasm_bindgen]
pub struct MarkdownGenerator {
    include_timestamps: bool,
    include_images: bool,
    include_chapters: bool,
}

#[wasm_bindgen]
impl MarkdownGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(include_timestamps: bool, include_images: bool, include_chapters: bool) -> Self {
        Self {
            include_timestamps,
            include_images,
            include_chapters,
        }
    }

    /// 生成完整的 Markdown 笔记
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
            Err(_) => return "# Error\n\nFailed to parse job data".to_string(),
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

        self.generate_internal(&job, &segments, &chapters, &frames)
    }

    /// 内部生成函数（非导出）
    fn generate_internal(
        &self,
        job: &VideoJob,
        segments: &[TranscriptSegment],
        chapters: &[Chapter],
        frames: &[KeyFrame],
    ) -> String {
        let mut md = String::new();

        // 标题
        md.push_str("# ");
        md.push_str(&job.file_name);
        md.push_str("\n\n");

        // 元数据
        md.push_str("## Metadata\n\n");
        md.push_str(&format!("- **Duration:** {:.1} seconds\n", job.duration));
        md.push_str(&format!("- **Resolution:** {}x{}\n", job.width, job.height));
        md.push_str(&format!(
            "- **Created:** {}\n",
            format_timestamp(job.created_at)
        ));
        md.push_str("\n");

        // 目录
        if self.include_chapters && !chapters.is_empty() {
            md.push_str("## Table of Contents\n\n");
            for (i, chapter) in chapters.iter().enumerate() {
                md.push_str(&format!(
                    "{}. [{}](#{}-{})\n",
                    i + 1,
                    chapter.title,
                    i + 1,
                    slugify(&chapter.title)
                ));
            }
            md.push_str("\n");
        }

        // 按章节组织内容
        if self.include_chapters && !chapters.is_empty() {
            for (i, chapter) in chapters.iter().enumerate() {
                md.push_str(&format!("## {}. {}\n\n", i + 1, chapter.title));

                // 章节摘要
                if !chapter.summary.is_empty() {
                    md.push_str(&format!("> {}\n\n", chapter.summary));
                }

                // 添加相关图片
                if self.include_images {
                    let chapter_frames: Vec<_> = frames
                        .iter()
                        .filter(|f| {
                            f.timestamp >= chapter.start_time
                                && f.timestamp <= chapter.end_time
                        })
                        .take(3)
                        .collect();

                    for frame in chapter_frames {
                        md.push_str(&format!(
                            "![Frame at {:.1}s](#frame-{})\n\n",
                            frame.timestamp,
                            frame.id.chars().take(8).collect::<String>()
                        ));
                    }
                }

                // 字幕内容
                let chapter_segments: Vec<_> = segments
                    .iter()
                    .filter(|s| {
                        s.start_time >= chapter.start_time && s.end_time <= chapter.end_time
                    })
                    .collect();

                for segment in chapter_segments {
                    if self.include_timestamps {
                        md.push_str(&format!(
                            "**[{}]** ",
                            format_timestamp_simple(segment.start_time)
                        ));
                    }
                    md.push_str(&segment.text);
                    md.push_str(" ");
                }

                md.push_str("\n\n");
            }
        } else {
            // 无章节，直接输出字幕
            md.push_str("## Transcript\n\n");

            for segment in segments {
                if self.include_timestamps {
                    md.push_str(&format!(
                        "**[{}]** ",
                        format_timestamp_simple(segment.start_time)
                    ));
                }
                md.push_str(&segment.text);
                md.push_str("\n\n");
            }
        }

        // 关键帧画廊
        if self.include_images && !frames.is_empty() {
            md.push_str("---\n\n");
            md.push_str("## Key Frames\n\n");

            for (i, frame) in frames.iter().enumerate() {
                md.push_str(&format!(
                    "### Frame {} ({:.1}s)\n\n",
                    i + 1,
                    frame.timestamp
                ));

                if let Some(ref ocr_text) = frame.ocr_text {
                    md.push_str(&format!("> OCR: {}\n\n", ocr_text));
                }
            }
        }

        md
    }

    /// 从 JSON 数据生成 Markdown（别名）
    #[wasm_bindgen]
    pub fn generate_from_json(
        &self,
        job_json: &str,
        segments_json: &str,
        chapters_json: &str,
        frames_json: &str,
    ) -> String {
        self.generate(job_json, segments_json, chapters_json, frames_json)
    }
}

/// 格式化时间戳
fn format_timestamp(ts: i64) -> String {
    let date = js_sys::Date::new(&ts.into());
    date.to_iso_string().as_string().unwrap_or_else(|| "Unknown".to_string())
}

/// 格式化简单时间戳（秒 -> MM:SS）
fn format_timestamp_simple(seconds: f64) -> String {
    let mins = (seconds / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    format!("{:02}:{:02}", mins, secs)
}

/// 生成 URL 友好的 slug
fn slugify(text: &str) -> String {
    text.chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c.to_ascii_lowercase()
            } else if c.is_whitespace() {
                '-'
            } else {
                '\0'
            }
        })
        .filter(|&c| c != '\0')
        .collect()
}
