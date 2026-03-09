# Whisper 语音识别功能设计文档

> **日期**: 2026-03-09
> **状态**: 设计已完成，待实现
> **优先级**: 高（核心功能）

---

## 1. 概述

### 1.1 目标

在视频转 PPT/笔记系统中集成 Whisper 语音识别功能，实现浏览器本地运行的语音转文字能力。

### 1.2 需求摘要

| 需求项 | 说明 |
|--------|------|
| 模型选择 | Whisper Small 模型（~460MB，高准确度） |
| 语言支持 | 中英文自动检测 |
| 处理方式 | 实时流式输出 |
| 错误处理 | 详细错误 + 重试机制 |
| 音频来源 | 本地视频 + YouTube 视频 |

---

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (React/Next.js)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ VideoProcessor│───▶│ AudioExtractor│───▶│ WhisperUI    │    │
│  │   Component   │    │   (JS/Wasm)  │    │  Component   │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │            Rust WASM Whisper Module                     │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐      │  │
│  │  │AudioProcessor│  │WhisperEngine│  │ResultParser│      │  │
│  │  │  (预处理)   │  │ (识别核心)  │  │  (结果处理) │      │  │
│  │  └────────────┘  └────────────┘  └────────────┘      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              SQLite3 Database (Rust WASM)               │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流程

```
Video File → AudioExtractor → AudioBuffer(原始采样率)
                                    │
                                    ▼
                          AudioProcessor.resample_to_16k()
                                    │
                                    ▼
                          Float32Array (16kHz 单声道)
                                    │
                                    ▼
                          WhisperWorker.transcribe()
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                  Chunk1         Chunk2         Chunk3
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                                    ▼
                          实时返回 TranscriptSegment
                                    │
                                    ▼
                          SQLite3 Database + UI Update
```

---

## 3. Rust WASM 模块设计

### 3.1 模块结构

```
wasm/src/speech/
├── mod.rs                 # 模块导出
├── whisper.rs             # Whisper 引擎封装
├── audio_processor.rs     # 音频预处理
├── result_parser.rs       # 结果解析
└── types.rs               # 共享类型定义
```

### 3.2 核心接口

#### `wasm/src/speech/whisper.rs`

```rust
#[wasm_bindgen]
pub struct WhisperEngine {
    ctx: *mut WhisperContext,
    model_loaded: bool,
    params: WhisperParams,
}

#[wasm_bindgen]
impl WhisperEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self;

    #[wasm_bindgen]
    pub async fn load_model(&mut self, model_data: &[u8]) -> Result<(), JsValue>;

    #[wasm_bindgen]
    pub fn transcribe(&mut self, audio_data: &[u8], language: &str) -> String;

    #[wasm_bindgen]
    pub fn set_progress_callback(&mut self, callback: js_sys::Function);

    #[wasm_bindgen]
    pub fn cancel(&mut self);
}
```

#### `wasm/src/speech/audio_processor.rs`

```rust
#[wasm_bindgen]
pub struct AudioProcessor {
    sample_rate: u32,
    channels: u32,
}

#[wasm_bindgen]
impl AudioProcessor {
    #[wasm_bindgen]
    pub fn from_wav(data: &[u8]) -> Result<AudioProcessor, JsValue>;

    #[wasm_bindgen]
    pub fn resample(&self, target_rate: u32) -> Float32Array;

    #[wasm_bindgen]
    pub fn to_mono(&self) -> Float32Array;

    #[wasm_bindgen]
    pub fn chunk(&self, duration_sec: f32) -> Vec<Float32Array>;
}
```

### 3.3 依赖更新

```toml
[dependencies]
whisper-rs = { version = "0.11", features = ["wasm-bindgen"] }
```

---

## 4. JavaScript 端集成

### 4.1 Web Worker

**文件**: `app/workers/whisper.worker.ts`

- 专门运行 Whisper WASM
- 处理模型加载、音频转录
- 实时进度回调
- 支持取消操作

### 4.2 Whisper 管理器

**文件**: `app/lib/speech/whisper-manager.ts`

```typescript
export class WhisperManager {
  async init(onProgress: Callback): Promise<void>;
  async loadModel(modelUrl: string): Promise<void>;
  async transcribe(audioBuffer: AudioBuffer): Promise<TranscriptSegment[]>;
  cancel(): void;
}
```

### 4.3 React Hook

**文件**: `app/hooks/useWhisperTranscription.ts`

```typescript
export function useWhisperTranscription() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'processing' | 'complete' | 'error'>('idle');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [progress, setProgress] = useState(0);

  const transcribe = async (audioBuffer: AudioBuffer) => { ... };

  return { status, segments, progress, transcribe };
}
```

---

## 5. 错误处理与重试

### 5.1 错误类型

```rust
#[wasm_bindgen]
pub enum WhisperError {
    ModelNotLoaded,
    InvalidAudioData,
    TranscriptionFailed { message: String },
    Cancelled,
}
```

### 5.2 重试策略

| 错误类型 | 处理方式 |
|---------|---------|
| 网络错误 | 重试（指数退避，最多 3 次）|
| 模型加载失败 | 降级到 Tiny 模型 |
| 音频过短 | 跳过并继续 |
| 用户取消 | 中止处理 |

---

## 6. 测试计划

### 6.1 单元测试

```rust
// wasm/src/speech/tests/
- test_audio_processor_resample()
- test_result_parser_merge_segments()
- test_error_handling()
```

### 6.2 集成测试

```typescript
// app/lib/speech/__tests__/
- should transcribe audio buffer
- should handle model loading failure
- should support cancellation
```

### 6.3 E2E 测试

```typescript
// e2e/whisper-workflow.spec.ts
- 完整转录工作流测试
- 错误恢复测试
- 性能测试
```

---

## 7. 性能目标

| 指标 | 目标值 |
|------|--------|
| 模型加载时间 | < 10 秒 |
| 1分钟音频转录时间 | < 30 秒 |
| 内存占用 | < 500MB |
| 实时延迟 | < 500ms/片段 |
| 错误恢复时间 | < 3 秒 |

---

## 8. 实现步骤

1. **Rust WASM 基础** (1-2天)
   - 配置依赖
   - 实现核心模块
   - 编译测试

2. **Worker 与集成** (1-2天)
   - 创建 Worker
   - 实现管理器
   - 进度回调

3. **UI 组件** (1天)
   - React Hook
   - 组件开发
   - 集成到 VideoProcessor

4. **数据持久化** (0.5天)
   - SQLite3 扩展
   - 实时保存

5. **测试与优化** (1天)
   - 单元测试
   - 集成测试
   - 性能优化

**总计：约 4.5 - 6.5 天**

---

## 9. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| WASM 体积大 | 进度条、后台预加载 |
| 内存占用高 | 分块处理、内存监控 |
| 中文准确度 | 重试、手动选择语言 |
| 浏览器兼容 | 降级方案 |

---

## 10. 验收标准

- [x] 设计文档已完成
- [ ] Whisper 模型成功加载
- [ ] 支持本地视频转录
- [ ] 支持 YouTube 视频转录
- [ ] 实时显示转录结果
- [ ] 结果保存到 SQLite3
- [ ] 支持取消操作
- [ ] 错误处理和重试机制正常工作
- [ ] 单元测试覆盖率 > 70%
- [ ] E2E 测试通过

---

**设计版本**: 1.0
**最后更新**: 2026-03-09
