/**
 * Whisper 语音识别 Web Worker
 * 使用 @xenova/transformers 进行语音转文字
 */

import { env } from "@xenova/transformers";

// 配置 Transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

// ============================================
// 消息类型定义
// ============================================

export type WhisperWorkerMessage =
  | { type: "loadModel"; options?: WhisperWorkerOptions; _id: number }
  | {
      type: "transcribe";
      audioData?: number[];
      audioBlob?: Blob;
      options?: WhisperWorkerOptions;
      _id: number;
    }
  | { type: "getStatus"; _id: number }
  | { type: "cancel"; _id: number }
  | { type: "abort"; _id: number };

export type WhisperWorkerResponse =
  | { type: "progress"; progress: number; stage: string; _id: number }
  | { type: "complete"; result: WhisperResult; segments: WhisperSegment[]; _id: number }
  | { type: "status"; isModelLoaded: boolean; isProcessing: boolean; _id: number }
  | { type: "error"; error: string; _id: number }
  | { type: "aborted"; _id: number };

export interface WhisperWorkerOptions {
  model?: "tiny" | "base" | "small" | "medium" | "large";
  language?: string;
  task?: "automatic-speech-recognition" | "automatic-speech-translation";
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

// ============================================
// Worker 全局状态
// ============================================

let transcriber: any = null;
let modelSize: string = "tiny";
let isModelLoaded: boolean = false;
let isProcessing: boolean = false;
let pendingJobs: Map<number, any> = new Map();

// ============================================
// 主要功能实现
// ============================================

async function loadModel(options: WhisperWorkerOptions = {}) {
  if (isModelLoaded) return;

  modelSize = options.model || "tiny";
  isProcessing = true;

  try {
    const { pipeline } = await import("@xenova/transformers");

    transcriber = await pipeline("automatic-speech-recognition", `Xenova/whisper-${modelSize}`, {
      progress_callback: (progress: any) => {
        if (progress.status === "progress") {
          postMessage({
            type: "progress",
            progress: progress.progress || 0,
            stage: `加载模型 (${modelSize})`,
            _id: progress.jobId || 0,
          });
        }
      },
    });

    isModelLoaded = true;
    isProcessing = false;
  } catch (error) {
    console.error("Failed to load Whisper model:", error);
    isProcessing = false;
    throw error;
  }
}

async function transcribe(
  audioData: number[] | Blob | undefined,
  options: WhisperWorkerOptions = {},
) {
  if (!isModelLoaded) {
    await loadModel(options);
  }

  if (!audioData) {
    throw new Error("No audio data provided");
  }

  isProcessing = true;
  const jobId = Date.now();

  try {
    let audio: Float32Array;

    if (audioData instanceof Blob) {
      // 处理 Blob
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const arrayBuffer = await audioData.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // 合并所有声道
      const numberOfChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      audio = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let channel = 0; channel < numberOfChannels; channel++) {
          sum += audioBuffer.getChannelData(channel)[i];
        }
        audio[i] = sum / numberOfChannels;
      }
    } else {
      // 处理 Float32Array 数组
      audio = new Float32Array(audioData);
    }

    // 重采样到 16kHz（如果需要）
    const targetSampleRate = 16000;
    const fromRate = audio.length > 16000 * 10 ? 44100 : 16000; // 简单判断
    const resampled = resampleAudio(audio, fromRate, targetSampleRate);

    postMessage({
      type: "progress",
      progress: 0,
      stage: "开始转录",
      _id: jobId,
    });

    const output = await transcriber(resampled, {
      language: options.language || "english",
      task: options.task || "automatic-speech-recognition",
      chunk_length_s: options.chunkLengthS || 30,
      stride_length_s: options.strideLengthS || 5,
      return_timestamps: true,
    });

    postMessage({
      type: "progress",
      progress: 100,
      stage: "转录完成",
      _id: jobId,
    });

    const result = parseOutput(output);

    postMessage({
      type: "complete",
      result,
      segments: result.segments,
      _id: jobId,
    });

    isProcessing = false;
  } catch (error) {
    console.error("Transcription failed:", error);
    postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      _id: jobId,
    });
    isProcessing = false;
  }
}

function parseOutput(output: any): WhisperResult {
  if (!output) {
    return {
      text: "",
      segments: [],
      language: "en",
    };
  }

  // Transformers.js 返回的格式处理
  if (output.chunks && Array.isArray(output.chunks)) {
    return {
      text: output.text || "",
      segments: output.chunks.map((chunk: any) => ({
        start: chunk.timestamp?.[0] || 0,
        end: chunk.timestamp?.[1] || 0,
        text: chunk.text || "",
      })),
      language: output.language || "en",
    };
  }

  return {
    text: output.text || "",
    segments: [],
    language: "en",
  };
}

function resampleAudio(audio: Float32Array, fromRate: number, toRate: number): Float32Array {
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

function getStatus() {
  return {
    isModelLoaded,
    isProcessing,
  };
}

function cancel(jobId: number) {
  if (pendingJobs.has(jobId)) {
    pendingJobs.delete(jobId);
    postMessage({
      type: "aborted",
      _id: jobId,
    });
  }
}

// ============================================
// Worker 消息处理
// ============================================

self.onmessage = (e: MessageEvent<WhisperWorkerMessage>) => {
  const { type, _id } = e.data;

  try {
    switch (type) {
      case "loadModel":
        pendingJobs.set(_id, e.data);
        loadModel(e.data.options)
          .then(() => {
            postMessage({
              type: "status",
              isModelLoaded: true,
              isProcessing: false,
              _id,
            });
          })
          .catch((error) => {
            postMessage({
              type: "error",
              error: error.message,
              _id,
            });
          });
        break;

      case "transcribe":
        pendingJobs.set(_id, e.data);
        transcribe(e.data.audioData, e.data.options).catch((error) => {
          postMessage({
            type: "error",
            error: error.message,
            _id,
          });
        });
        break;

      case "getStatus":
        postMessage({
          type: "status",
          isModelLoaded,
          isProcessing,
          _id,
        });
        break;

      case "cancel":
        cancel(_id);
        break;

      case "abort":
        // 取消所有待处理任务
        pendingJobs.clear();
        isProcessing = false;
        postMessage({
          type: "aborted",
          _id,
        });
        break;
    }
  } catch (error) {
    postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      _id,
    });
  }
};
