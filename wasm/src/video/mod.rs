// 视频处理模块

use serde::{Deserialize, Serialize};

/// 视频元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub has_audio: bool,
    pub has_video: bool,
}

/// 处理选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessOptions {
    /// 是否提取音频
    pub extract_audio: bool,
    /// 是否提取关键帧
    pub extract_frames: bool,
    /// 是否进行 OCR
    pub enable_ocr: bool,
    /// 是否生成摘要
    pub generate_summary: bool,
    /// 关键帧提取间隔（秒）
    pub frame_interval: f64,
    /// Whisper 模型大小
    pub whisper_model: String,
    /// 语言代码
    pub language: String,
}

impl Default for ProcessOptions {
    fn default() -> Self {
        Self {
            extract_audio: true,
            extract_frames: true,
            enable_ocr: true,
            generate_summary: true,
            frame_interval: 5.0,
            whisper_model: "tiny".to_string(),
            language: "auto".to_string(),
        }
    }
}
