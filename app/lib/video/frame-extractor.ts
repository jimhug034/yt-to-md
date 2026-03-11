/**
 * Frame Extractor - 从视频中提取关键帧
 */

import type { KeyFrame } from "../wasm";

export interface FrameExtractionOptions {
  interval?: number; // 提取间隔（秒）
  quality?: number; // JPEG 质量 0-1
  maxWidth?: number; // 最大宽度
  detectSceneChange?: boolean; // 是否检测场景变化
  motionThreshold?: number; // 运动阈值
}

export interface ExtractedFrame {
  timestamp: number;
  blob: Blob;
  imageData: ImageData;
  motionScore: number;
}

export class FrameExtractor {
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private previousFrame: ImageData | null = null;

  async initialize(video: HTMLVideoElement): Promise<void> {
    this.videoElement = video;

    this.canvas = document.createElement("canvas");
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;

    this.ctx = this.canvas.getContext("2d");
    if (!this.ctx) {
      throw new Error("Failed to get canvas context");
    }
  }

  /**
   * 提取所有关键帧
   */
  async extractAllFrames(options: FrameExtractionOptions = {}): Promise<ExtractedFrame[]> {
    if (!this.videoElement || !this.canvas || !this.ctx) {
      throw new Error("FrameExtractor not initialized");
    }

    const { interval = 5, quality = 0.8, maxWidth = 1920 } = options;

    const frames: ExtractedFrame[] = [];
    const duration = this.videoElement.duration;
    const currentTime = this.videoElement.currentTime;

    // 调整画布大小
    if (this.videoElement.videoWidth > maxWidth) {
      const scale = maxWidth / this.videoElement.videoWidth;
      this.canvas.width = maxWidth;
      this.canvas.height = Math.round(this.videoElement.videoHeight * scale);
    } else {
      this.canvas.width = this.videoElement.videoWidth;
      this.canvas.height = this.videoElement.videoHeight;
    }

    // 按间隔提取帧
    for (let time = 0; time < duration; time += interval) {
      const frame = await this.extractFrameAt(time, quality);
      if (frame) {
        frames.push(frame);
      }
    }

    // 恢复视频时间
    this.videoElement.currentTime = currentTime;

    return frames;
  }

  /**
   * 提取指定时间的帧
   */
  async extractFrameAt(time: number, quality = 0.8): Promise<ExtractedFrame | null> {
    if (!this.videoElement || !this.canvas || !this.ctx) {
      return null;
    }

    // 跳转到指定时间
    this.videoElement.currentTime = time;
    await this.waitForSeek(this.videoElement);

    // 绘制帧
    this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

    // 获取图像数据
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // 计算运动分数
    const motionScore = this.calculateMotionScore(imageData);
    this.previousFrame = imageData;

    // 转换为 Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      this.canvas!.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

    if (!blob) return null;

    return {
      timestamp: time,
      blob,
      imageData,
      motionScore,
    };
  }

  /**
   * 检测场景变化
   */
  async detectSceneChanges(threshold = 0.3): Promise<number[]> {
    if (!this.videoElement || !this.canvas || !this.ctx) {
      return [];
    }

    const sceneChanges: number[] = [];
    const duration = this.videoElement.duration;
    const interval = 1; // 每秒检查一次

    for (let time = 0; time < duration; time += interval) {
      const frame = await this.extractFrameAt(time);
      if (frame && frame.motionScore > threshold) {
        sceneChanges.push(time);
      }
    }

    return sceneChanges;
  }

  /**
   * 计算运动分数（与前一帧的差异）
   */
  private calculateMotionScore(current: ImageData): number {
    if (!this.previousFrame) return 0;

    const currentData = current.data;
    const previousData = this.previousFrame.data;
    let diff = 0;

    // 采样比较（每 10 个像素采样一次以提高性能）
    for (let i = 0; i < currentData.length; i += 40) {
      diff += Math.abs(currentData[i] - previousData[i]);
      diff += Math.abs(currentData[i + 1] - previousData[i + 1]);
      diff += Math.abs(currentData[i + 2] - previousData[i + 2]);
    }

    const samples = currentData.length / 40;
    return diff / (samples * 3 * 255); // 归一化到 0-1
  }

  /**
   * 等待视频跳转完成
   */
  private waitForSeek(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        video.removeEventListener("seeked", handler);
        resolve();
      };
      video.addEventListener("seeked", handler);
    });
  }

  /**
   * 将 ExtractedFrame 转换为 KeyFrame 格式
   */
  async toKeyFrame(extracted: ExtractedFrame, jobId: string): Promise<KeyFrame> {
    const arrayBuffer = await extracted.blob.arrayBuffer();
    const imageData = new Uint8Array(arrayBuffer);

    return {
      id: crypto.randomUUID(),
      job_id: jobId,
      timestamp: extracted.timestamp,
      image_data: Array.from(imageData),
      ocr_text: null,
      chapter_id: null,
    };
  }

  release() {
    this.canvas = null;
    this.ctx = null;
    this.previousFrame = null;
  }
}

export const frameExtractor = new FrameExtractor();
