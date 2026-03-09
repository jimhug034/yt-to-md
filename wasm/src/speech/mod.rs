// 语音识别模块

use crate::database::TranscriptSegment;
use wasm_bindgen::prelude::*;

/// Whisper 识别结果
#[derive(Debug, Clone)]
pub struct WhisperResult {
    pub segments: Vec<TranscriptSegment>,
    pub language: String,
}

/// 语音识别器封装
/// 实际的 Whisper WASM 调用在 JS 端完成
#[wasm_bindgen]
pub struct SpeechRecognizer {
    language: String,
}

#[wasm_bindgen]
impl SpeechRecognizer {
    #[wasm_bindgen(constructor)]
    pub fn new(language: String) -> Self {
        Self { language }
    }

    /// 解析 Whisper 返回的 JSON 结果
    #[wasm_bindgen]
    pub fn parse_whisper_result(&self, result_json: &str, job_id: &str) -> String {
        let result: serde_json::Value = match serde_json::from_str(result_json) {
            Ok(v) => v,
            Err(_) => return "[]".to_string(),
        };

        let segments = result["segments"].as_array();

        let transcript_segments: Vec<TranscriptSegment> = segments
            .map(|arr| {
                arr.iter()
                    .filter_map(|seg| {
                        let start = seg["start"].as_f64()?;
                        let end = seg["end"].as_f64()?;
                        let text = seg["text"].as_str()?;
                        Some(TranscriptSegment::new(
                            job_id.to_string(),
                            start,
                            end,
                            text.trim().to_string(),
                        ))
                    })
                    .collect()
            })
            .unwrap_or_default();

        serde_json::to_string(&transcript_segments).unwrap_or_default()
    }

    /// 合并短片段
    #[wasm_bindgen]
    pub fn merge_short_segments(&self, segments_json: &str, min_duration: f64) -> String {
        let segments: Vec<TranscriptSegment> =
            match serde_json::from_str(segments_json) {
                Ok(v) => v,
                Err(_) => return "[]".to_string(),
            };

        if segments.is_empty() {
            return "[]".to_string();
        }

        let mut merged = Vec::new();
        let mut current = segments[0].clone();

        for segment in segments.into_iter().skip(1) {
            let duration = segment.end_time - segment.start_time;

            if duration < min_duration {
                // 合并到当前片段
                current.end_time = segment.end_time;
                current.text.push(' ');
                current.text.push_str(&segment.text);
            } else {
                merged.push(current);
                current = segment;
            }
        }

        merged.push(current);

        serde_json::to_string(&merged).unwrap_or_default()
    }
}
