# 视频转 PPT/笔记系统 - 任务拆分

> **项目目标**: 构建浏览器本地运行的视频处理应用，使用 Rust WASM + WebAI 实现视频转字幕/PPT

---

## 技术选型（已确认）

| 组件 | 选择 | 备注 |
|------|------|------|
| OCR | PaddleOCR WASM | 中文识别好，~100MB |
| 语音识别 | Whisper WASM | 高准确度，~200MB |
| AI 总结 | Rust 规则引擎 | 简化版，不依赖大模型 |
| 优先级 | 语音识别 + 字幕 | 第一阶段 |

---

## Phase 1: 项目基础设施

### 1.1 创建 Rust WASM 视频处理模块

**文件**: `wasm/src/video/`

**任务**:
- [ ] 创建 `wasm/src/video/mod.rs` - 模块声明
- [ ] 创建 `wasm/src/video/processor.rs` - 视频处理器结构体
- [ ] 创建 `wasm/src/video/decoder.rs` - 视频解码器接口

**接口设计**:
```rust
#[wasm_bindgen]
pub struct VideoProcessor {
    duration: f64,
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl VideoProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self;

    #[wasm_bindgen]
    pub fn load_from_url(&mut self, url: &str) -> Result<(), JsValue>;

    #[wasm_bindgen]
    pub fn get_metadata(&self) -> JsValue; // { duration, width, height }
}
```

---

### 1.2 前端视频解码器

**文件**: `app/lib/video-decoder.ts`

**任务**:
- [ ] 实现 VideoDecoder 类
- [ ] 使用 HTML5 Video API + Canvas 提取帧
- [ ] 实现音频提取（使用 Web Audio API 或 FFmpeg.wasm）

**接口**:
```typescript
export class VideoDecoder {
  loadFromFile(file: File): Promise<void>;
  loadFromUrl(url: string): Promise<void>;
  extractFrame(timestamp: number): Promise<Blob>;
  extractAudio(): Promise<AudioBuffer>;
  getMetadata(): VideoMetadata;
}
```

---

### 1.3 Web Worker 架构

**文件**: `app/workers/`

**任务**:
- [ ] 创建 `video-processor.worker.ts` - 主处理 Worker
- [ ] 创建 `whisper-processor.worker.ts` - Whisper 专用 Worker
- [ ] 创建 `worker-pool.ts` - Worker 池管理器

---

## Phase 2: 语音识别 (优先级 1)

### 2.1 集成 Whisper WASM

**文件**: `wasm/src/speech/`

**任务**:
- [ ] 创建 `wasm/src/speech/mod.rs`
- [ ] 创建 `wasm/src/speech/whisper.rs`
- [ ] 实现 Whisper WASM JS 绑定接口

**Rust 接口**:
```rust
#[wasm_bindgen]
pub struct WhisperEngine {
    model_loaded: bool,
}

#[wasm_bindgen]
impl WhisperEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self;

    #[wasm_bindgen]
    pub async fn load_model(&mut self, model_path: &str) -> Result<(), JsValue>;

    #[wasm_bindgen]
    pub async fn transcribe(&self, audio_data: &[u8]) -> String;

    #[wasm_bindgen]
    pub fn set_language(&mut self, lang: &str);
}
```

---

### 2.2 前端 Whisper 集成

**文件**: `app/lib/whisper-processor.ts`

**任务**:
- [ ] 下载/加载 Whisper WASM 模型
- [ ] 实现音频预处理（采样率转换、单声道）
- [ ] 实现分块处理（支持长音频）
- [ ] 实现进度回调

**接口**:
```typescript
export interface WhisperConfig {
  model: 'tiny' | 'base' | 'small';
  language: 'zh' | 'en' | 'auto';
}

export interface WhisperSegment {
  start: number;  // seconds
  end: number;
  text: string;
}

export class WhisperProcessor {
  loadModel(config: WhisperConfig): Promise<void>;
  transcribe(audioBuffer: AudioBuffer, onProgress?: Callback): Promise<WhisperSegment[]>;
}
```

---

### 2.3 音频提取模块

**文件**: `app/lib/audio-extractor.ts`

**任务**:
- [ ] 从视频提取音频轨道
- [ ] 转换为 WAV 格式
- [ ] 重采样到 16kHz（Whisper 要求）

---

## Phase 3: 帧提取

### 3.1 帧提取器

**文件**: `wasm/src/frames/`

**任务**:
- [ ] 创建 `wasm/src/frames/mod.rs`
- [ ] 创建 `wasm/src/frames/extractor.rs`
- [ ] 实现固定间隔提取
- [ ] 实现场景变化检测（简化版）

**Rust 接口**:
```rust
#[wasm_bindgen]
pub struct FrameExtractor {
    interval_ms: u32,
}

#[wasm_bindgen]
impl FrameExtractor {
    #[wasm_bindgen(constructor)]
    pub fn new(interval_ms: u32) -> Self;

    #[wasm_bindgen]
    pub fn extract_frames(&self, video_data: &[u8]) -> String; // JSON array of frames
}
```

---

### 3.2 前端帧提取器

**文件**: `app/lib/frame-extractor.ts`

**任务**:
- [ ] 使用 Canvas API 捕获视频帧
- [ ] 压缩帧图像（JPEG 质量 0.7）
- [ ] 存储帧索引（时间戳 → Blob URL）

---

## Phase 4: OCR

### 4.1 集成 PaddleOCR WASM

**文件**: `wasm/src/ocr/`

**任务**:
- [ ] 创建 `wasm/src/ocr/mod.rs`
- [ ] 创建 `wasm/src/ocr/paddle.rs`
- [ ] 实现 PaddleOCR JS 绑定

**Rust 接口**:
```rust
#[wasm_bindgen]
pub struct OCREngine {
    model_loaded: bool,
}

#[wasm_bindgen]
impl OCREngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self;

    #[wasm_bindgen]
    pub async fn load_model(&mut self) -> Result<(), JsValue>;

    #[wasm_bindgen]
    pub async fn recognize(&self, image_data: &[u8]) -> String;

    #[wasm_bindgen]
    pub async fn recognize_batch(&self, images: Vec<&[u8]>) -> String;
}
```

---

### 4.2 前端 OCR 集成

**文件**: `app/lib/ocr-processor.ts`

**任务**:
- [ ] 加载 PaddleOCR WASM 模型
- [ ] 实现批量帧 OCR
- [ ] 实现文本去重和合并

---

## Phase 5: 内容处理

### 5.1 文本总结规则引擎

**文件**: `wasm/src/ai/`

**任务**:
- [ ] 创建 `wasm/src/ai/mod.rs`
- [ ] 创建 `wasm/src/ai/summarizer.rs`
- [ ] 实现基于规则的总结算法

**规则**:
- 移除重复句子（相似度 > 80%）
- 移除口语填充词（嗯、啊、那个、就是）
- 合并短句（< 10 字符）
- 按时间间隔分段

---

### 5.2 章节分割

**文件**: `wasm/src/structure/`

**任务**:
- [ ] 创建 `wasm/src/structure/mod.rs`
- [ ] 创建 `wasm/src/structure/chapterizer.rs`
- [ ] 实现基于时间间隔的章节分割
- [ ] 实现基于主题变化的分割

---

## Phase 6: 输出生成

### 6.1 Markdown 生成器

**文件**: `wasm/src/output/`

**任务**:
- [ ] 扩展现有 `wasm/src/parser/markdown.rs`
- [ ] 添加章节标题
- [ ] 添加关键帧引用

---

### 6.2 PPTX 生成器

**文件**: `wasm/src/output/pptx.rs`

**任务**:
- [ ] 创建 PPTX 结构（Office Open XML）
- [ ] 生成标题页
- [ ] 生成章节页
- [ ] 生成内容页（文本 + 图片）

**Rust 接口**:
```rust
#[wasm_bindgen]
pub fn generate_pptx(content_json: &str) -> Vec<u8>;

// content_json 格式:
{
  "title": "视频标题",
  "chapters": [
    {
      "title": "章节标题",
      "frames": ["data:image/jpeg;base64,..."],
      "points": ["要点1", "要点2"]
    }
  ]
}
```

---

## Phase 7: 前端 UI

### 7.1 视频上传组件

**文件**: `app/components/VideoUploader.tsx`

**任务**:
- [ ] 拖拽上传区域
- [ ] YouTube URL 输入
- [ ] 文件预览

---

### 7.2 视频处理组件

**文件**: `app/components/VideoProcessor.tsx`

**任务**:
- [ ] 处理步骤显示
- [ ] 进度条
- [ ] 取消按钮
- [ ] 实时日志

---

### 7.3 输出查看器

**文件**: `app/components/OutputViewer.tsx`

**任务**:
- [ ] Markdown 预览
- [ ] PPT 预览（或下载按钮）
- [ ] 关键帧画廊
- [ ] 导出选项

---

### 7.4 视频处理页面

**文件**: `app/[locale]/video/page.tsx`

**任务**:
- [ ] 整合所有组件
- [ ] 状态管理
- [ ] 错误处理

---

## 依赖更新

### Cargo.toml 更新

```toml
[dependencies]
# 现有
wasm-bindgen = "0.2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
js-sys = "0.3"
quick-xml = { version = "0.37", features = ["serialize"] }

# 新增
wasm-bindgen-futures = "0.4"
web-sys = { version = "0.3", features = [
    "HtmlVideoElement",
    "HtmlCanvasElement",
    "CanvasRenderingContext2d",
    "AudioContext",
    "AudioBuffer",
] }

# PPTX 生成
zip = { version = "2.0", default-features = false }
xml-rs = "0.8"
```

### package.json 更新

```json
{
  "dependencies": {
    "@xenova/transformers": "^2.17.0",
    "pptxgenjs": "^3.12.0"
  }
}
```

---

## 实现顺序

1. **Week 1**: Phase 1 + Phase 2（语音识别优先）
2. **Week 2**: Phase 3（帧提取）+ Phase 5（内容处理）
3. **Week 3**: Phase 4（OCR）+ Phase 6（输出生成）
4. **Week 4**: Phase 7（前端 UI）+ 集成测试

---

## 测试计划

- [ ] 上传本地视频并提取字幕
- [ ] 从 YouTube URL 处理视频
- [ ] 验证 Whisper 转写准确性
- [ ] 验证 PaddleOCR 文本提取
- [ ] 验证 PPTX 生成
- [ ] 性能测试（处理 10 分钟视频）
