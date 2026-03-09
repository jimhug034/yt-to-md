/**
 * Whisper Manager
 *
 * 管理 Whisper Web Worker 和音频预处理
 * 提供统一的语音识别接口
 */

import { whisperWorker } from '../../workers';
import type {
  WhisperWorkerOptions,
  WhisperResult,
  WhisperSegment,
} from '../../workers';

// ============================================
// 类型定义
// ============================================

export interface TranscriptionProgress {
  stage: string;
  progress: number; // 0-100
}

export interface TranscriptionState {
  isModelLoaded: boolean;
  isProcessing: boolean;
  progress: TranscriptionProgress;
  error: string | null;
}

export interface AudioData {
  data: Float32Array | Blob;
  sampleRate?: number;
  channels?: number;
}

// ============================================
// Whisper Manager
// ============================================

class WhisperManagerClass {
  private state: TranscriptionState = {
    isModelLoaded: false,
    isProcessing: false,
    progress: { stage: '', progress: 0 },
    error: null,
  };

  private listeners: Set<(state: TranscriptionState) => void> = new Set();
  private currentJobId: string | null = null;
  private abortController: AbortController | null = null;

  // ============================================
  // 状态管理
  // ============================================

  private setState(update: Partial<TranscriptionState>) {
    this.state = { ...this.state, ...update };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: (state: TranscriptionState) => void): () => void {
    this.listeners.add(listener);
    // 立即触发一次，提供当前状态
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): TranscriptionState {
    return { ...this.state };
  }

  // ============================================
  // 模型加载
  // ============================================

  async loadModel(options?: WhisperWorkerOptions): Promise<void> {
    if (this.state.isModelLoaded) {
      return;
    }

    this.setState({
      isProcessing: true,
      progress: { stage: '初始化...', progress: 0 },
      error: null,
    });

    try {
      await whisperWorker.loadModel(options);
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
  // 音频预处理
  // ============================================

  /**
   * 预处理音频数据
   * - 重采样到 16kHz
   * - 转换为单声道
   * - 归一化
   */
  private async preprocessAudio(
    audio: AudioData,
    onProgress?: (progress: number) => void
  ): Promise<Float32Array> {
    onProgress?.(10);

    let audioData: Float32Array;

    if (audio.data instanceof Blob) {
      // 从 Blob 解码音频
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await audio.data.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // 合并为单声道
      audioData = this.toMono(audioBuffer);
      onProgress?.(50);
    } else {
      audioData = audio.data;
    }

    // 重采样到 16kHz（如果需要）
    const targetSampleRate = 16000;
    const sourceSampleRate = audio.sampleRate || 44100;

    if (sourceSampleRate !== targetSampleRate) {
      audioData = this.resample(audioData, sourceSampleRate, targetSampleRate);
    }

    onProgress?.(90);

    // 归一化
    audioData = this.normalize(audioData);

    onProgress?.(100);

    return audioData;
  }

  /**
   * 将音频缓冲转换为单声道
   */
  private toMono(audioBuffer: AudioBuffer): Float32Array {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const result = new Float32Array(length);

    if (numberOfChannels === 1) {
      return audioBuffer.getChannelData(0);
    }

    // 混合所有声道
    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let channel = 0; channel < numberOfChannels; channel++) {
        sum += audioBuffer.getChannelData(channel)[i];
      }
      result[i] = sum / numberOfChannels;
    }

    return result;
  }

  /**
   * 重采样音频
   */
  private resample(
    audio: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) return audio;

    const ratio = fromRate / toRate;
    const newLength = Math.round(audio.length / ratio);
    const result = new Float32Array(newLength);

    // 简单的线性插值重采样
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexInt = Math.floor(srcIndex);
      const srcIndexFrac = srcIndex - srcIndexInt;

      if (srcIndexInt + 1 < audio.length) {
        result[i] =
          audio[srcIndexInt] * (1 - srcIndexFrac) +
          audio[srcIndexInt + 1] * srcIndexFrac;
      } else {
        result[i] = audio[srcIndexInt] || 0;
      }
    }

    return result;
  }

  /**
   * 归一化音频
   */
  private normalize(audio: Float32Array): Float32Array {
    // 找到最大绝对值
    let maxAbs = 0;
    for (let i = 0; i < audio.length; i++) {
      const abs = Math.abs(audio[i]);
      if (abs > maxAbs) maxAbs = abs;
    }

    if (maxAbs === 0) return audio;

    // 归一化到 [-1, 1]
    const result = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      result[i] = audio[i] / maxAbs;
    }

    return result;
  }

  // ============================================
  // 转录
  // ============================================

  async transcribe(
    audio: AudioData,
    options?: WhisperWorkerOptions & {
      onProgress?: (progress: TranscriptionProgress) => void;
    }
  ): Promise<{ result: WhisperResult; segments: WhisperSegment[] }> {
    // 检查是否已取消
    if (this.abortController?.signal.aborted) {
      throw new Error('Transcription aborted');
    }

    this.currentJobId = crypto.randomUUID();
    this.abortController = new AbortController();

    this.setState({
      isProcessing: true,
      progress: { stage: '预处理音频...', progress: 0 },
      error: null,
    });

    try {
      // 预处理音频
      const preprocessedAudio = await this.preprocessAudio(audio, (progress) => {
        this.setState({
          progress: {
            stage: '预处理音频...',
            progress: progress * 0.2, // 预处理占总进度的 20%
          },
        });
        options?.onProgress?.(this.state.progress);
      });

      // 检查取消
      if (this.abortController.signal.aborted) {
        throw new Error('Transcription aborted');
      }

      // 调用 Worker 进行转录
      const response = await whisperWorker.transcribe(
        preprocessedAudio,
        {
          ...options,
          jobId: this.currentJobId,
        },
        (progress) => {
          this.setState({
            progress: {
              stage: '转录中...',
              progress: 20 + progress * 0.8, // 转录占总进度的 80%
            },
          });
          options?.onProgress?.(this.state.progress);
        }
      );

      this.setState({
        isProcessing: false,
        progress: { stage: '转录完成', progress: 100 },
      });

      return response;
    } catch (error) {
      this.setState({
        isProcessing: false,
        error: error instanceof Error ? error.message : '转录失败',
      });
      throw error;
    }
  }

  // ============================================
  // 取消/重置
  // ============================================

  async cancel(): Promise<void> {
    this.abortController?.abort();
    await whisperWorker.abort();
    this.setState({
      isProcessing: false,
      progress: { stage: '已取消', progress: 0 },
    });
    this.currentJobId = null;
  }

  reset(): void {
    this.abortController = null;
    this.currentJobId = null;
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
    const workerStatus = await whisperWorker.getStatus();
    return {
      isModelLoaded: workerStatus.isModelLoaded,
      isProcessing: this.state.isProcessing,
    };
  }

  isReady(): boolean {
    return this.state.isModelLoaded && !this.state.isProcessing;
  }
}

// ============================================
// 导出单例
// ============================================

export const WhisperManager = new WhisperManagerClass();
