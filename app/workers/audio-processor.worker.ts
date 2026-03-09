/**
 * Audio Processor Worker
 * 处理音频提取和语音识别任务
 */

import { getWhisperModel } from '../lib/models/whisper';

export interface AudioProcessorMessage {
  type: 'transcribe' | 'resample' | 'extract';
  audioData?: Float32Array;
  audioBlob?: Blob;
  sampleRate?: number;
  options?: any;
}

export interface AudioProcessorResponse {
  type: 'progress' | 'result' | 'error';
  progress?: number;
  result?: any;
  error?: string;
}

let whisperModel: any = null;

self.onmessage = async (e: MessageEvent<AudioProcessorMessage>) => {
  const message = e.data;

  try {
    switch (message.type) {
      case 'transcribe': {
        await transcribeAudio(message);
        break;
      }
      case 'resample': {
        resampleAudio(message);
        break;
      }
      default:
        self.postMessage({
          type: 'error',
          error: `Unknown message type: ${message.type}`,
        } as AudioProcessorResponse);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    } as AudioProcessorResponse);
  }
};

async function transcribeAudio(message: AudioProcessorMessage) {
  if (!whisperModel) {
    whisperModel = getWhisperModel();

    whisperModel.onProgress((progress: number) => {
      self.postMessage({
        type: 'progress',
        progress: progress * 0.5, // 模型加载占 50%
      } as AudioProcessorResponse);
    });
  }

  const { audioData, audioBlob, options } = message;

  let result;
  if (audioBlob) {
    result = await whisperModel.transcribeBlob(audioBlob, options);
  } else if (audioData) {
    result = await whisperModel.transcribe(audioData, options);
  } else {
    throw new Error('No audio data provided');
  }

  self.postMessage({
    type: 'result',
    result,
  } as AudioProcessorResponse);
}

function resampleAudio(message: AudioProcessorMessage) {
  const { audioData, sampleRate = 16000 } = message;

  if (!audioData) {
    throw new Error('No audio data provided');
  }

  // 简单的重采样算法
  const originalRate = message.options?.originalSampleRate || 44100;
  const ratio = originalRate / sampleRate;
  const outputLength = Math.round(audioData.length / ratio);
  const resampled = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    resampled[i] = audioData[srcIndex] || 0;
  }

  self.postMessage({
    type: 'result',
    result: { resampled: Array.from(resampled) },
  } as AudioProcessorResponse);
}
