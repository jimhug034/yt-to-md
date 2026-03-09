/**
 * Whisper ASR Integration
 * 使用 Transformers.js 或 Whisper.cpp WASM 进行语音识别
 */

import { pipeline, env } from '@xenova/transformers';

// 配置 transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface WhisperOptions {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  task?: 'automatic-speech-recognition' | 'automatic-speech-translation';
  chunkLengthS?: number;
  strideLengthS?: number;
}

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

export interface WhisperResult {
  text: string;
  segments: WhisperSegment[];
  language: string;
}

export class WhisperModel {
  private transcriber: any = null;
  private modelSize: string = 'tiny';
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private progressCallback: ((progress: number) => void) | null = null;

  constructor() {
    // 初始化但不立即加载模型
  }

  async load(options: WhisperOptions = {}): Promise<void> {
    if (this.isLoaded || this.isLoading) return;

    this.isLoading = true;
    this.modelSize = options.model || 'tiny';

    try {
      this.transcriber = await pipeline(
        'automatic-speech-recognition',
        `Xenova/whisper-${this.modelSize}`,
        {
          progress_callback: (progress: any) => {
            if (this.progressCallback && progress.status === 'progress') {
              this.progressCallback(progress.progress || 0);
            }
          },
        }
      );

      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load Whisper model:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  onProgress(callback: (progress: number) => void) {
    this.progressCallback = callback;
  }

  async transcribe(
    audioData: Float32Array | AudioBuffer,
    options: WhisperOptions = {}
  ): Promise<WhisperResult> {
    if (!this.isLoaded) {
      await this.load(options);
    }

    let audio: Float32Array;

    if (audioData instanceof AudioBuffer) {
      // 合并所有声道
      const numberOfChannels = audioData.numberOfChannels;
      const length = audioData.length;
      audio = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let channel = 0; channel < numberOfChannels; channel++) {
          sum += audioData.getChannelData(channel)[i];
        }
        audio[i] = sum / numberOfChannels;
      }
    } else {
      audio = audioData;
    }

    // 重采样到 16kHz（Whisper 要求）
    const targetSampleRate = 16000;
    const resampled = this.resample(audio, 44100, targetSampleRate);

    // 调用模型
    const output = await this.transcriber(resampled, {
      language: options.language || 'english',
      task: options.task || 'automatic-speech-recognition',
      chunk_length_s: options.chunkLengthS || 30,
      stride_length_s: options.strideLengthS || 5,
      return_timestamps: true,
    });

    // 解析输出
    return this.parseOutput(output);
  }

  private parseOutput(output: any): WhisperResult {
    if (!output) {
      return {
        text: '',
        segments: [],
        language: 'en',
      };
    }

    // Transformers.js 返回的格式可能不同
    if (output.chunks && Array.isArray(output.chunks)) {
      return {
        text: output.text || '',
        segments: output.chunks.map((chunk: any) => ({
          start: chunk.timestamp?.[0] || 0,
          end: chunk.timestamp?.[1] || 0,
          text: chunk.text || '',
        })),
        language: output.language || 'en',
      };
    }

    return {
      text: output.text || '',
      segments: [],
      language: 'en',
    };
  }

  private resample(audio: Float32Array, fromRate: number, toRate: number): Float32Array {
    if (fromRate === toRate) return audio;

    const ratio = fromRate / toRate;
    const newLength = Math.round(audio.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = Math.floor(i * ratio);
      result[i] = audio[srcIndex] || 0;
    }

    return result;
  }

  async transcribeBlob(blob: Blob, options: WhisperOptions = {}): Promise<WhisperResult> {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return this.transcribe(audioBuffer, options);
  }

  release() {
    this.transcriber = null;
    this.isLoaded = false;
  }
}

// 单例
export let whisperModel: WhisperModel | null = null;

export function getWhisperModel(): WhisperModel {
  if (!whisperModel) {
    whisperModel = new WhisperModel();
  }
  return whisperModel;
}

export function releaseWhisperModel() {
  whisperModel?.release();
  whisperModel = null;
}
