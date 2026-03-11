# 视频转 PPT/笔记系统 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建浏览器本地运行的视频处理应用，支持视频转字幕/PPT，使用 Rust WASM + Whisper + PaddleOCR

**架构:** Next.js 前端 + Rust WASM 核心引擎 + Web Workers 并行处理 + SQLite3 WASM 数据持久化

**Tech Stack:** Rust, wasm-bindgen, whisper.cpp WASM, PaddleOCR WASM, rusqlite, Next.js, React

---

## 目录

1. [Phase 1: Rust WASM 基础设施](#phase-1-rust-wasm-基础设施)
2. [Phase 2: SQLite 数据库层](#phase-2-sqlite-数据库层)
3. [Phase 3: 前端视频处理基础](#phase-3-前端视频处理基础)
4. [Phase 4: Whisper 语音识别](#phase-4-whisper-语音识别)
5. [Phase 5: 帧提取与 OCR](#phase-5-帧提取与-ocr)
6. [Phase 6: 内容结构化](#phase-6-内容结构化)
7. [Phase 7: PPTX 生成](#phase-7-pptx-生成)
8. [Phase 8: 前端 UI 集成](#phase-8-前端-ui-集成)

---

## Phase 1: Rust WASM 基础设施

### Task 1.1: 更新 Cargo.toml 依赖

**Files:**

- Modify: `wasm/Cargo.toml`

**Step 1: 添加新依赖**

打开 `wasm/Cargo.toml`，在 `[dependencies]` 部分添加：

```toml
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
quick-xml = { version = "0.37", features = ["serialize"] }
js-sys = "0.3"

# 新增依赖
wasm-bindgen-futures = "0.4"

# Web API 绑定
[dependencies.web-sys]
version = "0.3"
features = [
    "HtmlVideoElement",
    "HtmlCanvasElement",
    "CanvasRenderingContext2d",
    "AudioContext",
    "AudioBuffer",
    "Blob",
    "Url",
    "Window",
]

# 数据库 (WASM 版本)
rusqlite = { version = "0.32", features = ["bundled"] }

# PPTX 生成
zip = { version = "2.0", default-features = false, features = ["deflate"] }
xml-rs = "0.8"
```

**Step 2: 验证编译**

```bash
cd wasm
cargo check --target wasm32-unknown-unknown
```

**Step 3: 提交**

```bash
git add wasm/Cargo.toml
git commit -m "feat(wasm): add dependencies for video processing"
```

---

### Task 1.2: 创建模块结构

**Files:**

- Create: `wasm/src/database/mod.rs`
- Create: `wasm/src/video/mod.rs`
- Create: `wasm/src/audio/mod.rs`
- Create: `wasm/src/speech/mod.rs`
- Create: `wasm/src/frames/mod.rs`
- Create: `wasm/src/ocr/mod.rs`
- Create: `wasm/src/ai/mod.rs`
- Create: `wasm/src/output/mod.rs`
- Modify: `wasm/src/lib.rs`

**Step 1: 创建各模块的 mod.rs**

```bash
# 创建模块文件
touch wasm/src/database/mod.rs
touch wasm/src/video/mod.rs
touch wasm/src/audio/mod.rs
touch wasm/src/speech/mod.rs
touch wasm/src/frames/mod.rs
touch wasm/src/ocr/mod.rs
touch wasm/src/ai/mod.rs
touch wasm/src/output/mod.rs
```

**Step 2: 更新 lib.rs 导入新模块**

在 `wasm/src/lib.rs` 顶部添加模块声明：

```rust
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

// 现有模块
mod parser;
mod processor;

// 新增模块
mod database;
mod video;
mod audio;
mod speech;
mod frames;
mod ocr;
mod ai;
mod output;

use parser::{
    markdown as markdown_parser, srt as srt_parser, ttml as ttml_parser, vtt as vtt_parser,
    Caption,
};

use processor::{get_stats, process_subtitles as process_subtitles_internal, ProcessorOptions};

// ... 现有代码保持不变 ...
```

**Step 3: 验证编译**

```bash
cd wasm
cargo check --target wasm32-unknown-unknown
```

**Step 4: 提交**

```bash
git add wasm/src/
git commit -m "feat(wasm): add module structure for video processing"
```

---

## Phase 2: SQLite 数据库层

### Task 2.1: 创建数据库 Schema

**Files:**

- Create: `wasm/src/database/schema.rs`

**Step 1: 定义数据结构**

```rust
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// 作业状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum JobStatus {
    Pending = "pending",
    Processing = "processing",
    Completed = "completed",
    Error = "error",
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
    pub status: String,
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

/// 关键帧
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyFrame {
    pub id: String,
    pub job_id: String,
    pub timestamp: f64,
    pub image_data: Vec<u8>,
    pub ocr_text: Option<String>,
    pub chapter_id: Option<String>,
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

/// 创建表的 SQL
pub fn get_schema_sql() -> &'static str {
    r#"
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        source_url TEXT,
        file_name TEXT NOT NULL,
        duration REAL,
        width INTEGER,
        height INTEGER,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        options_json TEXT,
        error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS transcript_segments (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        text TEXT NOT NULL,
        confidence REAL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_segments_time ON transcript_segments(start_time);
    CREATE INDEX IF NOT EXISTS idx_segments_job ON transcript_segments(job_id);

    CREATE TABLE IF NOT EXISTS key_frames (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        timestamp REAL NOT NULL,
        image_data BLOB NOT NULL,
        ocr_text TEXT,
        chapter_id TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_frames_timestamp ON key_frames(timestamp);
    CREATE INDEX IF NOT EXISTS idx_frames_job ON key_frames(job_id);

    CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        title TEXT NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        summary TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chapters_job ON chapters(job_id);
    "#
}
```

**Step 2: 更新 database/mod.rs**

```rust
pub mod schema;

pub use schema::{
    Chapter, JobStatus, KeyFrame, TranscriptSegment, VideoJob,
};
```

**Step 3: 验证编译**

```bash
cd wasm
cargo check --target wasm32-unknown-unknown
```

**Step 4: 提交**

```bash
git add wasm/src/database/
git commit -m "feat(wasm): add database schema definitions"
```

---

### Task 2.2: 实现数据库连接

**Files:**

- Create: `wasm/src/database/connection.rs`

**Step 1: 实现数据库连接类**

```rust
use crate::database::schema::get_schema_sql;
use js_sys::Uint8Array;
use rusqlite::Connection;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::js_sys::Promise;
use web_sys::window;

/// 数据库连接包装器
#[wasm_bindgen]
pub struct Database {
    conn: Option<Connection>,
}

#[wasm_bindgen]
impl Database {
    /// 创建新的内存数据库
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<Database, JsValue> {
        let conn = Connection::open_in_memory()
            .map_err(|e| JsValue::from_str(&format!("Failed to create database: {}", e)))?;

        // 执行 schema
        conn.execute(get_schema_sql(), [])
            .map_err(|e| JsValue::from_str(&format!("Failed to create schema: {}", e)))?;

        Ok(Database {
            conn: Some(conn),
        })
    }

    /// 导出数据库为二进制数据
    #[wasm_bindgen]
    pub fn export(&self) -> Result<Uint8Array, JsValue> {
        // TODO: 实现 SQLite 备份导出
        // 这需要使用 rusqlite::backup::Backup
        Err(JsValue::from_str("Export not yet implemented"))
    }

    /// 导入数据库
    #[wasm_bindgen]
    pub fn import(&self, data: Uint8Array) -> Result<(), JsValue> {
        // TODO: 实现从备份导入
        Err(JsValue::from_str("Import not yet implemented"))
    }
}

impl Database {
    pub(crate) fn connection(&self) -> &Connection {
        self.conn.as_ref().expect("Connection not initialized")
    }
}
```

**Step 2: 更新 database/mod.rs**

```rust
pub mod connection;
pub mod schema;

pub use connection::Database;
pub use schema::{
    Chapter, JobStatus, KeyFrame, TranscriptSegment, VideoJob,
};
```

**Step 3: 验证编译**

```bash
cd wasm
cargo check --target wasm32-unknown-unknown
```

**Step 4: 提交**

```bash
git add wasm/src/database/connection.rs wasm/src/database/mod.rs
git commit -m "feat(wasm): implement database connection wrapper"
```

---

## Phase 3: 前端视频处理基础

### Task 3.1: 创建视频解码器

**Files:**

- Create: `app/lib/video/decoder.ts`
- Create: `app/lib/video/index.ts`

**Step 1: 实现视频解码器类**

```typescript
// app/lib/video/decoder.ts

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface VideoDecoderOptions {
  onProgress?: (progress: number) => void;
}

export class VideoDecoder {
  private videoElement: HTMLVideoElement | null = null;
  private metadata: VideoMetadata | null = null;

  /**
   * 从文件加载视频
   */
  async loadFromFile(file: File, options?: VideoDecoderOptions): Promise<VideoMetadata> {
    const url = URL.createObjectURL(file);
    try {
      return await this.loadFromUrl(url, options);
    } finally {
      // 不立即释放 URL，视频加载完成后再释放
    }
  }

  /**
   * 从 URL 加载视频
   */
  async loadFromUrl(url: string, options?: VideoDecoderOptions): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.preload = "metadata";

      video.addEventListener("loadedmetadata", () => {
        this.videoElement = video;
        this.metadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          hasAudio: Boolean(video.webkitAudioDecodedByteCount || true),
          hasVideo: video.videoWidth > 0 && video.videoHeight > 0,
        };
        resolve(this.metadata);
      });

      video.addEventListener("error", (e) => {
        reject(new Error(`Failed to load video: ${e}`));
      });

      video.src = url;
    });
  }

  /**
   * 提取指定时间戳的帧
   */
  async extractFrame(timestamp: number): Promise<Blob> {
    if (!this.videoElement) {
      throw new Error("Video not loaded");
    }

    const video = this.videoElement;
    video.currentTime = timestamp;

    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to capture frame"));
          }
        },
        "image/jpeg",
        0.85,
      );
    });
  }

  /**
   * 提取多个帧
   */
  async extractFrames(
    timestamps: number[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<Blob[]> {
    const frames: Blob[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const frame = await this.extractFrame(timestamps[i]);
      frames.push(frame);
      onProgress?.(i + 1, timestamps.length);
    }
    return frames;
  }

  /**
   * 获取视频元数据
   */
  getMetadata(): VideoMetadata | null {
    return this.metadata;
  }

  /**
   * 销毁解码器
   */
  destroy(): void {
    if (this.videoElement) {
      this.videoElement.src = "";
      this.videoElement.load();
      this.videoElement = null;
    }
    this.metadata = null;
  }
}
```

**Step 2: 创建导出文件**

```typescript
// app/lib/video/index.ts

export * from "./decoder";
```

**Step 3: 创建测试文件**

```typescript
// app/lib/video/decoder.test.ts

import { describe, it, expect, beforeEach, afterEach } from "@playwright/test";

describe("VideoDecoder", () => {
  let decoder: typeof import("./decoder").VideoDecoder;

  beforeEach(async () => {
    decoder = (await import("./decoder")).VideoDecoder;
  });

  it("should load video metadata", async () => {
    const instance = new decoder();
    // 需要一个测试视频文件
    // const metadata = await instance.loadFromFile(testVideoFile);
    // expect(metadata.duration).toBeGreaterThan(0);
  });
});
```

**Step 4: 提交**

```bash
git add app/lib/video/
git commit -m "feat: add video decoder class"
```

---

### Task 3.2: 创建音频提取器

**Files:**

- Create: `app/lib/video/audio-extractor.ts`

**Step 1: 实现音频提取器**

```typescript
// app/lib/video/audio-extractor.ts

export interface AudioExtractionOptions {
  sampleRate?: number; // 默认 16000 (Whisper 要求)
  channels?: number; // 默认 1 (单声道)
}

export class AudioExtractor {
  private audioContext: AudioContext | null = null;

  /**
   * 从视频元素提取音频
   */
  async extractFromVideo(
    videoElement: HTMLVideoElement,
    options: AudioExtractionOptions = {},
  ): Promise<AudioBuffer> {
    const { sampleRate = 16000, channels = 1 } = options;

    // 创建 AudioContext
    this.audioContext = new AudioContext({ sampleRate });

    // 创建媒体元素源
    const source = this.audioContext.createMediaElementSource(videoElement);

    // 创建目的地
    const destination = this.audioContext.createMediaStreamDestination();

    // 连接节点
    source.connect(destination);
    source.connect(this.audioContext.destination);

    // 播放视频并录制音频
    const stream = destination.stream;
    const mediaRecorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    return new Promise(async (resolve, reject) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);

        // 如果需要重采样
        const finalBuffer = this.resampleAudioBuffer(audioBuffer, sampleRate, channels);
        resolve(finalBuffer);
      };

      videoElement.currentTime = 0;
      await videoElement.play();

      mediaRecorder.start();

      videoElement.onended = () => {
        mediaRecorder.stop();
      };

      videoElement.onerror = (e) => {
        reject(new Error(`Video playback error: ${e}`));
      };
    });
  }

  /**
   * 重采样音频缓冲区
   */
  private resampleAudioBuffer(
    audioBuffer: AudioBuffer,
    targetSampleRate: number,
    targetChannels: number,
  ): AudioBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    if (sampleRate === targetSampleRate && numberOfChannels === targetChannels) {
      return audioBuffer;
    }

    // 创建新的音频缓冲区
    const ratio = sampleRate / targetSampleRate;
    const newLength = Math.round(length / ratio);
    const offlineContext = new OfflineAudioContext(targetChannels, newLength, targetSampleRate);

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    return offlineContext.startRendering();
  }

  /**
   * 将 AudioBuffer 转换为 WAV 格式
   */
  audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitDepth = 16;

    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);

    // WAV 文件头
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, length * numberOfChannels * 2, true);

    // 写入音频数据
    const channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return buffer;
  }

  /**
   * 销毁提取器
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
```

**Step 2: 更新导出**

```typescript
// app/lib/video/index.ts

export * from "./decoder";
export * from "./audio-extractor";
```

**Step 3: 提交**

```bash
git add app/lib/video/audio-extractor.ts app/lib/video/index.ts
git commit -m "feat: add audio extractor for Whisper"
```

---

## Phase 4: Whisper 语音识别

### Task 4.1: 创建 Whisper WASM 封装

**Files:**

- Create: `wasm/src/speech/whisper.rs`

**Step 1: 实现 Whisper 封装结构**

```rust
use crate::database::TranscriptSegment;
use js_sys::{Array, Promise, Uint8Array};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;

/// Whisper 模型类型
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[wasm_bindgen]
pub enum WhisperModel {
    Tiny = "tiny",
    Base = "base",
    Small = "small",
}

/// Whisper 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct WhisperConfig {
    pub model: String,
    pub language: String,
    pub task: String,  // "transcribe" or "translate"
}

impl Default for WhisperConfig {
    fn default() -> Self {
        Self {
            model: "base".to_string(),
            language: "auto".to_string(),
            task: "transcribe".to_string(),
        }
    }
}

/// Whisper 引擎
#[wasm_bindgen]
pub struct WhisperEngine {
    config: WhisperConfig,
    model_loaded: bool,
}

#[wasm_bindgen]
impl WhisperEngine {
    /// 创建新的 Whisper 引擎
    #[wasm_bindgen(constructor)]
    pub fn new(config: &str) -> Result<WhisperEngine, JsValue> {
        let config: WhisperConfig = serde_json::from_str(config)
            .unwrap_or_default();

        Ok(WhisperEngine {
            config,
            model_loaded: false,
        })
    }

    /// 加载 Whisper 模型
    #[wasm_bindgen]
    pub fn load_model(&mut self) -> Promise {
        let config = self.config.clone();

        future_to_promise(async move {
            // 这里需要实际的 Whisper WASM 集成
            // 目前返回模拟实现

            // TODO: 实际集成需要：
            // 1. 加载 whisper.cpp WASM 模块
            // 2. 加载模型权重文件
            // 3. 初始化 Whisper 上下文

            // 模拟延迟
            // js_sys::JsString::from("Model loaded")
            Ok(JsValue::from_str("Model loaded"))
        })
    }

    /// 转录音频数据
    #[wasm_bindgen]
    pub fn transcribe(&self, audio_data: Uint8Array) -> Promise {
        future_to_promise(async move {
            // TODO: 实际转录实现
            // 1. 将音频数据转换为 Whisper 格式
            // 2. 调用 Whisper 转录
            // 3. 解析结果为 TranscriptSegment

            let mock_segments = vec![
                TranscriptSegment {
                    id: "1".to_string(),
                    job_id: "test".to_string(),
                    start_time: 0.0,
                    end_time: 2.5,
                    text: "这是第一句话".to_string(),
                    confidence: 0.95,
                },
                TranscriptSegment {
                    id: "2".to_string(),
                    job_id: "test".to_string(),
                    start_time: 2.5,
                    end_time: 5.0,
                    text: "这是第二句话".to_string(),
                    confidence: 0.92,
                },
            ];

            let json = serde_json::to_string(&mock_segments)
                .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))?;

            Ok(JsValue::from_str(&json))
        })
    }

    /// 检查模型是否已加载
    #[wasm_bindgen]
    pub fn is_model_loaded(&self) -> bool {
        self.model_loaded
    }
}
```

**Step 2: 更新 speech/mod.rs**

```rust
pub mod whisper;

pub use whisper::{WhisperConfig, WhisperEngine, WhisperModel};
```

**Step 3: 验证编译**

```bash
cd wasm
cargo check --target wasm32-unknown-unknown
```

**Step 4: 提交**

```bash
git add wasm/src/speech/
git commit -m "feat(wasm): add Whisper WASM wrapper"
```

---

### Task 4.2: 创建前端 Whisper 处理器

**Files:**

- Create: `app/lib/models/whisper.ts`

**Step 1: 实现 Whisper 处理器**

```typescript
// app/lib/models/whisper.ts

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface WhisperConfig {
  model: "tiny" | "base" | "small";
  language: "zh" | "en" | "auto";
}

export interface WhisperProgress {
  stage: "loading_model" | "processing" | "completed";
  progress: number;
  segment?: WhisperSegment;
}

export class WhisperProcessor {
  private modelLoaded = false;
  private wasmModule: any = null;

  /**
   * 加载 Whisper WASM 模型
   */
  async loadModel(config: WhisperConfig, onProgress?: (progress: number) => void): Promise<void> {
    // TODO: 实际加载 Whisper WASM
    // 目前使用模拟实现

    if (this.modelLoaded) {
      return;
    }

    // 模拟加载进度
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      onProgress?.(i);
    }

    this.modelLoaded = true;
  }

  /**
   * 转录音频缓冲区
   */
  async transcribe(
    audioBuffer: AudioBuffer,
    onProgress?: (progress: WhisperProgress) => void,
  ): Promise<WhisperSegment[]> {
    if (!this.modelLoaded) {
      throw new Error("Model not loaded. Call loadModel() first.");
    }

    onProgress?.({ stage: "processing", progress: 0 });

    // TODO: 实际调用 Whisper WASM
    // 目前返回模拟数据

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mockSegments: WhisperSegment[] = [
      { start: 0.0, end: 2.5, text: "这是第一句话", confidence: 0.95 },
      { start: 2.5, end: 5.0, text: "这是第二句话", confidence: 0.92 },
      { start: 5.0, end: 8.0, text: "这是第三句话", confidence: 0.88 },
    ];

    onProgress?.({ stage: "completed", progress: 100 });

    return mockSegments;
  }

  /**
   * 检查模型是否已加载
   */
  isModelLoaded(): boolean {
    return this.modelLoaded;
  }
}
```

**Step 2: 创建导出文件**

```typescript
// app/lib/models/index.ts

export * from "./whisper";
```

**Step 3: 提交**

```bash
git add app/lib/models/
git commit -m "feat: add Whisper processor wrapper"
```

---

## Phase 5: 帧提取与 OCR

### Task 5.1: 实现帧提取器

**Files:**

- Create: `wasm/src/frames/extractor.rs`
- Create: `app/lib/video/frame-extractor.ts`

**Step 1: Rust 帧提取器**

```rust
// wasm/src/frames/extractor.rs

use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

/// 帧提取器
#[wasm_bindgen]
pub struct FrameExtractor {
    interval_ms: u32,
}

#[wasm_bindgen]
impl FrameExtractor {
    /// 创建新的帧提取器
    #[wasm_bindgen(constructor)]
    pub fn new(interval_ms: u32) -> Self {
        Self { interval_ms }
    }

    /// 计算需要提取的帧时间戳
    #[wasm_bindgen]
    pub fn calculate_timestamps(&self, duration_ms: f64) -> Vec<f64> {
        let mut timestamps = Vec::new();
        let mut current = 0.0;

        while current < duration_ms {
            timestamps.push(current);
            current += self.interval_ms as f64;
        }

        timestamps
    }

    /// 压缩图像数据为 JPEG
    #[wasm_bindgen]
    pub fn compress_frame(&self, rgba_data: Uint8Array, width: u32, height: u32) -> Uint8Array {
        // TODO: 实现 JPEG 压缩
        // 目前返回原始数据
        rgba_data
    }
}
```

**Step 2: 更新 frames/mod.rs**

```rust
pub mod extractor;

pub use extractor::FrameExtractor;
```

**Step 3: TypeScript 帧提取器**

```typescript
// app/lib/video/frame-extractor.ts

import type { VideoDecoder } from "./decoder";

export interface FrameExtractionOptions {
  interval?: number; // 毫秒，默认 5000
  quality?: number; // JPEG 质量 0-1，默认 0.85
  onFrame?: (timestamp: number, blob: Blob) => void;
  onProgress?: (current: number, total: number) => void;
}

export interface ExtractedFrame {
  timestamp: number;
  blob: Blob;
  url: string;
}

export class FrameExtractor {
  private decoder: VideoDecoder;
  private options: Required<FrameExtractionOptions>;

  constructor(decoder: VideoDecoder, options: FrameExtractionOptions = {}) {
    this.decoder = decoder;
    this.options = {
      interval: options.interval ?? 5000,
      quality: options.quality ?? 0.85,
      onFrame: options.onFrame ?? (() => {}),
      onProgress: options.onProgress ?? (() => {}),
    };
  }

  /**
   * 提取关键帧
   */
  async extractFrames(): Promise<ExtractedFrame[]> {
    const metadata = this.decoder.getMetadata();
    if (!metadata) {
      throw new Error("Video metadata not available");
    }

    const durationMs = metadata.duration * 1000;
    const timestamps: number[] = [];

    for (let t = 0; t < durationMs; t += this.options.interval) {
      timestamps.push(t / 1000);
    }

    const frames: ExtractedFrame[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const blob = await this.decoder.extractFrame(timestamp);
      const url = URL.createObjectURL(blob);

      const frame: ExtractedFrame = { timestamp, blob, url };
      frames.push(frame);

      this.options.onFrame(timestamp, blob);
      this.options.onProgress(i + 1, timestamps.length);
    }

    return frames;
  }

  /**
   * 清理资源
   */
  cleanup(frames: ExtractedFrame[]): void {
    for (const frame of frames) {
      URL.revokeObjectURL(frame.url);
    }
  }
}
```

**Step 4: 提交**

```bash
git add wasm/src/frames/ app/lib/video/frame-extractor.ts
git commit -m "feat: add frame extractor"
```

---

### Task 5.2: 实现 OCR 封装

**Files:**

- Create: `wasm/src/ocr/paddle.rs`
- Create: `app/lib/models/paddleocr.ts`

**Step 1: Rust OCR 封装**

```rust
// wasm/src/ocr/paddle.rs

use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;

/// OCR 引擎
#[wasm_bindgen]
pub struct OCREngine {
    model_loaded: bool,
}

#[wasm_bindgen]
impl OCREngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            model_loaded: false,
        }
    }

    /// 加载 OCR 模型
    #[wasm_bindgen]
    pub fn load_model(&mut self) -> Result<JsValue, JsValue> {
        // TODO: 实际加载 PaddleOCR WASM
        self.model_loaded = true;
        Ok(JsValue::from_str("Model loaded"))
    }

    /// 识别单张图片
    #[wasm_bindgen]
    pub fn recognize(&self, image_data: Uint8Array) -> Promise {
        future_to_promise(async move {
            // TODO: 实际 OCR 实现
            Ok(JsValue::from_str("识别的文本内容"))
        })
    }

    /// 批量识别
    #[wasm_bindgen]
    pub fn recognize_batch(&self, images: Vec<Uint8Array>) -> Promise {
        future_to_promise(async move {
            // TODO: 批量 OCR 实现
            let results: Vec<String> = images.iter().map(|_| "文本".to_string()).collect();
            let json = serde_json::to_string(&results).unwrap();
            Ok(JsValue::from_str(&json))
        })
    }
}
```

**Step 2: 更新 ocr/mod.rs**

```rust
pub mod paddle;

pub use paddle::OCREngine;
```

**Step 3: TypeScript OCR 处理器**

```typescript
// app/lib/models/paddleocr.ts

export interface OCRResult {
  text: string;
  confidence: number;
  bbox?: number[][];
}

export class PaddleOCRProcessor {
  private modelLoaded = false;

  async loadModel(onProgress?: (progress: number) => void): Promise<void> {
    if (this.modelLoaded) return;

    // TODO: 实际加载 PaddleOCR WASM
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      onProgress?.(i);
    }

    this.modelLoaded = true;
  }

  async recognize(imageBlob: Blob): Promise<OCRResult> {
    if (!this.modelLoaded) {
      throw new Error("Model not loaded");
    }

    // TODO: 实际 OCR
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      text: "示例文本",
      confidence: 0.95,
    };
  }

  async recognizeBatch(imageBlobs: Blob[]): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    for (const blob of imageBlobs) {
      const result = await this.recognize(blob);
      results.push(result);
    }
    return results;
  }
}
```

**Step 4: 更新导出**

```typescript
// app/lib/models/index.ts

export * from "./whisper";
export * from "./paddleocr";
```

**Step 5: 提交**

```bash
git add wasm/src/ocr/ app/lib/models/paddleocr.ts app/lib/models/index.ts
git commit -m "feat: add PaddleOCR wrapper"
```

---

## Phase 6: 内容结构化

### Task 6.1: 实现文本总结引擎

**Files:**

- Create: `wasm/src/ai/summarizer.rs`

**Step 1: 实现总结引擎**

```rust
// wasm/src/ai/summarizer.rs

use crate::database::TranscriptSegment;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// 文本总结选项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct SummaryOptions {
    pub remove_fillers: bool,
    pub merge_duplicates: bool,
    pub min_sentence_length: usize,
}

impl Default for SummaryOptions {
    fn default() -> Self {
        Self {
            remove_fillers: true,
            merge_duplicates: true,
            min_sentence_length: 5,
        }
    }
}

/// 文本总结引擎
#[wasm_bindgen]
pub struct TextSummarizer {
    options: SummaryOptions,
}

#[wasm_bindgen]
impl TextSummarizer {
    #[wasm_bindgen(constructor)]
    pub fn new(options: &str) -> Result<TextSummarizer, JsValue> {
        let options: SummaryOptions = serde_json::from_str(options)
            .unwrap_or_default();

        Ok(Self { options })
    }

    /// 处理字幕片段
    #[wasm_bindgen]
    pub fn process(&self, segments_json: &str) -> String {
        let segments: Vec<TranscriptSegment> = match serde_json::from_str(segments_json) {
            Ok(s) => s,
            Err(_) => return String::new(),
        };

        let processed = self.clean_text(&segments);
        serde_json::to_string(&processed).unwrap_or_default()
    }
}

impl TextSummarizer {
    fn clean_text(&self, segments: &[TranscriptSegment]) -> Vec<String> {
        let mut result = Vec::new();

        for segment in segments {
            let mut text = segment.text.clone();

            // 移除口语填充词
            if self.options.remove_fillers {
                text = self.remove_fillers(&text);
            }

            // 清理空格
            text = text.trim().to_string();

            // 过滤短句
            if text.chars().count() >= self.options.min_sentence_length {
                result.push(text);
            }
        }

        // 去重
        if self.options.merge_duplicates {
            result = self.remove_duplicates(result);
        }

        result
    }

    fn remove_fillers(&self, text: &str) -> String {
        let fillers = [
            "嗯", "啊", "噢", "呃", "额",
            "那个", "这个", "然后呢", "就是",
            "那就是", "对不对", "是不是", "好吧",
            "uh", "um", "ah", "like", "you know",
        ];

        let mut result = text.to_string();
        for filler in &fillers {
            result = result.replace(filler, " ");
        }

        // 移除多余空格
        while result.contains("  ") {
            result = result.replace("  ", " ");
        }

        result.trim().to_string()
    }

    fn remove_duplicates(&mut texts: Vec<String>) -> Vec<String> {
        let mut unique = Vec::new();
        let mut seen = Vec::new();

        for text in texts {
            let normalized = text.to_lowercase();
            let is_duplicate = seen.iter()
                .any(|s: &String| self.similarity(s, &normalized) > 0.85);

            if !is_duplicate {
                unique.push(text);
                seen.push(normalized);
            }
        }

        unique
    }

    fn similarity(&self, a: &str, b: &str) -> f64 {
        if a.is_empty() && b.is_empty() {
            return 1.0;
        }
        if a.is_empty() || b.is_empty() {
            return 0.0;
        }

        let a_chars: std::collections::HashSet<char> = a.chars().collect();
        let b_chars: std::collections::HashSet<char> = b.chars().collect();

        let intersection = a_chars.intersection(&b_chars).count();
        let union = a_chars.union(&b_chars).count();

        if union == 0 { 0.0 } else { intersection as f64 / union as f64 }
    }
}
```

**Step 2: 更新 ai/mod.rs**

```rust
pub mod summarizer;

pub use summarizer::{SummaryOptions, TextSummarizer};
```

**Step 3: 提交**

```bash
git add wasm/src/ai/
git commit -m "feat(wasm): add text summarizer"
```

---

### Task 6.2: 实现章节分割

**Files:**

- Create: `wasm/src/ai/chapterizer.rs`

**Step 1: 实现章节分割器**

```rust
// wasm/src/ai/chapterizer.rs

use crate::database::{Chapter, TranscriptSegment};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// 章节分割选项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct ChapterizeOptions {
    pub min_duration: f64,  // 最小章节时长（秒）
    pub gap_threshold: f64,  // 时间间隔阈值（秒）
}

impl Default for ChapterizeOptions {
    fn default() -> Self {
        Self {
            min_duration: 60.0,
            gap_threshold: 10.0,
        }
    }
}

/// 章节分割器
#[wasm_bindgen]
pub struct Chapterizer {
    options: ChapterizeOptions,
}

#[wasm_bindgen]
impl Chapterizer {
    #[wasm_bindgen(constructor)]
    pub fn new(options: &str) -> Result<Chapterizer, JsValue> {
        let options: ChapterizeOptions = serde_json::from_str(options)
            .unwrap_or_default();

        Ok(Self { options })
    }

    /// 分割章节
    #[wasm_bindgen]
    pub fn chapterize(&self, segments_json: &str, job_id: &str) -> String {
        let segments: Vec<TranscriptSegment> = match serde_json::from_str(segments_json) {
            Ok(s) => s,
            Err(_) => return String::new(),
        };

        let chapters = self.create_chapters(&segments, job_id);
        serde_json::to_string(&chapters).unwrap_or_default()
    }
}

impl Chapterizer {
    fn create_chapters(&self, segments: &[TranscriptSegment], job_id: &str) -> Vec<Chapter> {
        let mut chapters = Vec::new();
        let mut current_start = segments.first().map(|s| s.start_time).unwrap_or(0.0);
        let mut last_end = current_start;
        let mut chapter_texts: Vec<String> = Vec::new();

        for i in 0..segments.len() {
            let current = &segments[i];
            let next_time = segments.get(i + 1)
                .map(|s| s.start_time)
                .unwrap_or(current.end_time);

            // 检查时间间隔
            let gap = if i > 0 {
                current.start_time - segments[i - 1].end_time
            } else {
                0.0
            };

            // 检查是否应该分割新章节
            let should_split = gap > self.options.gap_threshold
                || (next_time - current_start >= self.options.min_duration && i == segments.len() - 1);

            chapter_texts.push(current.text.clone());

            if should_split && !chapter_texts.is_empty() {
                let title = self.generate_title(&chapter_texts);
                let summary = chapter_texts.join(" ");

                chapters.push(Chapter {
                    id: format!("chapter_{}", chapters.len()),
                    job_id: job_id.to_string(),
                    title,
                    start_time: current_start,
                    end_time: current.end_time,
                    summary,
                });

                current_start = next_time;
                chapter_texts.clear();
            }

            last_end = current.end_time;
        }

        // 处理最后一个章节
        if !chapter_texts.is_empty() {
            chapters.push(Chapter {
                id: format!("chapter_{}", chapters.len()),
                job_id: job_id.to_string(),
                title: "结尾".to_string(),
                start_time: current_start,
                end_time: last_end,
                summary: chapter_texts.join(" "),
            });
        }

        chapters
    }

    fn generate_title(&self, texts: &[String]) -> String {
        // 简单提取前几个关键词作为标题
        let combined = texts.join(" ");

        // 取前 10 个字符
        combined.chars()
            .take(10)
            .collect::<String>()
            .trim()
            .to_string()
    }
}
```

**Step 2: 更新 ai/mod.rs**

```rust
pub mod chapterizer;
pub mod summarizer;

pub use chapterizer::{ChapterizeOptions, Chapterizer};
pub use summarizer::{SummaryOptions, TextSummarizer};
```

**Step 3: 提交**

```bash
git add wasm/src/ai/chapterizer.rs wasm/src/ai/mod.rs
git commit -m "feat(wasm): add chapterizer"
```

---

## Phase 7: PPTX 生成

### Task 7.1: 实现 PPTX 生成器

**Files:**

- Create: `wasm/src/output/pptx.rs`

**Step 1: 实现 PPTX 生成器**

```rust
// wasm/src/output/pptx.rs

use crate::database::{Chapter, KeyFrame};
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Write};
use wasm_bindgen::prelude::*;
use xml::writer::{EventWriter, EmitterConfig, XmlEvent};

/// PPTX 生成选项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[wasm_bindgen]
pub struct PPTXOptions {
    pub title: String,
    pub author: String,
    pub include_frames: bool,
}

impl Default for PPTXOptions {
    fn default() -> Self {
        Self {
            title: "Video Presentation".to_string(),
            author: "Generated by AI".to_string(),
            include_frames: true,
        }
    }
}

/// PPTX 生成器
#[wasm_bindgen]
pub struct PPTXGenerator;

#[wasm_bindgen]
impl PPTXGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self
    }

    /// 生成 PPTX 文件
    #[wasm_bindgen]
    pub fn generate(
        &self,
        title: &str,
        chapters_json: &str,
        frames_json: &str,
        options: &str,
    ) -> Result<Vec<u8>, JsValue> {
        let chapters: Vec<Chapter> = serde_json::from_str(chapters_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid chapters: {}", e)))?;

        let frames: Vec<KeyFrame> = serde_json::from_str(frames_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid frames: {}", e)))?;

        let options: PPTXOptions = serde_json::from_str(options)
            .unwrap_or_default();

        self.create_pptx(&title, &chapters, &frames, &options)
    }
}

impl PPTXGenerator {
    fn create_pptx(
        &self,
        title: &str,
        chapters: &[Chapter],
        frames: &[KeyFrame],
        options: &PPTXOptions,
    ) -> Result<Vec<u8>, JsValue> {
        // PPTX 是一个 ZIP 文件
        let mut zip_buffer = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut zip_buffer);

            // 1. [Content_Types].xml
            let content_types = self.build_content_types();
            self.add_zip_entry(&mut zip, "[Content_Types].xml", &content_types)?;

            // 2. _rels/.rels
            let rels = self.build_root_rels();
            self.add_zip_entry(&mut zip, "_rels/.rels", &rels)?;

            // 3. ppt/presentation.xml
            let presentation = self.build_presentation_xml(chapters.len());
            self.add_zip_entry(&mut zip, "ppt/presentation.xml", &presentation)?;

            // 4. ppt/_rels/presentation.xml.rels
            let slide_rels = self.build_presentation_rels(chapters.len());
            self.add_zip_entry(&mut zip, "ppt/_rels/presentation.xml.rels", &slide_rels)?;

            // 5. 生成每个幻灯片
            for (i, chapter) in chapters.iter().enumerate() {
                let slide_num = i + 1;

                // 幻灯片内容
                let slide_content = self.build_slide_content(title, chapter, options);
                self.add_zip_entry(
                    &mut zip,
                    &format!("ppt/slides/slide{}.xml", slide_num),
                    &slide_content,
                )?;

                // 幻灯片关系
                let slide_rels = self.build_slide_rels(slide_num);
                self.add_zip_entry(
                    &mut zip,
                    &format!("ppt/slides/_rels/slide{}.xml.rels", slide_num),
                    &slide_rels,
                )?;
            }

            // 6. 幻灯片布局
            let layout = self.build_slide_layout();
            self.add_zip_entry(&mut zip, "ppt/slideLayouts/slideLayout1.xml", &layout)?;

            // 7. 幻灯片主样式
            let master = self.build_slide_master();
            self.add_zip_entry(&mut zip, "ppt/slideMasters/slideMaster1.xml", &master)?;

            // 8. 主题
            let theme = self.build_theme();
            self.add_zip_entry(&mut zip, "ppt/theme/theme1.xml", &theme)?;

            zip.finish()?;
        }

        Ok(zip_buffer.into_inner())
    }

    fn add_zip_entry<W: Write + std::io::Seek>(
        &self,
        zip: &mut zip::ZipWriter<W>,
        name: &str,
        content: &str,
    ) -> Result<(), JsValue> {
        zip.start_file(name, zip::write::FileOptions::default())
            .map_err(|e| JsValue::from_str(&format!("ZIP error: {}", e)))?;
        zip.write_all(content.as_bytes())
            .map_err(|e| JsValue::from_str(&format!("Write error: {}", e)))?;
        Ok(())
    }

    fn build_content_types(&self) -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-presentationml.presentation.main+xml"/>
    <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-presentationml.slideMaster+xml"/>
    <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-presentationml.slideLayout+xml"/>
    <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-presentationml.slide+xml"/>
    <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-presentationml.theme+xml"/>
</Types>"#.to_string()
    }

    fn build_root_rels(&self) -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"#.to_string()
    }

    fn build_presentation_xml(&self, slide_count: usize) -> String {
        let slide_ids: Vec<String> = (1..=slide_count)
            .map(|i| format!('<p:slideId id="{}" r:id="rId{}"/>', i * 256, i))
            .collect();

        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <p:slideIdLst>
        {}
    </p:slideIdLst>
</p:presentation>"#,
            slide_ids.join("\n        ")
        )
    }

    fn build_presentation_rels(&self, slide_count: usize) -> String {
        let rels: Vec<String> = (1..=slide_count)
            .map(|i| {
                format!(
                    r#"<Relationship Id="rId{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{}.xml"/>"#,
                    i, i
                )
            })
            .collect();

        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    {}
</Relationships>"#,
            rels.join("\n    ")
        )
    }

    fn build_slide_content(&self, title: &str, chapter: &Chapter, options: &PPTXOptions) -> String {
        let summary_text = self.escape_xml(&chapter.summary);
        let title_text = self.escape_xml(&chapter.title);

        format!(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:slide xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <p:spTree>
        <p:nvGrpSpPr>
            <p:cNvPr id="1" name=""/>
            <p:cNvGrpSpPr/>
            <p:nvPr/>
        </p:nvGrpSpPr>
        <p:grpSpPr>
            <a:xfrm>
                <a:off x="0" y="0"/>
                <a:ext cx="9144000" cy="6858000"/>
                <a:chOff x="0" y="0"/>
                <a:chExt cx="9144000" cy="6858000"/>
            </a:xfrm>
        </p:grpSpPr>
        <p:sp>
            <p:nvSpPr>
                <p:cNvPr id="2" name="Title">
                    <a:hlinkClick r:id="" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
                </p:cNvPr>
                <p:cNvSpPr>
                    <a:spLocks noGrp="1"/>
                </p:cNvSpPr>
                <p:nvPr>
                    <p:ph type="title"/>
                </p:nvPr>
            </p:nvSpPr>
            <p:spPr>
                <a:xfrm>
                    <a:off x="457200" y="2743200"/>
                    <a:ext cx="8229600" cy="1143000"/>
                </a:xfrm>
            </p:spPr>
            <p:txBody>
                <a:bodyPr/>
                <a:lstStyle/>
                <a:p>
                    <a:r>
                        <a:rPr lang="zh-CN" sz="4400" dirty="0"/>
                        <a:t>{}</a:t>
                    </a:r>
                </a:p>
            </p:txBody>
        </p:sp>
        <p:sp>
            <p:nvSpPr>
                <p:cNvPr id="3" name="Content Placeholder 2">
                    <a:hlinkClick r:id="" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>
                </p:cNvPr>
                <p:cNvSpPr>
                    <a:spLocks noGrp="1"/>
                </p:cNvSpPr>
                <p:nvPr>
                    <p:ph type="body" idx="1"/>
                </p:nvPr>
            </p:nvSpPr>
            <p:spPr>
                <a:xfrm>
                    <a:off x="457200" y="1600200"/>
                    <a:ext cx="8229600" cy="5257800"/>
                </a:xfrm>
            </p:spPr>
            <p:txBody>
                <a:bodyPr/>
                <a:lstStyle/>
                <a:p>
                    <a:r>
                        <a:rPr lang="zh-CN" sz="2800" dirty="0"/>
                        <a:t>{}</a:t>
                    </a:r>
                </a:p>
            </p:txBody>
        </p:sp>
    </p:spTree>
</p:slide>"#,
            title_text, summary_text
        )
    }

    fn build_slide_rels(&self, slide_num: usize) -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>"#.to_string()
    }

    fn build_slide_layout(&self) -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:slideLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <p:cSld name="Blank">
        <p:spTree>
            <p:nvGrpSpPr>
                <p:cNvPr id="1" name=""/>
                <p:cNvGrpSpPr/>
                <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr>
                <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="0" cy="0"/>
                </a:xfrm>
            </p:grpSpPr>
        </p:spTree>
    </p:cSld>
</p:slideLayout>"#.to_string()
    }

    fn build_slide_master(&self) -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:slideMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <p:cSld>
        <p:spTree>
            <p:nvGrpSpPr>
                <p:cNvPr id="1" name=""/>
                <p:cNvGrpSpPr/>
                <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr>
                <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="0" cy="0"/>
                </a:xfrm>
            </p:grpSpPr>
        </p:spTree>
    </p:cSld>
</p:slideMaster>"#.to_string()
    }

    fn build_theme(&self) -> String {
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
    <a:themeElements>
        <a:clrScheme name="Office">
            <a:dk1>
                <a:sysClr val="windowText" lastClr="000000"/>
            </a:dk1>
            <a:lt1>
                <a:sysClr val="window" lastClr="FFFFFF"/>
            </a:lt1>
            <a:dk2>
                <a:srgbClr val="1F497D"/>
            </a:dk2>
            <a:lt2>
                <a:srgbClr val="EEECE1"/>
            </a:lt2>
            <a:accent1>
                <a:srgbClr val="4F81BD"/>
            </a:accent1>
            <a:accent2>
                <a:srgbClr val="C0504D"/>
            </a:accent2>
            <a:accent3>
                <a:srgbClr val="9BBB59"/>
            </a:accent3>
            <a:accent4>
                <a:srgbClr val="8064A2"/>
            </a:accent4>
            <a:accent5>
                <a:srgbClr val="4BACC6"/>
            </a:accent5>
            <a:accent6>
                <a:srgbClr val="F79646"/>
            </a:accent6>
            <a:hlink>
                <a:srgbClr val="0000FF"/>
            </a:hlink>
            <a:folHlink>
                <a:srgbClr val="800080"/>
            </a:folHlink>
        </a:clrScheme>
        <a:fontScheme name="Office">
            <a:majorFont>
                <a:latin typeface="Calibri"/>
                <a:ea typeface=""/>
                <a:cs typeface=""/>
            </a:majorFont>
            <a:minorFont>
                <a:latin typeface="Calibri"/>
                <a:ea typeface=""/>
                <a:cs typeface=""/>
            </a:minorFont>
        </a:fontScheme>
        <a:fmtScheme name="Office">
            <a:fillStyleLst>
                <a:solidFill>
                    <a:schemeClr val="phClr"/>
                </a:solidFill>
                <a:gradFill rotWithShape="1">
                    <a:gsLst>
                        <a:gs pos="0">
                            <a:schemeClr val="phClr">
                                <a:tint val="50000"/>
                                <a:satMod val="300000"/>
                            </a:schemeClr>
                        </a:gs>
                        <a:gs pos="35000">
                            <a:schemeClr val="phClr">
                                <a:tint val="37000"/>
                                <a:satMod val="300000"/>
                            </a:schemeClr>
                        </a:gs>
                        <a:gs pos="100000">
                            <a:schemeClr val="phClr">
                                <a:tint val="15000"/>
                                <a:satMod val="350000"/>
                            </a:schemeClr>
                        </a:gs>
                    </a:gsLst>
                    <a:lin ang="16200000" scaled="1"/>
                </a:gradFill>
            </a:fillStyleLst>
            <a:lnStyleLst>
                <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr">
                    <a:solidFill>
                        <a:schemeClr val="phClr">
                            <a:shade val="95000"/>
                            <a:satMod val="105000"/>
                        </a:schemeClr>
                    </a:solidFill>
                    <a:prstDash val="solid"/>
                </a:ln>
                <a:ln w="25400" cap="flat" cmpd="sng" algn="ctr">
                    <a:solidFill>
                        <a:schemeClr val="phClr"/>
                    </a:solidFill>
                    <a:prstDash val="solid"/>
                </a:ln>
                <a:ln w="38100" cap="flat" cmpd="sng" algn="ctr">
                    <a:solidFill>
                        <a:schemeClr val="phClr">
                            <a:shade val="95000"/>
                            <a:satMod val="105000"/>
                        </a:schemeClr>
                    </a:solidFill>
                    <a:prstDash val="solid"/>
                </a:ln>
            </a:lnStyleLst>
            <a:effectStyleLst>
                <a:effectStyle>
                    <a:effectLst>
                        <a:outerShdw blurRad="40000" dist="20000" dir="5400000" rotWithShape="0">
                            <a:srgbClr val="000000">
                                <a:alpha val="38000"/>
                            </a:srgbClr>
                        </a:outerShdw>
                    </a:effectLst>
                </a:effectStyle>
                <a:effectStyle>
                    <a:effectLst>
                        <a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0">
                            <a:srgbClr val="000000">
                                <a:alpha val="35000"/>
                            </a:srgbClr>
                        </a:outerShdw>
                    </a:effectLst>
                </a:effectStyle>
                <a:effectStyle>
                    <a:effectLst>
                        <a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0">
                            <a:srgbClr val="000000">
                                <a:alpha val="35000"/>
                            </a:srgbClr>
                        </a:outerShdw>
                    </a:effectLst>
                </a:effectStyle>
            </a:effectStyleLst>
            <a:fontScheme name="Office">
                <a:majorFont>
                    <a:latin typeface="Calibri"/>
                </a:majorFont>
                <a:minorFont>
                    <a:latin typeface="Calibri"/>
                </a:minorFont>
            </a:fontScheme>
        </a:fmtScheme>
    </a:themeElements>
</a:theme>"#.to_string()
    }

    fn escape_xml(&self, s: &str) -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    }
}
```

**Step 2: 更新 output/mod.rs**

```rust
pub mod pptx;

pub use pptx::{PPTXGenerator, PPTXOptions};
```

**Step 3: 验证编译**

```bash
cd wasm
cargo check --target wasm32-unknown-unknown
```

**Step 4: 提交**

```bash
git add wasm/src/output/
git commit -m "feat(wasm): add PPTX generator"
```

---

## Phase 8: 前端 UI 集成

### Task 8.1: 创建视频上传组件

**Files:**

- Create: `app/components/video/VideoUploader.tsx`
- Create: `app/components/video/index.ts`

**Step 1: 实现视频上传组件**

```typescript
// app/components/video/VideoUploader.tsx

'use client';

import { useCallback, useState } from 'react';
import { Upload, Link2, X } from 'lucide-react';
import { cn } from '@/app/lib/utils';

export type VideoSource = { type: 'file'; file: File } | { type: 'url'; url: string };

interface VideoUploaderProps {
  onVideoSelect: (source: VideoSource) => void;
  className?: string;
}

export function VideoUploader({ onVideoSelect, className }: VideoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(f => f.type.startsWith('video/'));

    if (videoFile) {
      onVideoSelect({ type: 'file', file: videoFile });
    }
  }, [onVideoSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoSelect({ type: 'file', file });
    }
  }, [onVideoSelect]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onVideoSelect({ type: 'url', url: urlInput.trim() });
      setUrlInput('');
    }
  }, [urlInput, onVideoSelect]);

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('file')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors',
              activeTab === 'file'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >
            <Upload className="h-4 w-4" />
            本地文件
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors',
              activeTab === 'url'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >
            <Link2 className="h-4 w-4" />
            视频 URL
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'file' ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                dragActive
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              )}
            >
              <Upload className={cn(
                'h-12 w-12 mx-auto mb-4',
                dragActive ? 'text-blue-500' : 'text-gray-400'
              )} />
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                拖拽视频文件到此处，或
              </p>
              <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                选择文件
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                支持 MP4, WebM, MOV 等格式
              </p>
            </div>
          ) : (
            <form onSubmit={handleUrlSubmit}>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="输入 YouTube 或其他视频平台链接..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={!urlInput.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  加载
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                支持 YouTube, Bilibili, Vimeo 等平台
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 创建导出文件**

```typescript
// app/components/video/index.ts

export * from "./VideoUploader";
```

**Step 3: 提交**

```bash
git add app/components/video/
git commit -m "feat: add video uploader component"
```

---

### Task 8.2: 创建视频处理页面

**Files:**

- Create: `app/[locale]/video/page.tsx`

**Step 1: 实现视频处理页面**

```typescript
// app/[locale]/video/page.tsx

'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { VideoUploader, VideoSource } from '@/app/components/video';
import type { VideoDecoder } from '@/app/lib/video';
import type { WhisperSegment } from '@/app/lib/models';

type ProcessingPhase = 'idle' | 'loading_models' | 'extracting_audio' | 'transcribing' | 'completed' | 'error';

interface ProcessingState {
  phase: ProcessingPhase;
  progress: number;
  segments: WhisperSegment[];
  error?: string;
}

export default function VideoProcessingPage() {
  const t = useTranslations();
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    phase: 'idle',
    progress: 0,
    segments: [],
  });

  const handleVideoSelect = useCallback((source: VideoSource) => {
    setVideoSource(source);
  }, []);

  const handleStartProcessing = useCallback(async () => {
    if (!videoSource) return;

    setProcessing({ phase: 'loading_models', progress: 0, segments: [] });

    try {
      // TODO: 实现完整的处理流程
      // 1. 加载模型
      // 2. 提取音频
      // 3. 转录
      // 4. 提取帧
      // 5. OCR
      // 6. 结构化

      setProcessing({
        phase: 'completed',
        progress: 100,
        segments: [],
      });
    } catch (error) {
      setProcessing({
        phase: 'error',
        progress: 0,
        segments: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [videoSource]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            视频转 PPT/笔记
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            本地处理，数据不上传
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {!videoSource ? (
          <VideoUploader onVideoSelect={handleVideoSelect} />
        ) : (
          <div className="space-y-6">
            {/* Video Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {videoSource.type === 'file' ? videoSource.file.name : videoSource.url}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {videoSource.type === 'file' && `${(videoSource.file.size / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
                <button
                  onClick={() => setVideoSource(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Start Button */}
              {processing.phase === 'idle' && (
                <button
                  onClick={handleStartProcessing}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  开始处理
                </button>
              )}

              {/* Progress Display */}
              {processing.phase !== 'idle' && processing.phase !== 'error' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {processing.phase === 'loading_models' && '加载模型...'}
                      {processing.phase === 'extracting_audio' && '提取音频...'}
                      {processing.phase === 'transcribing' && '语音识别...'}
                      {processing.phase === 'completed' && '处理完成！'}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {processing.progress}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${processing.progress}%` }}
                    />
                  </div>

                  {/* Segments Preview */}
                  {processing.segments.length > 0 && (
                    <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                      {processing.segments.map((seg, i) => (
                        <div key={i} className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-gray-500 dark:text-gray-400">
                            [{seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s]
                          </span>{' '}
                          {seg.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {processing.phase === 'error' && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-700 dark:text-red-300">{processing.error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: 提交**

```bash
git add app/\[locale\]/video/
git commit -m "feat: add video processing page"
```

---

## 最终步骤

### Task 9.1: 更新构建配置

**Files:**

- Modify: `wasm/Cargo.toml`
- Modify: `build-wasm.js`

**Step 1: 确保所有新模块都被编译**

```bash
cd wasm
cargo build --target wasm32-unknown-unknown --release
```

**Step 2: 更新构建脚本**

确保 `build-wasm.js` 包含所有新模块的编译。

**Step 3: 提交**

```bash
git add build-wasm.js
git commit -m "build: update wasm build configuration"
```

---

### Task 9.2: 编写测试

**Files:**

- Create: `e2e/video-processing.spec.ts`

**Step 1: E2E 测试**

```typescript
// e2e/video-processing.spec.ts

import { test, expect } from "@playwright/test";

test.describe("Video Processing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/video");
  });

  test("should show video uploader", async ({ page }) => {
    await expect(page.locator("text=视频转 PPT/笔记")).toBeVisible();
    await expect(page.locator("text=本地文件")).toBeVisible();
    await expect(page.locator("text=视频 URL")).toBeVisible();
  });

  test("should accept file upload", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const testFile = {
      name: "test-video.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("fake video content"),
    };

    await fileInput.setInputFiles(testFile);
    await expect(page.locator("text=开始处理")).toBeVisible();
  });

  test("should accept URL input", async ({ page }) => {
    await page.click("text=视频 URL");
    const urlInput = page.locator('input[type="url"]');
    await urlInput.fill("https://www.youtube.com/watch?v=test");

    const loadButton = page.locator('button:has-text("加载")');
    await expect(loadButton).toBeEnabled();
  });
});
```

**Step 2: 提交**

```bash
git add e2e/video-processing.spec.ts
git commit -m "test: add video processing E2E tests"
```

---

## 完成清单

在实施完成后，确保：

- [ ] 所有 WASM 模块编译成功
- [ ] 前端组件无 TypeScript 错误
- [ ] E2E 测试通过
- [ ] 可以上传本地视频并开始处理
- [ ] Whisper 模型加载和转录功能正常
- [ ] PPTX 生成功能正常
- [ ] Markdown 生成功能正常
- [ ] 所有功能有相应的错误处理
- [ ] 用户界面响应流畅

---

## 注意事项

1. **WASM 模型文件**: Whisper 和 PaddleOCR 的 WASM 模型文件需要单独下载并放到 `public/models/` 目录
2. **CORS 处理**: 从 URL 加载视频时需要处理 CORS 问题
3. **内存管理**: 长视频处理时注意内存使用，及时释放资源
4. **浏览器兼容性**: 主要支持 Chrome/Edge，Firefox 部分功能可能有限制
