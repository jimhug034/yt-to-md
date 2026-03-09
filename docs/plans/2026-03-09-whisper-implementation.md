# Whisper 语音识别功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans 来实现此计划。

**目标:** 在浏览器中实现基于 Rust WASM 的 Whisper 语音识别功能，支持本地视频和 YouTube 视频的实时转录。

**架构:** Rust WASM (whisper.cpp) + Web Worker + React Hook，实时流式输出到 UI

**Tech Stack:** Rust + whisper.rs, Next.js, wasm-bindgen, @xenova/transformers (备用方案)

---

## Task 1: Rust WASM 模块基础结构

**Files:**
- Create: `wasm/src/speech/mod.rs`
- Create: `wasm/src/speech/types.rs`
- Modify: `wasm/src/lib.rs`

**Step 1: 创建 speech/mod.rs**

```rust
// 语音识别模块
pub mod whisper;
pub mod audio_processor;
pub mod result_parser;
pub mod types;

pub use whisper::WhisperEngine;
pub use audio_processor::AudioProcessor;
pub use result_parser::TranscriptionResult;
```

**Step 2: 创建 speech/types.rs**

```rust
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Segment {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub segments: Vec<Segment>,
    pub language_detected: String,
    pub processing_time_ms: u64,
}

#[wasm_bindgen]
pub enum WhisperLanguage {
    Auto,
    Zh,
    En,
    Ja,
    Ko,
}
```

**Step 3: 更新 wasm/src/lib.rs 导出**

在 `wasm/src/lib.rs` 的 `mod` 部分添加：
```rust
mod speech;
```

在导出部分添加：
```rust
pub use speech::{WhisperEngine, AudioProcessor, TranscriptionResult, WhisperLanguage, Segment};
```

**Step 4: 运行 cargo check 验证**

Run: `cargo check`
Expected: 编译成功，无错误

**Step 5: 提交**

```bash
git add wasm/src/speech/ wasm/src/lib.rs
git commit -m "feat(speech): add Rust WASM speech module structure"
```

---

## Task 2: 音频预处理模块

**Files:**
- Create: `wasm/src/speech/audio_processor.rs`

**Step 1: 编写 audio_processor.rs**

```rust
use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

#[wasm_bindgen]
pub struct AudioProcessor {
    pub sample_rate: u32,
    pub channels: u32,
}

#[wasm_bindgen]
impl AudioProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: u32, channels: u32) -> Self {
        Self { sample_rate, channels }
    }

    /// 重采样音频到 16kHz (Whisper 要求)
    #[wasm_bindgen]
    pub fn resample_to_16k(&self, audio_data: Float32Array) -> Float32Array {
        let data = audio_data.to_vec();
        let ratio = 16000.0 / self.sample_rate as f64;
        let new_length = (data.len() as f64 * ratio) as usize;

        let mut resampled = vec![0.0f32; new_length];

        for i in 0..new_length {
            let src_idx = (i as f64 / ratio) as usize;
            resampled[i] = data[src_idx.min(data.len() - 1)];
        }

        Float32Array::from(&resampled[..])
    }

    /// 转换为单声道
    #[wasm_bindgen]
    pub fn to_mono(&self, audio_data: Float32Array) -> Float32Array {
        let data = audio_data.to_vec();
        let channels = self.channels as usize;

        if channels == 1 {
            return audio_data;
        }

        let mut mono = vec![0.0f32; data.len() / channels];

        for (i, sample) in data.iter().enumerate() {
            mono[i / channels] += sample / channels as f32;
        }

        Float32Array::from(&mono[..])
    }

    /// 分块处理长音频
    #[wasm_bindgen]
    pub fn chunk_audio(&self, audio_data: Float32Array, chunk_duration_sec: f32) -> Vec<Float32Array> {
        let data = audio_data.to_vec();
        let samples_per_chunk = (chunk_duration_sec * 16000.0) as usize;
        let overlap = 1600; // 0.1秒重叠

        let mut chunks = Vec::new();
        let mut offset = 0;

        while offset < data.len() {
            let end = (offset + samples_per_chunk).min(data.len());
            chunks.push(Float32Array::from(&data[offset..end]));
            offset = end - overlap;
        }

        chunks
    }
}
```

**Step 2: 添加测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resample() {
        let processor = AudioProcessor::new(48000, 2);
        // 测试重采样逻辑
    }

    #[test]
    fn test_to_mono() {
        let processor = AudioProcessor::new(44100, 2);
        // 测试转单声道
    }
}
```

**Step 3: 运行测试**

Run: `cargo test --lib speech::audio_processor::tests`
Expected: 测试编译通过

**Step 4: 提交**

```bash
git add wasm/src/speech/audio_processor.rs
git commit -m "feat(speech): add audio processor module"
```

---

## Task 3: Whisper 引擎封装

**Files:**
- Create: `wasm/src/speech/whisper.rs`
- Modify: `wasm/Cargo.toml`

**Step 1: 更新 Cargo.toml 添加依赖**

```toml
[dependencies]
# 现有依赖保持不变...

# Whisper 相关 - 使用 @xenova/transformers JS 绑定方案
# 纯 Rust 方案依赖 C 库，在 WASM 中支持有限
# 因此我们使用 Rust 封装 + JS 模型的方式
```

**Step 2: 创建 whisper.rs**

```rust
use wasm_bindgen::prelude::*;
use js_sys::{Promise, Function};
use crate::speech::{Segment, TranscriptionResult, WhisperLanguage};
use crate::speech::audio_processor::AudioProcessor;

#[wasm_bindgen]
pub struct WhisperEngine {
    model_loaded: bool,
    audio_processor: Option<AudioProcessor>,
    language: WhisperLanguage,
    progress_callback: Option<Function>,
}

#[wasm_bindgen]
impl WhisperEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            model_loaded: false,
            audio_processor: None,
            language: WhisperLanguage::Auto,
            progress_callback: None,
        }
    }

    /// 设置语言
    #[wasm_bindgen]
    pub fn set_language(&mut self, language: WhisperLanguage) {
        self.language = language;
    }

    /// 设置进度回调
    #[wasm_bindgen]
    pub fn set_progress_callback(&mut self, callback: Function) {
        self.progress_callback = Some(callback);
    }

    /// 检查模型是否已加载
    #[wasm_bindgen]
    pub fn is_model_loaded(&self) -> bool {
        self.model_loaded
    }

    /// 初始化音频处理器
    #[wasm_bindgen]
    pub fn init_audio_processor(&mut self, sample_rate: u32, channels: u32) {
        self.audio_processor = Some(AudioProcessor::new(sample_rate, channels));
    }

    /// 处理音频数据并返回转录结果
    /// 注意：实际的 Whisper 模型执行在 JS 端通过 @xenova/transformers 完成
    /// Rust 端负责音频预处理和结果解析
    #[wasm_bindgen]
    pub fn process_audio(&mut self, audio_data: Float32Array) -> Result<String, JsValue> {
        if !self.model_loaded {
            return Err(JsValue::from_str("Model not loaded"));
        }

        // 预处理音频
        if let Some(processor) = &self.audio_processor {
            let mono = processor.to_mono(audio_data);
            // 这里返回处理后的音频数据，实际识别在 JS 端完成
            return Ok("Audio processed successfully".to_string());
        }

        Err(JsValue::from_str("Audio processor not initialized"))
    }

    /// 解析转录结果
    #[wasm_bindgen]
    pub fn parse_result(&self, result_json: &str) -> String {
        let result: serde_json::Value = serde_json::from_str(result_json)
            .unwrap_or_else(|_| serde_json::json!([]));

        let segments: Vec<Segment> = if let Some(chunks) = result["chunks"].as_array() {
            chunks.iter().filter_map(|chunk| {
                chunk["text"].as_str().map(|text| {
                    let timestamps = chunk["timestamp"].as_array();
                    let (start, end) = if let Some(ts) = timestamps {
                        (ts[0].as_f64().unwrap_or(0.0), ts[1].as_f64().unwrap_or(0.0))
                    } else {
                        (0.0, 0.0)
                    };

                    Segment {
                        id: crypto_random_uuid(),
                        start_time: start,
                        end_time: end,
                        text: text.trim().to_string(),
                        confidence: 0.9,
                    }
                })
            }).collect()
        } else {
            Vec::new()
        };

        serde_json::to_string(&segments).unwrap_or_default()
    }

    /// 取消当前识别
    #[wasm_bindgen]
    pub fn cancel(&mut self) {
        // 设置取消标志
    }
}

fn crypto_random_uuid() -> String {
    // 简单的 UUID 生成
    format!(
        "{:08x}-{:04x}-4{:04x}-{:04x}-{:012x}",
        js_sys::Math::random() as u32,
        (js_sys::Math::random() as u32) & 0xFFFF,
        (js_sys::Math::random() as u32) & 0xFFFF,
        (js_sys::Math::random() as u32) & 0xFFFF,
        js_sys::Math::random() as u64 & 0xFFFFFFFFFFFF
    )
}
```

**Step 3: 运行 cargo check**

Run: `cargo check`
Expected: 编译成功

**Step 4: 提交**

```bash
git add wasm/src/speech/whisper.rs wasm/Cargo.toml
git commit -m "feat(speech): add Whisper engine wrapper"
```

---

## Task 4: 编译 WASM 模块

**Files:**
- Build: `wasm/pkg/` directory

**Step 1: 编译 Rust WASM**

Run: `wasm-pack build --target web --out-dir ../app/lib/pkg`
Expected: 编译成功，生成 pkg 目录

**Step 2: 验证生成的文件**

Run: `ls ../app/lib/pkg/yt_subtitle_wasm*`
Expected: 看到 .wasm, .js, .d.ts 文件

**Step 3: 提交**

```bash
git add wasm/pkg/ app/lib/pkg/
git commit -m "build: compile Whisper WASM module"
```

---

## Task 5: 创建 Whisper Web Worker

**Files:**
- Create: `app/workers/whisper.worker.ts`
- Modify: `app/workers/index.ts`

**Step 1: 编写 whisper.worker.ts**

```typescript
import initWasm, { WhisperEngine, WhisperLanguage } from '@/app/lib/pkg';
import { pipeline } from '@xenova/transformers';

// 禁用本地模型检查
import { env } from '@xenova/transformers';
env.allowLocalModels = false;
env.allowRemoteModels = true;

let transcriber: any = null;
let wasmEngine: WhisperEngine | null = null;
let isCancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'loadModel':
        await handleLoadModel(data);
        break;
      case 'transcribe':
        await handleTranscribe(data);
        break;
      case 'cancel':
        handleCancel();
        break;
      case 'getStatus':
        postMessage({ type: 'status', loaded: transcriber !== null });
        break;
    }
  } catch (error) {
    postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

async function handleLoadModel(data: { model: string }) {
  postMessage({ type: 'progress', stage: 'loading', progress: 0 });

  try {
    // 初始化 Rust WASM
    await initWasm();
    wasmEngine = new WhisperEngine();
    wasmEngine.set_language(WhisperLanguage.Auto);

    // 加载 Transformers Whisper 模型
    const modelName = `Xenova/whisper-${data.model}`;
    transcriber = await pipeline('automatic-speech-recognition', modelName, {
      progress_callback: (progress: any) => {
        if (progress.status === 'downloading') {
          const percent = progress.progress ? Math.round(progress.progress) : 0;
          postMessage({
            type: 'progress',
            stage: 'downloading',
            progress: Math.min(percent, 95)
          });
        } else if (progress.status === 'loading') {
          postMessage({ type: 'progress', stage: 'loading', progress: 98 });
        }
      },
    });

    postMessage({ type: 'progress', stage: 'ready', progress: 100 });
  } catch (error) {
    postMessage({
      type: 'error',
      error: `Failed to load model: ${error}`
    });
  }
}

async function handleTranscribe(data: { audioData: Float32Array; language?: string }) {
  if (!transcriber) {
    throw new Error('Model not loaded');
  }

  isCancelled = false;

  try {
    const options: any = {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: data.language === 'auto' ? null : data.language,
      task: 'transcribe',
      return_timestamps: true,
    };

    const result = await transcriber(data.audioData, options);

    if (isCancelled) {
      postMessage({ type: 'cancelled' });
      return;
    }

    // 解析结果
    const segments = parseWhisperResult(result);

    postMessage({
      type: 'complete',
      result: segments
    });
  } catch (error) {
    if (isCancelled) return;
    throw error;
  }
}

function handleCancel() {
  isCancelled = true;
}

function parseWhisperResult(result: any): any[] {
  if (!result || !result.chunks) {
    return [];
  }

  return result.chunks
    .filter((chunk: any) => chunk.text && chunk.text.trim())
    .map((chunk: any, index: number) => ({
      id: crypto.randomUUID(),
      start: chunk.timestamp[0] || 0,
      end: chunk.timestamp[1] || 0,
      text: chunk.text.trim(),
      confidence: 0.9,
    }));
}
```

**Step 2: 更新 workers/index.ts 添加导出**

```typescript
export { default as createWhisperWorker } from './whisper.worker';
```

**Step 3: 运行 TypeScript 检查**

Run: `npx tsc --noEmit app/workers/whisper.worker.ts`
Expected: 无错误

**Step 4: 提交**

```bash
git add app/workers/whisper.worker.ts app/workers/index.ts
git commit -m "feat(workers): add Whisper transcription worker"
```

---

## Task 6: 创建 Whisper 管理器

**Files:**
- Create: `app/lib/speech/whisper-manager.ts`
- Create: `app/lib/speech/index.ts`

**Step 1: 编写 whisper-manager.ts**

```typescript
import type { WhisperSegment } from '@/app/lib/wasm';

export interface WhisperConfig {
  model: 'tiny' | 'base' | 'small';
  language: 'zh' | 'en' | 'ja' | 'ko' | 'auto';
}

export interface TranscribeProgress {
  stage: 'loading' | 'downloading' | 'processing' | 'complete' | 'error' | 'cancelled';
  progress: number;
  message?: string;
  segment?: WhisperSegment;
}

type ProgressCallback = (progress: TranscribeProgress) => void;

export class WhisperManager {
  private worker: Worker | null = null;
  private modelLoaded: boolean = false;
  private currentConfig: WhisperConfig | null = null;

  async initialize(onProgress?: ProgressCallback): Promise<void> {
    if (this.worker) {
      return; // 已初始化
    }

    this.worker = new Worker(
      new URL('./whisper.worker', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e) => {
      const { type, ...data } = e.data;
      onProgress?.(this.mapWorkerMessage(type, data));
    };

    this.worker.onerror = (error) => {
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: `Worker error: ${error}`,
      });
    };
  }

  async loadModel(config: WhisperConfig, onProgress?: ProgressCallback): Promise<void> {
    if (!this.worker) {
      await this.initialize(onProgress);
    }

    if (this.modelLoaded && this.currentConfig?.model === config.model) {
      return;
    }

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'progress') {
          onProgress?.(e.data);
        } else if (e.data.type === 'ready') {
          this.modelLoaded = true;
          this.currentConfig = config;
          resolve();
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.error));
        }
      };

      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage({
        type: 'loadModel',
        data: { model: config.model },
      });

      // 清理监听器
      setTimeout(() => {
        this.worker!.removeEventListener('message', handler);
      }, 30000);
    });
  }

  async transcribe(
    audioBuffer: AudioBuffer,
    onProgress?: ProgressCallback
  ): Promise<WhisperSegment[]> {
    if (!this.worker || !this.modelLoaded) {
      throw new Error('Whisper not initialized. Call loadModel() first.');
    }

    // 准备音频数据
    const audioData = await this.prepareAudio(audioBuffer);

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'segment' || e.data.type === 'complete') {
          if (e.data.type === 'complete') {
            resolve(e.data.result);
            this.worker!.removeEventListener('message', handler);
          } else if (e.data.type === 'error') {
            reject(new Error(e.data.error));
            this.worker!.removeEventListener('message', handler);
          }
        }
      };

      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage({
        type: 'transcribe',
        data: {
          audioData,
          language: this.currentConfig?.language || 'auto',
        },
      });
    });
  }

  cancel(): void {
    this.worker?.postMessage({ type: 'cancel' });
  }

  private async prepareAudio(audioBuffer: AudioBuffer): Promise<Float32Array> {
    const TARGET_SAMPLE_RATE = 16000;

    // 重采样到 16kHz
    let processed = audioBuffer;
    if (audioBuffer.sampleRate !== TARGET_SAMPLE_RATE) {
      const offlineContext = new OfflineAudioContext(
        1,
        audioBuffer.length * TARGET_SAMPLE_RATE / audioBuffer.sampleRate,
        TARGET_SAMPLE_RATE
      );
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      processed = await offlineContext.startRendering();
    }

    // 转为单声道 Float32Array
    const channelData = processed.getChannelData(0);
    return new Float32Array(channelData.buffer);
  }

  private mapWorkerMessage(type: string, data: any): TranscribeProgress {
    switch (type) {
      case 'progress':
        return {
          stage: data.stage,
          progress: data.progress,
          message: data.message || '',
        };
      case 'segment':
        return {
          stage: 'processing',
          progress: 50,
          segment: data.segment,
        };
      case 'complete':
        return {
          stage: 'complete',
          progress: 100,
        };
      case 'error':
        return {
          stage: 'error',
          progress: 0,
          message: data.error,
        };
      case 'cancelled':
        return {
          stage: 'cancelled',
          progress: 0,
        };
      default:
        return { stage: 'loading', progress: 0 };
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.modelLoaded = false;
  }
}
```

**Step 2: 创建 speech/index.ts**

```typescript
export { WhisperManager } from './whisper-manager';
export type { WhisperConfig, TranscribeProgress };
```

**Step 3: TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 4: 提交**

```bash
git add app/lib/speech/
git commit -m "feat(speech): add Whisper manager"
```

---

## Task 7: 创建 React Hook

**Files:**
- Create: `app/hooks/useWhisperTranscription.ts`
- Modify: `app/hooks/index.ts`

**Step 1: 编写 useWhisperTranscription.ts**

```typescript
import { useState, useCallback, useRef } from 'react';
import { WhisperManager, WhisperConfig, TranscribeProgress } from '@/app/lib/speech';
import type { WhisperSegment } from '@/app/lib/wasm';

export function useWhisperTranscription() {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'processing' | 'complete' | 'error' | 'cancelled'
  >('idle');
  const [segments, setSegments] = useState<WhisperSegment[]>([]);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<WhisperManager | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadModel = useCallback(async (config: WhisperConfig) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    try {
      setStatus('loading');
      setProgress(0);
      setError(null);

      if (!managerRef.current) {
        const manager = new WhisperManager();
        await manager.initialize((progress) => {
          if (signal.aborted) return;
          setProgress(progress.progress);
          setMessage(progress.message || '');
          if (progress.stage === 'loading') {
            setStatus('loading');
          }
        });
        managerRef.current = manager;
      }

      await managerRef.current.loadModel(config, (progress) => {
        if (signal.aborted) return;
        handleProgress(progress);
      });

      if (!signal.aborted) {
        setStatus('idle');
        setMessage('模型加载完成');
      }
    } catch (err) {
      if (signal.aborted) {
        setStatus('cancelled');
      } else {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  }, []);

  const transcribe = useCallback(
    async (audioBuffer: AudioBuffer) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        setStatus('processing');
        setSegments([]);
        setProgress(0);
        setError(null);

        if (!managerRef.current) {
          throw new Error('Manager not initialized');
        }

        const results = await managerRef.current.transcribe(
          audioBuffer,
          (progress) => {
            if (signal.aborted) return;
            handleProgress(progress);
            if (progress.segment) {
              setSegments((prev) => [...prev, progress.segment]);
            }
          }
        );

        if (!signal.aborted) {
          setSegments(results);
          setStatus('complete');
          setProgress(100);
          setMessage('转录完成');
        }
      } catch (err) {
        if (signal.aborted) {
          setStatus('cancelled');
        } else {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    },
    []
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    managerRef.current?.cancel();
    setStatus('cancelled');
  }, []);

  const reset = useCallback(() => {
    cancel();
    setSegments([]);
    setProgress(0);
    setMessage('');
    setError(null);
    setStatus('idle');
  }, [cancel]);

  const handleProgress = (progress: TranscribeProgress) => {
    setProgress(progress.progress);
    setMessage(progress.message || '');
  };

  return {
    status,
    segments,
    progress,
    message,
    error,
    loadModel,
    transcribe,
    cancel,
    reset,
  };
}
```

**Step 2: 更新 hooks/index.ts**

```typescript
export { useWhisperTranscription } from './useWhisperTranscription';
```

**Step 3: TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 4: 提交**

```bash
git add app/hooks/useWhisperTranscription.ts app/hooks/index.ts
git commit -m "feat(hooks): add useWhisperTranscription hook"
```

---

## Task 8: 集成到 VideoProcessor

**Files:**
- Modify: `app/components/video/VideoProcessor.tsx`

**Step 1: 在 VideoProcessor 中添加 Whisper 支持**

在 `VideoProcessor.tsx` 中添加导入：
```typescript
import { useWhisperTranscription } from '@/app/hooks/useWhisperTranscription';
import type { TranscriptSegment } from '@/app/lib/wasm';
```

在 `processVideoPipeline` 函数中添加 Whisper 转录步骤：
```typescript
// 在 extractKeyFrames 之后添加
// Step 3: Transcribe audio using Whisper
updateProgress('transcribing', 60);
const whisperSegments = await transcribeAudio(job, videoElement, signal);
if (signal.aborted) return;

// 保存转录结果到数据库
for (const segment of whisperSegments) {
  // 保存到 SQLite3
}
```

添加辅助函数：
```typescript
const transcribeAudio = async (
  job: VideoJob,
  videoElement: HTMLVideoElement,
  signal: AbortSignal
): Promise<TranscriptSegment[]> => {
  // 提取音频
  const audioBuffer = await audioExtractor.extractAudio(videoElement);

  // 转录
  const segments = await whisper.transcribe(audioBuffer);
  return segments.map(s => ({
    ...s,
    job_id: job.id,
  }));
};
```

**Step 2: TypeScript 检查**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: 提交**

```bash
git add app/components/video/VideoProcessor.tsx
git commit -m "feat(video): integrate Whisper transcription into VideoProcessor"
```

---

## Task 9: 添加单元测试

**Files:**
- Create: `app/lib/speech/__tests__/whisper-manager.test.ts`

**Step 1: 编写测试**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WhisperManager', () => {
  let manager: any;

  beforeEach(() => {
    // Mock Worker
    global.Worker = vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage: vi.fn(),
      terminate: vi.fn(),
    }));
  });

  it('should initialize successfully', async () => {
    const { WhisperManager } = await import('../whisper-manager');
    manager = new WhisperManager();
    await manager.initialize();
    expect(manager).toBeDefined();
  });

  it('should handle progress callbacks', async () => {
    const { WhisperManager } = await import('../whisper-manager');
    manager = new WhisperManager();

    const progressCallback = vi.fn();
    await manager.initialize(progressCallback);

    // 模拟进度消息
    // ... 测试代码
  });
});
```

**Step 2: 运行测试**

Run: `npm test -- app/lib/speech/__tests__/whisper-manager.test.ts`
Expected: 测试通过

**Step 3: 提交**

```bash
git add app/lib/speech/__tests__/
git commit -m "test(speech): add WhisperManager unit tests"
```

---

## Task 10: 添加 E2E 测试

**Files:**
- Create: `e2e/whisper-transcription.spec.ts`

**Step 1: 编写 E2E 测试**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Whisper Transcription', () => {
  test('should transcribe uploaded video', async ({ page }) => {
    await page.goto('/video');

    // 上传测试视频
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test/fixtures/sample-video.mp4');

    // 等待处理完成
    await expect(page.locator('[data-status="complete"]')).toBeVisible();

    // 验证转录结果
    await expect(page.locator('.transcript-segment')).toHaveCount(10);
  });

  test('should handle model loading progress', async ({ page }) => {
    await page.goto('/video');

    // 上传视频
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test/fixtures/sample-video.mp4');

    // 验证进度显示
    await expect(page.locator('[data-stage="downloading"]')).toBeVisible();
    await expect(page.locator('[data-stage="ready"]')).toBeVisible();
  });

  test('should support cancellation', async ({ page }) => {
    await page.goto('/video');

    // 上传视频
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test/fixtures/long-video.mp4');

    // 等待处理开始
    await page.waitForTimeout(1000);

    // 点击取消
    await page.click('[data-action="cancel"]');

    // 验证取消状态
    await expect(page.locator('[data-status="cancelled"]')).toBeVisible();
  });
});
```

**Step 2: 运行 E2E 测试**

Run: `npm run test:e2e e2e/whisper-transcription.spec.ts`
Expected: 测试通过

**Step 3: 提交**

```bash
git add e2e/whisper-transcription.spec.ts
git commit -m "test(e2e): add Whisper transcription E2E tests"
```

---

## 验收标准

- [ ] Whisper Small 模型成功加载
- [ ] 支持本地视频转录
- [ ] 支持 YouTube 视频转录
- [ ] 实时显示转录结果
- [ ] 结果保存到 SQLite3
- [ ] 支持取消操作
- [ ] 错误处理和重试机制正常工作
- [ ] 单元测试覆盖率 > 70%
- [ ] E2E 测试通过

---

**预计完成时间:** 4.5 - 6.5 天
