/**
 * Transcription Worker
 * 使用 Whisper 进行语音转录的后台 Worker
 *
 * 这个 Worker 在独立线程中运行，执行耗时的语音识别任务，
 * 避免阻塞主线程 UI。
 */

import type { WhisperResult, WhisperOptions } from "../lib/models/whisper";
import type { TranscriptSegment } from "../lib/wasm";

// ============================================
// 消息类型定义
// ============================================

export interface TranscriptionWorkerMessage {
  type: "transcribe" | "loadModel" | "abort" | "getStatus";
  audioData?: Float32Array | Array<number>;
  audioBlob?: Blob;
  options?: TranscriptionOptions;
  jobId?: string;
}

export interface TranscriptionOptions extends WhisperOptions {
  chunkLength?: number;
  strideLength?: number;
  enableTimestamps?: boolean;
  returnWordTimestamps?: boolean;
}

export interface TranscriptionWorkerResponse {
  type: "progress" | "result" | "complete" | "error" | "status" | "aborted";
  progress?: number;
  stage?: "loadingModel" | "processing" | "complete";
  result?: WhisperResult;
  segments?: TranscriptSegment[];
  text?: string;
  language?: string;
  error?: string;
  isModelLoaded?: boolean;
  isProcessing?: boolean;
}

// ============================================
// Worker 状态管理
// ============================================

interface WorkerState {
  isModelLoaded: boolean;
  isProcessing: boolean;
  isAborted: boolean;
  currentJobId: string | null;
}

const state: WorkerState = {
  isModelLoaded: false,
  isProcessing: false,
  isAborted: false,
  currentJobId: null,
};

// Whisper 模型实例 (延迟加载)
let whisperModel: any = null;

// ============================================
// 消息处理
// ============================================

self.onmessage = async (e: MessageEvent<TranscriptionWorkerMessage>) => {
  const message = e.data;

  try {
    switch (message.type) {
      case "loadModel":
        await loadModel(message.options);
        break;

      case "transcribe":
        await transcribe(message);
        break;

      case "abort":
        abort();
        break;

      case "getStatus":
        sendStatus();
        break;

      default:
        sendError(`Unknown message type: ${(message as any).type}`);
    }
  } catch (error) {
    sendError(error instanceof Error ? error.message : String(error));
  }
};

// ============================================
// 功能函数
// ============================================

/**
 * 加载 Whisper 模型
 */
async function loadModel(options?: TranscriptionOptions): Promise<void> {
  if (state.isModelLoaded) {
    sendStatus();
    return;
  }

  state.isProcessing = true;
  sendProgress(0, "loadingModel");

  try {
    // 动态导入 Whisper 模型
    const { getWhisperModel } = await import("../lib/models/whisper");
    whisperModel = getWhisperModel();

    // 设置进度回调
    whisperModel.onProgress((progress: number) => {
      if (!state.isAborted) {
        sendProgress(progress, "loadingModel");
      }
    });

    // 加载模型
    await whisperModel.load(options);

    if (state.isAborted) {
      sendAborted();
      return;
    }

    state.isModelLoaded = true;
    state.isProcessing = false;

    sendProgress(100, "loadingModel");
    sendStatus();
  } catch (error) {
    state.isProcessing = false;
    throw error;
  }
}

/**
 * 执行转录
 */
async function transcribe(message: TranscriptionWorkerMessage): Promise<void> {
  const { audioData, audioBlob, options, jobId } = message;

  if (!audioData && !audioBlob) {
    throw new Error("No audio data provided");
  }

  // 重置中止状态
  state.isAborted = false;
  state.isProcessing = true;
  state.currentJobId = jobId || null;

  try {
    // 确保模型已加载
    if (!state.isModelLoaded || !whisperModel) {
      await loadModel(options);
      if (state.isAborted) {
        sendAborted();
        return;
      }
    }

    sendProgress(0, "processing");

    // 准备音频数据
    let audioInput: Float32Array | Blob;

    if (audioBlob) {
      audioInput = audioBlob;
    } else if (Array.isArray(audioData)) {
      audioInput = new Float32Array(audioData);
    } else {
      audioInput = audioData as Float32Array;
    }

    // 执行转录
    let result: WhisperResult;
    if (audioInput instanceof Blob) {
      result = await whisperModel.transcribeBlob(audioInput, options);
    } else {
      result = await whisperModel.transcribe(audioInput, options);
    }

    if (state.isAborted) {
      sendAborted();
      return;
    }

    // 转换结果格式
    const segments: TranscriptSegment[] = result.segments.map((seg, idx) => ({
      id: crypto.randomUUID(),
      job_id: jobId || "",
      start_time: seg.start,
      end_time: seg.end,
      text: seg.text.trim(),
      confidence: 1.0, // Whisper 不提供每个片段的置信度
    }));

    // 使用 WASM 进行短片段合并
    if (segments.length > 0 && jobId) {
      try {
        const { mergeShortSegmentsWASM } = await import("../lib/wasm");
        const merged = await mergeShortSegmentsWASM(
          JSON.stringify(segments),
          options?.chunkLength || 1.0,
        );
        result.segments = merged.map((s) => ({
          start: s.start_time,
          end: s.end_time,
          text: s.text,
        }));
      } catch {
        // WASM 合并失败，使用原始结果
      }
    }

    state.isProcessing = false;
    state.currentJobId = null;

    sendProgress(100, "processing");
    sendComplete(result, segments);
  } catch (error) {
    state.isProcessing = false;
    state.currentJobId = null;
    throw error;
  }
}

/**
 * 中止当前处理
 */
function abort(): void {
  state.isAborted = true;
  state.isProcessing = false;
  state.currentJobId = null;
  sendAborted();
}

/**
 * 发送进度更新
 */
function sendProgress(
  progress: number,
  stage: WorkerState["isProcessing"] extends boolean ? "loadingModel" | "processing" : never,
): void {
  const response: TranscriptionWorkerResponse = {
    type: "progress",
    progress,
    stage,
  };
  self.postMessage(response);
}

/**
 * 发送完成结果
 */
function sendComplete(result: WhisperResult, segments: TranscriptSegment[]): void {
  const response: TranscriptionWorkerResponse = {
    type: "complete",
    result,
    segments,
    text: result.text,
    language: result.language,
  };
  self.postMessage(response);
}

/**
 * 发送状态
 */
function sendStatus(): void {
  const response: TranscriptionWorkerResponse = {
    type: "status",
    isModelLoaded: state.isModelLoaded,
    isProcessing: state.isProcessing,
  };
  self.postMessage(response);
}

/**
 * 发送中止通知
 */
function sendAborted(): void {
  const response: TranscriptionWorkerResponse = {
    type: "aborted",
  };
  self.postMessage(response);
}

/**
 * 发送错误
 */
function sendError(error: string): void {
  const response: TranscriptionWorkerResponse = {
    type: "error",
    error,
  };
  self.postMessage(response);
}

// 导出类型供外部使用（已在文件顶部定义，无需重复导出）
