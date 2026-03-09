// 音频处理模块

use wasm_bindgen::prelude::*;

/// 音频提取器 - WASM 辅助函数
/// 实际的音频提取在 JS 端通过 Web Audio API 完成
#[wasm_bindgen]
pub struct AudioProcessor {
    sample_rate: u32,
    channels: u32,
}

#[wasm_bindgen]
impl AudioProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: u32, channels: u32) -> Self {
        Self {
            sample_rate,
            channels,
        }
    }

    /// 重采样音频数据到 16kHz (Whisper 要求的采样率)
    #[wasm_bindgen]
    pub fn resample_to_16khz(&self, audio_data: &[f32]) -> Vec<f32> {
        if self.sample_rate == 16000 {
            return audio_data.to_vec();
        }

        let ratio = self.sample_rate as f64 / 16000.0;
        let output_length = (audio_data.len() as f64 / ratio) as usize;
        let mut resampled = Vec::with_capacity(output_length);

        for i in 0..output_length {
            let src_idx = (i as f64 * ratio) as usize;
            if src_idx < audio_data.len() {
                resampled.push(audio_data[src_idx]);
            }
        }

        resampled
    }

    /// 将音频数据转换为 16-bit PCM 格式
    #[wasm_bindgen]
    pub fn to_pcm16(&self, audio_data: &[f32]) -> Vec<u8> {
        let mut pcm = Vec::with_capacity(audio_data.len() * 2);

        for &sample in audio_data {
            // 限制范围并转换
            let clamped = sample.max(-1.0).min(1.0);
            let pcm_sample = (clamped * 32767.0) as i16;
            pcm.extend_from_slice(&pcm_sample.to_le_bytes());
        }

        pcm
    }

    /// 计算音频能量（用于静音检测）
    #[wasm_bindgen]
    pub fn calculate_energy(&self, audio_data: &[f32], window_size: usize) -> Vec<f32> {
        let mut energies = Vec::new();

        for chunk in audio_data.chunks(window_size) {
            let energy: f32 = chunk.iter().map(|&x| x * x).sum::<f32>() / chunk.len() as f32;
            energies.push(energy.sqrt());
        }

        energies
    }
}
