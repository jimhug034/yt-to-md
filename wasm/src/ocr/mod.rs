// OCR 模块

use wasm_bindgen::prelude::*;

/// OCR 结果
#[derive(Debug, Clone)]
pub struct OcrResult {
    pub text: String,
    pub confidence: f32,
    pub boxes: Vec<TextBox>,
}

#[derive(Debug, Clone)]
pub struct TextBox {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub text: String,
}

/// OCR 处理器
/// 实际的 OCR 调用由 JS 端的 PaddleOCR WASM 完成
#[wasm_bindgen]
pub struct OcrProcessor {
    language: String,
}

#[wasm_bindgen]
impl OcrProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(language: String) -> Self {
        Self { language }
    }

    /// 解析 OCR 返回的 JSON 结果
    #[wasm_bindgen]
    pub fn parse_ocr_result(&self, result_json: &str) -> String {
        let result: serde_json::Value = match serde_json::from_str(result_json) {
            Ok(v) => v,
            Err(_) => return r#"{"text":"","confidence":0}"#.to_string(),
        };

        let text = result["text"].as_str().unwrap_or("").to_string();
        let confidence = result["confidence"].as_f64().unwrap_or(0.0);

        let output = serde_json::json!({
            "text": text,
            "confidence": confidence
        });

        output.to_string()
    }

    /// 合并多帧 OCR 结果
    #[wasm_bindgen]
    pub fn merge_frame_texts(&self, ocr_results: &str) -> String {
        let results: Vec<serde_json::Value> = serde_json::from_str(ocr_results).unwrap_or_default();

        let mut unique_texts = Vec::new();
        let mut seen = std::collections::HashSet::new();

        for result in results {
            let text = result["text"].as_str().unwrap_or("");
            let normalized = text.to_lowercase().replace(" ", "");

            if !normalized.is_empty() && !seen.contains(&normalized) {
                seen.insert(normalized);
                unique_texts.push(text.to_string());
            }
        }

        serde_json::to_string(&unique_texts).unwrap_or_default()
    }

    /// 清理 OCR 文本
    #[wasm_bindgen]
    pub fn clean_ocr_text(&self, text: &str) -> String {
        let mut cleaned = text.to_string();

        // 简单的文本清理（不使用 regex）
        // 移除多余空格
        while cleaned.contains("  ") {
            cleaned = cleaned.replace("  ", " ");
        }

        // 移除常见的噪音字符
        let noise_chars = ['|', '¦', '▪', '▫', '■', '□'];
        for ch in &noise_chars {
            cleaned = cleaned.replace(*ch, " ");
        }

        cleaned.trim().to_string()
    }
}
