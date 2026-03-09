// 关键帧提取模块

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// 帧类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FrameType {
    KeyFrame,
    SceneChange,
    Periodic,
    Manual,
}

/// 帧元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameMetadata {
    pub timestamp: f64,
    pub frame_type: FrameType,
    pub brightness: f32,
    pub motion_score: f32,
    pub is_duplicate: bool,
}

/// 关键帧提取器
#[wasm_bindgen]
pub struct FrameExtractor {
    interval: f64,
    last_frame_hash: Option<u64>,
}

#[wasm_bindgen]
impl FrameExtractor {
    #[wasm_bindgen(constructor)]
    pub fn new(interval: f64) -> Self {
        Self {
            interval,
            last_frame_hash: None,
        }
    }

    /// 计算帧哈希（用于检测重复帧）
    #[wasm_bindgen]
    pub fn calculate_frame_hash(&self, image_data: &[u8]) -> u64 {
        // 简单的哈希算法 - 使用采样像素
        let mut hash: u64 = 5381;

        // 每 100 个字节采样一次
        for (i, &byte) in image_data.iter().enumerate() {
            if i % 100 == 0 {
                hash = hash.wrapping_mul(33).wrapping_add(byte as u64);
            }
        }

        hash
    }

    /// 检测是否为重复帧
    #[wasm_bindgen]
    pub fn is_duplicate_frame(&mut self, image_data: &[u8], threshold: f32) -> bool {
        let current_hash = self.calculate_frame_hash(image_data);

        if let Some(last_hash) = self.last_frame_hash {
            // 简单的哈希比较
            let diff = if current_hash > last_hash {
                current_hash - last_hash
            } else {
                last_hash - current_hash
            };

            let similarity = 1.0 - (diff as f32 / u64::MAX as f32);

            self.last_frame_hash = Some(current_hash);
            similarity > threshold
        } else {
            self.last_frame_hash = Some(current_hash);
            false
        }
    }

    /// 确定是否应该提取此帧
    #[wasm_bindgen]
    pub fn should_extract_frame(&self, timestamp: f64, last_extracted: f64) -> bool {
        timestamp - last_extracted >= self.interval
    }

    /// 根据场景变化计算关键帧时间点
    /// 输入：JSON 数组 [{"time": 0.0, "score": 0.5}, ...]
    #[wasm_bindgen]
    pub fn detect_scene_changes(&self, motion_scores: &str, threshold: f32) -> String {
        let scores: Vec<MotionScore> = serde_json::from_str(motion_scores).unwrap_or_default();
        let mut keyframes = Vec::new();

        for score in scores.iter() {
            if score.motion_score > threshold {
                keyframes.push(score.timestamp);
            }
        }

        serde_json::to_string(&keyframes).unwrap_or_default()
    }

    /// 分析图像亮度
    #[wasm_bindgen]
    pub fn analyze_brightness(&self, image_data: &[u8]) -> f32 {
        // 假设是 JPEG 格式，简化处理
        // 实际应用中应该解码图像
        if image_data.is_empty() {
            return 0.0;
        }

        // 简单采样
        let mut sum = 0u32;
        let count = (image_data.len() / 3).min(1000);

        for i in 0..count {
            sum += image_data[i] as u32;
        }

        (sum as f32 / count as f32) / 255.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MotionScore {
    timestamp: f64,
    motion_score: f32,
}
