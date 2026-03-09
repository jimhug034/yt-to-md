/**
 * OCR Manager
 *
 * 管理 OCR Web Worker 和图像处理
 * 提供统一的文字识别接口
 */

import { ocrWorker } from '../../workers';
import type {
  OcrWorkerOptions,
  OcrFrameResult,
} from '../../workers/ocr.worker';

// ============================================
// 类型定义
// ============================================

export interface OcrProgress {
  stage: string;
  progress: number; // 0-100
  index?: number; // 当前处理的帧索引
  total?: number; // 总帧数
}

export interface OcrState {
  isModelLoaded: boolean;
  isProcessing: boolean;
  progress: OcrProgress;
  error: string | null;
}

export interface FrameInput {
  imageData: Uint8ClampedArray | number[];
  width: number;
  height: number;
  timestamp?: number;
}

// ============================================
// OCR Manager Class
// ============================================

class OcrManagerClass {
  private state: OcrState = {
    isModelLoaded: false,
    isProcessing: false,
    progress: { stage: '', progress: 0 },
    error: null,
  };

  private listeners: Set<(state: OcrState) => void> = new Set();

  // ============================================
  // 状态管理
  // ============================================

  private setState(update: Partial<OcrState>) {
    this.state = { ...this.state, ...update };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: OcrState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state); // 立即触发一次
    return () => this.listeners.delete(listener);
  }

  getState(): OcrState {
    return { ...this.state };
  }

  // ============================================
  // 模型加载
  // ============================================

  async loadModel(options?: OcrWorkerOptions): Promise<void> {
    if (this.state.isModelLoaded) return;

    this.setState({
      isProcessing: true,
      progress: { stage: '初始化...', progress: 0 },
      error: null,
    });

    try {
      await ocrWorker.loadModel(options);
      this.setState({
        isModelLoaded: true,
        isProcessing: false,
        progress: { stage: '模型加载完成', progress: 100 },
      });
    } catch (error) {
      this.setState({
        isProcessing: false,
        error: error instanceof Error ? error.message : '模型加载失败',
      });
      throw error;
    }
  }

  // ============================================
  // 单帧识别
  // ============================================

  async recognizeFrame(
    frame: FrameInput,
    options?: OcrWorkerOptions & { timestamp?: number }
  ): Promise<{ text: string; confidence: number; timestamp?: number }> {
    this.setState({
      isProcessing: true,
      progress: { stage: '识别中...', progress: 0 },
      error: null,
    });

    try {
      const imageData = Array.from(
        frame.imageData instanceof Uint8ClampedArray
          ? frame.imageData
          : new Uint8ClampedArray(frame.imageData)
      );

      const result = await ocrWorker.recognize(
        imageData,
        frame.width,
        frame.height,
        { ...options, timestamp: frame.timestamp }
      );

      const text = result?.cleanedText || result?.text || '';
      const confidence = result?.confidence || 0;

      this.setState({
        isProcessing: false,
        progress: { stage: '识别完成', progress: 100 },
      });

      return { text, confidence, timestamp: frame.timestamp };
    } catch (error) {
      this.setState({
        isProcessing: false,
        error: error instanceof Error ? error.message : '识别失败',
      });
      throw error;
    }
  }

  // ============================================
  // 批量识别
  // ============================================

  async recognizeBatch(
    frames: FrameInput[],
    options?: OcrWorkerOptions
  ): Promise<Array<{ text: string; confidence: number; timestamp?: number }>> {
    this.setState({
      isProcessing: true,
      progress: { stage: '批量识别中...', progress: 0, index: 0, total: frames.length },
      error: null,
    });

    try {
      const images = frames.map(f => ({
        imageData: Array.from(
          f.imageData instanceof Uint8ClampedArray
            ? f.imageData
            : new Uint8ClampedArray(f.imageData)
        ),
        width: f.width,
        height: f.height,
        timestamp: f.timestamp,
      }));

      const results = await ocrWorker.recognizeBatch(
        images,
        options,
        (progress: number, index?: number) => {
          this.setState({
            progress: {
              stage: '识别中...',
              progress,
              index: index || 0,
              total: frames.length,
            },
          });
        }
      );

      const mappedResults = results.map((r: OcrFrameResult) => ({
        text: r.cleanedText || r.text,
        confidence: r.confidence,
        timestamp: r.timestamp,
      }));

      this.setState({
        isProcessing: false,
        progress: { stage: '识别完成', progress: 100, total: frames.length },
      });

      return mappedResults;
    } catch (error) {
      this.setState({
        isProcessing: false,
        error: error instanceof Error ? error.message : '识别失败',
      });
      throw error;
    }
  }

  // ============================================
  // 取消/重置
  // ============================================

  async cancel(): Promise<void> {
    await ocrWorker.abort();
    this.setState({
      isProcessing: false,
      progress: { stage: '已取消', progress: 0 },
    });
  }

  reset(): void {
    this.setState({
      isProcessing: false,
      progress: { stage: '', progress: 0 },
      error: null,
    });
  }

  // ============================================
  // 状态查询
  // ============================================

  async getStatus(): Promise<{ isModelLoaded: boolean; isProcessing: boolean }> {
    const status = await ocrWorker.getStatus();
    return {
      isModelLoaded: status.isModelLoaded || this.state.isModelLoaded,
      isProcessing: this.state.isProcessing || status.isProcessing || false,
    };
  }

  isReady(): boolean {
    return this.state.isModelLoaded && !this.state.isProcessing;
  }
}

// ============================================
// 导出单例
// ============================================

export const OcrManager = new OcrManagerClass();
