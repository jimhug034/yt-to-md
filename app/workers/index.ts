/**
 * Worker Manager
 *
 * 统一管理所有 Web Workers 的创建、通信和生命周期
 * 提供类型安全的 API 用于与 Workers 交互
 */

// ============================================
// 类型导入
// ============================================

import type {
  TranscriptionWorkerMessage,
  TranscriptionWorkerResponse,
  TranscriptionOptions,
} from './transcription.worker';

import type {
  OcrWorkerMessage,
  OcrWorkerResponse,
  OcrWorkerOptions,
  OcrFrameResult,
} from './ocr.worker';

import type {
  FrameExtractionWorkerMessage,
  FrameExtractionWorkerResponse,
  FrameExtractionOptions as WorkerFrameExtractionOptions,
  ExtractedFrameResult,
} from './frame-extraction.worker';

import type {
  WhisperResult,
  WhisperSegment,
} from '../lib/models/whisper';

import type {
  TranscriptSegment,
  KeyFrame,
} from '../lib/wasm';

// ============================================
// 通用 Worker 包装器类型
// ============================================

interface WorkerWrapper<Message, Response> {
  worker: Worker | null;
  isReady: boolean;
  messageId: number;
  pendingMessages: Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number, data?: any) => void;
  }>;
  create(): void;
  terminate(): void;
  send<T = any>(message: Message, options?: WorkerSendOptions): Promise<T>;
}

interface WorkerSendOptions {
  timeout?: number;
  onProgress?: (progress: number, data?: any) => void;
  transferables?: Transferable[];
}

// ============================================
// Transcription Worker 管理器
// ============================================

class TranscriptionWorkerManager implements WorkerWrapper<TranscriptionWorkerMessage, TranscriptionWorkerResponse> {
  worker: Worker | null = null;
  isReady = false;
  messageId = 0;
  pendingMessages = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number, data?: any) => void;
  }>();

  create(): void {
    if (this.worker) return;

    this.worker = new Worker(
      new URL('./transcription.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent<TranscriptionWorkerResponse>) => {
      this.handleMessage(e.data);
    };

    this.worker.onerror = (error) => {
      console.error('Transcription worker error:', error);
    };

    this.isReady = true;
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.pendingMessages.clear();
  }

  async send<T = TranscriptionWorkerResponse>(
    message: TranscriptionWorkerMessage,
    options?: WorkerSendOptions
  ): Promise<T> {
    if (!this.worker) {
      this.create();
    }

    const id = ++this.messageId;

    return new Promise<T>((resolve, reject) => {
      // 设置超时
      if (options?.timeout) {
        setTimeout(() => {
          this.pendingMessages.delete(id);
          reject(new Error(`Worker message timeout: ${message.type}`));
        }, options.timeout);
      }

      this.pendingMessages.set(id, {
        resolve,
        reject,
        onProgress: options?.onProgress,
      });

      if (options?.transferables) {
        this.worker!.postMessage({ ...message, _id: id }, options.transferables);
      } else {
        this.worker!.postMessage({ ...message, _id: id });
      }
    });
  }

  private handleMessage(data: TranscriptionWorkerResponse): void {
    // 查找待处理的消息（这里简化处理，实际可能需要消息ID匹配）
    const entry = Array.from(this.pendingMessages.values())[0];

    if (!entry) return;

    switch (data.type) {
      case 'progress':
        entry.onProgress?.(data.progress || 0, { stage: data.stage });
        break;

      case 'complete':
        this.pendingMessages.clear();
        entry.resolve(data);
        break;

      case 'status':
        // 状态更新，不解析 promise
        break;

      case 'aborted':
        this.pendingMessages.clear();
        entry.reject(new Error('Worker operation aborted'));
        break;

      case 'error':
        this.pendingMessages.clear();
        entry.reject(new Error(data.error || 'Unknown worker error'));
        break;
    }
  }

  // 便捷方法
  async loadModel(options?: TranscriptionOptions): Promise<void> {
    await this.send({ type: 'loadModel', options });
  }

  async transcribe(
    audioData: Float32Array | Blob,
    options?: TranscriptionOptions & { jobId?: string },
    onProgress?: (progress: number) => void
  ): Promise<{ result: WhisperResult; segments: TranscriptSegment[] }> {
    const message: TranscriptionWorkerMessage = {
      type: 'transcribe',
      audioData: audioData instanceof Float32Array ? Array.from(audioData) : undefined,
      audioBlob: audioData instanceof Blob ? audioData : undefined,
      options,
    };

    const response = await this.send(message, { onProgress }) as TranscriptionWorkerResponse & {
      result?: WhisperResult;
      segments?: TranscriptSegment[];
    };

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    return {
      result: response.result!,
      segments: response.segments || [],
    };
  }

  async abort(): Promise<void> {
    await this.send({ type: 'abort' });
  }

  async getStatus(): Promise<{ isModelLoaded: boolean; isProcessing: boolean }> {
    const response = await this.send({ type: 'getStatus' }) as TranscriptionWorkerResponse & {
      isModelLoaded?: boolean;
      isProcessing?: boolean;
    };
    return {
      isModelLoaded: response.isModelLoaded || false,
      isProcessing: response.isProcessing || false,
    };
  }
}

// ============================================
// OCR Worker 管理器
// ============================================

class OcrWorkerManager implements WorkerWrapper<OcrWorkerMessage, OcrWorkerResponse> {
  worker: Worker | null = null;
  isReady = false;
  messageId = 0;
  pendingMessages = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number, data?: any) => void;
  }>();

  create(): void {
    if (this.worker) return;

    this.worker = new Worker(
      new URL('./ocr.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent<OcrWorkerResponse>) => {
      this.handleMessage(e.data);
    };

    this.worker.onerror = (error) => {
      console.error('OCR worker error:', error);
    };

    this.isReady = true;
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.pendingMessages.clear();
  }

  async send<T = OcrWorkerResponse>(
    message: OcrWorkerMessage,
    options?: WorkerSendOptions
  ): Promise<T> {
    if (!this.worker) {
      this.create();
    }

    const id = ++this.messageId;

    return new Promise<T>((resolve, reject) => {
      if (options?.timeout) {
        setTimeout(() => {
          this.pendingMessages.delete(id);
          reject(new Error(`Worker message timeout: ${message.type}`));
        }, options.timeout);
      }

      this.pendingMessages.set(id, {
        resolve,
        reject,
        onProgress: options?.onProgress,
      });

      if (options?.transferables) {
        this.worker!.postMessage({ ...message, _id: id }, options.transferables);
      } else {
        this.worker!.postMessage({ ...message, _id: id });
      }
    });
  }

  private handleMessage(data: OcrWorkerResponse): void {
    const entry = Array.from(this.pendingMessages.values())[0];
    if (!entry) return;

    switch (data.type) {
      case 'progress':
        entry.onProgress?.(data.progress || 0, { stage: data.stage, index: data.index });
        break;

      case 'complete':
        this.pendingMessages.clear();
        entry.resolve(data);
        break;

      case 'status':
        break;

      case 'aborted':
        this.pendingMessages.clear();
        entry.reject(new Error('OCR worker operation aborted'));
        break;

      case 'error':
        this.pendingMessages.clear();
        entry.reject(new Error(data.error || 'Unknown OCR worker error'));
        break;
    }
  }

  // 便捷方法
  async loadModel(options?: OcrWorkerOptions): Promise<void> {
    await this.send({ type: 'loadModel', options });
  }

  async recognize(
    imageData: Uint8ClampedArray | number[],
    width: number,
    height: number,
    options?: OcrWorkerOptions & { timestamp?: number }
  ): Promise<OcrFrameResult> {
    const message: OcrWorkerMessage = {
      type: 'recognize',
      images: [{
        imageData: Array.from(imageData),
        width,
        height,
        timestamp: options?.timestamp,
      }],
      options,
    };

    const response = await this.send(message) as OcrWorkerResponse & {
      results?: OcrFrameResult[];
    };

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    return response.results![0];
  }

  async recognizeBatch(
    images: Array<{ imageData: number[]; width: number; height: number; timestamp?: number }>,
    options?: OcrWorkerOptions,
    onProgress?: (progress: number, index?: number) => void
  ): Promise<OcrFrameResult[]> {
    const message: OcrWorkerMessage = {
      type: 'recognizeBatch',
      images,
      options,
    };

    const response = await this.send(message, { onProgress }) as OcrWorkerResponse & {
      results?: OcrFrameResult[];
    };

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    return response.results || [];
  }

  async abort(): Promise<void> {
    await this.send({ type: 'abort' });
  }

  async getStatus(): Promise<{ isModelLoaded: boolean; isProcessing: boolean }> {
    const response = await this.send({ type: 'getStatus' }) as OcrWorkerResponse & {
      isModelLoaded?: boolean;
      isProcessing?: boolean;
    };
    return {
      isModelLoaded: response.isModelLoaded || false,
      isProcessing: response.isProcessing || false,
    };
  }
}

// ============================================
// Frame Extraction Worker 管理器
// ============================================

class FrameExtractionWorkerManager implements WorkerWrapper<FrameExtractionWorkerMessage, FrameExtractionWorkerResponse> {
  worker: Worker | null = null;
  isReady = false;
  messageId = 0;
  pendingMessages = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number, data?: any) => void;
  }>();

  private onFrameCallback?: ((frame: ExtractedFrameResult) => void) | null;
  private onRequestFramesCallback?: ((timestamps: number[]) => void) | null;

  create(): void {
    if (this.worker) return;

    this.worker = new Worker(
      new URL('./frame-extraction.worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent<FrameExtractionWorkerResponse>) => {
      this.handleMessage(e.data);
    };

    this.worker.onerror = (error) => {
      console.error('Frame extraction worker error:', error);
    };

    this.isReady = true;
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.pendingMessages.clear();
    this.onFrameCallback = null;
    this.onRequestFramesCallback = null;
  }

  async send<T = FrameExtractionWorkerResponse>(
    message: FrameExtractionWorkerMessage,
    options?: WorkerSendOptions
  ): Promise<T> {
    if (!this.worker) {
      this.create();
    }

    const id = ++this.messageId;

    return new Promise<T>((resolve, reject) => {
      if (options?.timeout) {
        setTimeout(() => {
          this.pendingMessages.delete(id);
          reject(new Error(`Worker message timeout: ${message.type}`));
        }, options.timeout);
      }

      this.pendingMessages.set(id, {
        resolve,
        reject,
        onProgress: options?.onProgress,
      });

      if (options?.transferables) {
        this.worker!.postMessage({ ...message, _id: id }, options.transferables);
      } else {
        this.worker!.postMessage({ ...message, _id: id });
      }
    });
  }

  private handleMessage(data: FrameExtractionWorkerResponse): void {
    switch (data.type) {
      case 'requestFrames':
        // 通知主线程需要提取的帧
        this.onRequestFramesCallback?.(data.frameTimestamps || []);
        break;

      case 'result':
        // 单个帧处理完成
        this.onFrameCallback?.(data.frame!);
        break;

      case 'progress':
        const entry = Array.from(this.pendingMessages.values())[0];
        entry?.onProgress?.(data.progress || 0, {
          stage: data.stage,
          current: data.currentFrame,
          total: data.totalFrames,
        });
        break;

      case 'complete':
        const completeEntry = Array.from(this.pendingMessages.values())[0];
        if (completeEntry) {
          this.pendingMessages.clear();
          completeEntry.resolve(data);
        }
        break;

      case 'sceneChanges':
        const sceneEntry = Array.from(this.pendingMessages.values())[0];
        if (sceneEntry) {
          this.pendingMessages.clear();
          sceneEntry.resolve(data);
        }
        break;

      case 'status':
        break;

      case 'aborted':
        this.pendingMessages.forEach(entry => {
          entry.reject(new Error('Frame extraction worker operation aborted'));
        });
        this.pendingMessages.clear();
        break;

      case 'error':
        this.pendingMessages.forEach(entry => {
          entry.reject(new Error(data.error || 'Unknown frame extraction worker error'));
        });
        this.pendingMessages.clear();
        break;
    }
  }

  // 便捷方法
  async extractFrames(
    videoMetadata: VideoMetadataInput,
    options?: WorkerFrameExtractionOptions & { jobId?: string },
    onProgress?: (progress: number) => void
  ): Promise<{ frames: ExtractedFrameResult[]; sceneChanges: number[] }> {
    const message: FrameExtractionWorkerMessage = {
      type: 'extractFrames',
      videoMetadata,
      options,
      jobId: options?.jobId,
    };

    const response = await this.send(message, { onProgress }) as FrameExtractionWorkerResponse & {
      frames?: ExtractedFrameResult[];
      sceneChanges?: number[];
    };

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    return {
      frames: response.frames || [],
      sceneChanges: response.sceneChanges || [],
    };
  }

  async processFrames(
    frames: Array<{ imageData: number[]; timestamp: number; width: number; height: number }>,
    options?: WorkerFrameExtractionOptions & { jobId?: string },
    onProgress?: (progress: number) => void,
    onFrame?: (frame: ExtractedFrameResult) => void
  ): Promise<{ frames: ExtractedFrameResult[]; sceneChanges: number[] }> {
    this.onFrameCallback = onFrame || null;

    const message: FrameExtractionWorkerMessage = {
      type: 'processFrame',
      frames,
      options,
      jobId: options?.jobId,
    };

    const response = await this.send(message, { onProgress }) as FrameExtractionWorkerResponse & {
      frames?: ExtractedFrameResult[];
      sceneChanges?: number[];
    };

    this.onFrameCallback = null;

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    return {
      frames: response.frames || [],
      sceneChanges: response.sceneChanges || [],
    };
  }

  async detectScenes(
    frames: Array<{ imageData: number[]; timestamp: number; width: number; height: number }>,
    options?: WorkerFrameExtractionOptions,
    onProgress?: (progress: number) => void
  ): Promise<number[]> {
    const message: FrameExtractionWorkerMessage = {
      type: 'detectScenes',
      frames,
      options,
    };

    const response = await this.send(message, { onProgress }) as FrameExtractionWorkerResponse & {
      sceneChanges?: number[];
    };

    if (response.type === 'error') {
      throw new Error(response.error);
    }

    return response.sceneChanges || [];
  }

  onFramesRequested(callback: (timestamps: number[]) => void): void {
    this.onRequestFramesCallback = callback;
  }

  async abort(): Promise<void> {
    await this.send({ type: 'abort' });
  }

  async getStatus(): Promise<{ isProcessing: boolean }> {
    const response = await this.send({ type: 'getStatus' }) as FrameExtractionWorkerResponse & {
      isProcessing?: boolean;
    };
    return {
      isProcessing: response.isProcessing || false,
    };
  }
}

// ============================================
// 导出的 Worker 管理器单例
// ============================================

export const transcriptionWorker = new TranscriptionWorkerManager();
export const ocrWorker = new OcrWorkerManager();
export const frameExtractionWorker = new FrameExtractionWorkerManager();

/**
 * 清理所有 Workers
 */
export function terminateAllWorkers(): void {
  transcriptionWorker.terminate();
  ocrWorker.terminate();
  frameExtractionWorker.terminate();
}

// ============================================
// 类型导出
// ============================================

export type {
  // Transcription Worker
  TranscriptionWorkerMessage,
  TranscriptionWorkerResponse,
  TranscriptionOptions,

  // OCR Worker
  OcrWorkerMessage,
  OcrWorkerResponse,
  OcrWorkerOptions,
  OcrFrameResult,

  // Frame Extraction Worker (重命名以避免与 lib/video/frame-extractor.ts 冲突)
  FrameExtractionWorkerMessage,
  FrameExtractionWorkerResponse,
  WorkerFrameExtractionOptions as FrameExtractionWorkerOptions,
  ExtractedFrameResult,

  // Common
  VideoMetadataInput as FrameVideoMetadata,
};

// 补充类型
interface VideoMetadataInput {
  duration: number;
  width: number;
  height: number;
  frameRate?: number;
}
