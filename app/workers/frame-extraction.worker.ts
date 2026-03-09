/**
 * Frame Extraction Worker
 * 处理视频关键帧提取的后台 Worker
 *
 * 这个 Worker 负责协调帧提取任务，由于浏览器安全限制，
 * 实际的视频解码和帧捕获需要在主线程完成。
 * Worker 接收从主线程传递来的帧数据并进行处理。
 */

import type { KeyFrame } from '../lib/wasm';

// ============================================
// 消息类型定义
// ============================================

export interface FrameExtractionWorkerMessage {
  type: 'extractFrames' | 'processFrame' | 'detectScenes' | 'abort' | 'getStatus';
  frames?: FrameInput[];
  videoMetadata?: VideoMetadataInput;
  options?: FrameExtractionOptions;
  jobId?: string;
}

export interface FrameInput {
  imageData: Array<number>;
  timestamp: number;
  width: number;
  height: number;
}

export interface VideoMetadataInput {
  duration: number;
  width: number;
  height: number;
  frameRate?: number;
}

export interface FrameExtractionOptions {
  interval?: number; // 提取间隔（秒）
  quality?: number; // JPEG 质量 0-1
  maxWidth?: number; // 最大宽度
  detectSceneChange?: boolean; // 是否检测场景变化
  motionThreshold?: number; // 运动阈值 0-1
  deduplicateFrames?: boolean; // 是否去除重复帧
  duplicateThreshold?: number; // 重复检测阈值 0-1
}

export interface FrameExtractionWorkerResponse {
  type: 'progress' | 'result' | 'sceneChanges' | 'complete' | 'error' | 'status' | 'aborted' | 'requestFrames';
  progress?: number;
  stage?: 'initializing' | 'extracting' | 'processing' | 'detecting' | 'complete';
  frame?: ExtractedFrameResult;
  frames?: ExtractedFrameResult[];
  sceneChanges?: number[];
  frameTimestamps?: number[]; // 请求主线程提取这些时间点的帧
  error?: string;
  isProcessing?: boolean;
  currentFrame?: number;
  totalFrames?: number;
}

export interface ExtractedFrameResult {
  id: string;
  timestamp: number;
  imageData: Array<number>;
  width: number;
  height: number;
  motionScore: number;
  brightness: number;
  isDuplicate: boolean;
  hash?: string;
}

// ============================================
// Worker 状态管理
// ============================================

interface WorkerState {
  isProcessing: boolean;
  isAborted: boolean;
  currentJobId: string | null;
  lastFrameHash: string | null;
  extractedFrames: ExtractedFrameResult[];
  sceneChanges: number[];
}

const state: WorkerState = {
  isProcessing: false,
  isAborted: false,
  currentJobId: null,
  lastFrameHash: null,
  extractedFrames: [],
  sceneChanges: [],
};

// 帧提取器 WASM 实例
let frameExtractor: any = null;

// ============================================
// 消息处理
// ============================================

self.onmessage = async (e: MessageEvent<FrameExtractionWorkerMessage>) => {
  const message = e.data;

  try {
    switch (message.type) {
      case 'extractFrames':
        await extractFrames(message);
        break;

      case 'processFrame':
        await processFrame(message);
        break;

      case 'detectScenes':
        await detectScenes(message);
        break;

      case 'abort':
        abort();
        break;

      case 'getStatus':
        sendStatus();
        break;

      default:
        sendError(`Unknown message type: ${(message as any).type}`);
    }
  } catch (error) {
    sendError(
      error instanceof Error ? error.message : String(error)
    );
  }
};

// ============================================
// 功能函数
// ============================================

/**
 * 提取视频帧 - 生成需要提取的时间戳
 */
async function extractFrames(message: FrameExtractionWorkerMessage): Promise<void> {
  const { videoMetadata, options, jobId } = message;

  if (!videoMetadata) {
    throw new Error('No video metadata provided');
  }

  // 重置状态
  state.isAborted = false;
  state.isProcessing = true;
  state.currentJobId = jobId || null;
  state.extractedFrames = [];
  state.sceneChanges = [];

  const {
    interval = 5,
    detectSceneChange = false,
  } = options || {};

  sendProgress(0, 'initializing');

  // 初始化 WASM 帧提取器
  try {
    await initializeFrameExtractor(interval);
  } catch {
    // WASM 初始化失败，使用 JS 实现
    frameExtractor = null;
  }

  // 生成需要提取的帧时间戳
  const frameTimestamps: number[] = [];
  for (let time = 0; time < videoMetadata.duration; time += interval) {
    frameTimestamps.push(time);
  }

  // 如果启用场景变化检测，添加额外的采样点
  if (detectSceneChange) {
    for (let time = 0; time < videoMetadata.duration; time += 1) {
      if (!frameTimestamps.includes(time)) {
        frameTimestamps.push(time);
      }
    }
  }

  // 请求主线程提取这些帧
  sendRequestFrames(frameTimestamps);
}

/**
 * 处理从主线程接收的帧数据
 */
async function processFrame(message: FrameExtractionWorkerMessage): Promise<void> {
  const { frames, options, jobId } = message;

  if (!frames || frames.length === 0) {
    throw new Error('No frame data provided');
  }

  const {
    deduplicateFrames = true,
    duplicateThreshold = 0.95,
    motionThreshold = 0.3,
  } = options || {};

  const results: ExtractedFrameResult[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (state.isAborted) {
      sendAborted();
      return;
    }

    const frame = frames[i];

    // 计算帧哈希
    const hash = await calculateFrameHash(frame.imageData);

    // 检测是否为重复帧
    let isDuplicate = false;
    if (deduplicateFrames && state.lastFrameHash) {
      isDuplicate = await isDuplicateFrame(
        state.lastFrameHash,
        hash,
        duplicateThreshold
      );
    }

    // 计算运动分数（需要前一帧）
    const motionScore = await calculateMotionScore(frame.imageData);

    // 计算亮度
    const brightness = await calculateBrightness(frame.imageData);

    const result: ExtractedFrameResult = {
      id: crypto.randomUUID(),
      timestamp: frame.timestamp,
      imageData: frame.imageData,
      width: frame.width,
      height: frame.height,
      motionScore,
      brightness,
      isDuplicate,
      hash,
    };

    results.push(result);
    state.extractedFrames.push(result);
    state.lastFrameHash = hash;

    // 发送进度
    sendProgress(
      ((i + 1) / frames.length) * 100,
      'processing',
      i + 1,
      frames.length
    );

    // 检测场景变化
    if (motionScore > motionThreshold) {
      state.sceneChanges.push(frame.timestamp);
    }

    // 发送单个帧结果
    sendFrameResult(result);
  }

  state.isProcessing = false;

  sendProgress(100, 'complete');
  sendComplete(results, state.sceneChanges);
}

/**
 * 检测场景变化
 */
async function detectScenes(message: FrameExtractionWorkerMessage): Promise<void> {
  const { frames, options } = message;

  if (!frames || frames.length === 0) {
    throw new Error('No frame data provided');
  }

  state.isAborted = false;
  state.isProcessing = true;
  state.sceneChanges = [];

  const { motionThreshold = 0.3 } = options || {};

  sendProgress(0, 'detecting');

  // 计算运动分数
  const motionScores: Array<{ timestamp: number; motionScore: number }> = [];

  for (let i = 0; i < frames.length; i++) {
    if (state.isAborted) {
      sendAborted();
      return;
    }

    const frame = frames[i];
    const motionScore = await calculateMotionScore(frame.imageData);

    motionScores.push({
      timestamp: frame.timestamp,
      motionScore,
    });

    sendProgress(
      ((i + 1) / frames.length) * 50,
      'detecting',
      i + 1,
      frames.length
    );
  }

  // 使用 WASM 检测场景变化
  try {
    const { detectSceneChangesWASM } = await import('../lib/wasm');
    const sceneChanges = await detectSceneChangesWASM(
      JSON.stringify(motionScores),
      motionThreshold
    );
    state.sceneChanges = sceneChanges;
  } catch {
    // 回退到 JS 实现
    state.sceneChanges = motionScores
      .filter(m => m.motionScore > motionThreshold)
      .map(m => m.timestamp);
  }

  state.isProcessing = false;

  sendProgress(100, 'detecting');
  sendSceneChanges(state.sceneChanges);
}

/**
 * 中止当前处理
 */
function abort(): void {
  state.isAborted = true;
  state.isProcessing = false;
  state.extractedFrames = [];
  state.sceneChanges = [];
  sendAborted();
}

/**
 * 初始化 WASM 帧提取器
 */
async function initializeFrameExtractor(interval: number): Promise<void> {
  try {
    const wasm = await import('../lib/wasm');

    // 创建 FrameExtractor 实例（在 JS 侧调用 WASM 构造函数）
    // 注意：这里需要适配实际的 WASM 导出
    frameExtractor = {
      interval,
      calculateFrameHash: async (imageData: number[]) => {
        // 如果 WASM 有此方法，使用它
        // 否则使用 JS 实现
        return calculateFrameHash(imageData);
      },
    };
  } catch {
    frameExtractor = null;
  }
}

/**
 * 计算帧哈希（用于去重）
 */
async function calculateFrameHash(imageData: number[]): Promise<string> {
  // 简单的采样哈希算法
  const sampleSize = 1000;
  const step = Math.max(1, Math.floor(imageData.length / sampleSize));
  let hash = 5381;

  for (let i = 0; i < imageData.length; i += step) {
    hash = ((hash << 5) + hash + imageData[i]) >>> 0;
  }

  return hash.toString(36);
}

/**
 * 检测是否为重复帧
 */
async function isDuplicateFrame(
  hash1: string,
  hash2: string,
  threshold: number
): Promise<boolean> {
  // 简单的哈希比较
  if (hash1 === hash2) return true;

  // 计算汉明距离的简化版本
  const num1 = parseInt(hash1, 36);
  const num2 = parseInt(hash2, 36);
  const max = Math.max(num1, num2);
  const min = Math.min(num1, num2);

  if (max === 0) return false;

  const similarity = 1 - (max - min) / max;
  return similarity > threshold;
}

/**
 * 计算运动分数（与前一帧的差异）
 */
async function calculateMotionScore(imageData: number[]): Promise<number> {
  // 这里需要保存前一帧的数据来进行比较
  // 简化版本：计算图像的"复杂度"作为运动分数的代理
  let diff = 0;
  const sampleSize = 1000;
  const step = Math.max(1, Math.floor(imageData.length / sampleSize));

  for (let i = step; i < imageData.length; i += step) {
    diff += Math.abs(imageData[i] - imageData[i - step]);
  }

  const samples = imageData.length / step;
  const maxDiff = 255 * samples;
  return diff / maxDiff;
}

/**
 * 计算图像亮度
 */
async function calculateBrightness(imageData: number[]): Promise<number> {
  let sum = 0;
  const sampleSize = 1000;
  const step = Math.max(1, Math.floor(imageData.length / sampleSize));
  let count = 0;

  for (let i = 0; i < imageData.length; i += step * 4) {
    // 假设 RGBA 格式，取 R 通道
    sum += imageData[i];
    count++;
  }

  return count > 0 ? (sum / count) / 255 : 0;
}

/**
 * 发送进度更新
 */
function sendProgress(progress: number, stage: 'initializing' | 'extracting' | 'processing' | 'detecting' | 'complete', current?: number, total?: number): void {
  const response: FrameExtractionWorkerResponse = {
    type: 'progress',
    progress,
    stage,
    currentFrame: current,
    totalFrames: total,
  };
  self.postMessage(response);
}

/**
 * 发送请求帧提取消息
 */
function sendRequestFrames(timestamps: number[]): void {
  const response: FrameExtractionWorkerResponse = {
    type: 'requestFrames',
    frameTimestamps: timestamps,
  };
  self.postMessage(response);
}

/**
 * 发送单个帧结果
 */
function sendFrameResult(frame: ExtractedFrameResult): void {
  const response: FrameExtractionWorkerResponse = {
    type: 'result',
    frame,
  };
  self.postMessage(response);
}

/**
 * 发送完成结果
 */
function sendComplete(frames: ExtractedFrameResult[], sceneChanges: number[]): void {
  const response: FrameExtractionWorkerResponse = {
    type: 'complete',
    frames,
    sceneChanges,
  };
  self.postMessage(response);
}

/**
 * 发送场景变化结果
 */
function sendSceneChanges(sceneChanges: number[]): void {
  const response: FrameExtractionWorkerResponse = {
    type: 'sceneChanges',
    sceneChanges,
  };
  self.postMessage(response);
}

/**
 * 发送状态
 */
function sendStatus(): void {
  const response: FrameExtractionWorkerResponse = {
    type: 'status',
    isProcessing: state.isProcessing,
  };
  self.postMessage(response);
}

/**
 * 发送中止通知
 */
function sendAborted(): void {
  const response: FrameExtractionWorkerResponse = {
    type: 'aborted',
  };
  self.postMessage(response);
}

/**
 * 发送错误
 */
function sendError(error: string): void {
  const response: FrameExtractionWorkerResponse = {
    type: 'error',
    error,
  };
  self.postMessage(response);
}

// 导出类型供外部使用（已在文件顶部定义，无需重复导出）
