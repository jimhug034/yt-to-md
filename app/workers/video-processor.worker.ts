/**
 * Video Processor Worker
 * 处理视频帧提取任务
 */

import type { KeyFrame } from "../lib/wasm";

export interface VideoProcessorMessage {
  type: "extractFrames" | "detectScenes" | "processVideo";
  videoUrl?: string;
  duration?: number;
  interval?: number;
  quality?: number;
}

export interface VideoProcessorResponse {
  type: "progress" | "frames" | "scenes" | "complete" | "error";
  progress?: number;
  frames?: KeyFrame[];
  scenes?: number[];
  error?: string;
}

self.onmessage = async (e: MessageEvent<VideoProcessorMessage>) => {
  const message = e.data;

  try {
    switch (message.type) {
      case "extractFrames": {
        await extractFrames(message);
        break;
      }
      case "detectScenes": {
        await detectScenes(message);
        break;
      }
      default:
        self.postMessage({
          type: "error",
          error: `Unknown message type: ${message.type}`,
        } as VideoProcessorResponse);
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    } as VideoProcessorResponse);
  }
};

async function extractFrames(message: VideoProcessorMessage) {
  const { videoUrl, duration, interval = 5, quality = 0.8 } = message;

  if (!videoUrl || !duration) {
    throw new Error("Missing videoUrl or duration");
  }

  const frames: KeyFrame[] = [];
  const frameCount = Math.ceil(duration / interval);

  // 使用 OffscreenCanvas 提取帧
  for (let i = 0; i < frameCount; i++) {
    const timestamp = i * interval;

    // 通知主线程提取该时间点的帧
    self.postMessage({
      type: "progress",
      progress: ((i + 1) / frameCount) * 100,
    } as VideoProcessorResponse);

    // 这里需要主线程配合提取实际的帧数据
    // Worker 无法直接访问 DOM，所以需要主线程传递帧数据
  }

  self.postMessage({
    type: "complete",
    frames,
  } as VideoProcessorResponse);
}

async function detectScenes(message: VideoProcessorMessage) {
  const { videoUrl, duration } = message;

  if (!videoUrl || !duration) {
    throw new Error("Missing videoUrl or duration");
  }

  // 场景变化检测
  const scenes: number[] = [];

  // 每 1 秒采样一次检测场景变化
  const sampleCount = Math.floor(duration);
  for (let i = 0; i < sampleCount; i++) {
    // 场景变化检测逻辑需要主线程配合
    self.postMessage({
      type: "progress",
      progress: ((i + 1) / sampleCount) * 100,
    } as VideoProcessorResponse);
  }

  self.postMessage({
    type: "scenes",
    scenes,
  } as VideoProcessorResponse);
}
