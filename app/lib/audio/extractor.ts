/**
 * Audio Extractor
 *
 * 从视频元素提取音频数据
 * 使用 MediaRecorder 和 AudioContext API
 */

export interface AudioExtractOptions {
  sampleRate?: number;
  channels?: number;
  startTime?: number;
  duration?: number;
}

export interface AudioExtractResult {
  audioBuffer: AudioBuffer;
  audioBlob: Blob;
  duration: number;
  sampleRate: number;
  channels: number;
}

class AudioExtractorClass {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  /**
   * 初始化音频上下文
   */
  private ensureAudioContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContext({
        sampleRate: 16000, // Whisper 要求 16kHz
      });
    }
    return this.audioContext;
  }

  /**
   * 从视频元素提取音频（使用 MediaRecorder）
   */
  async extractFromVideo(
    videoElement: HTMLVideoElement,
    options: AudioExtractOptions = {},
  ): Promise<AudioExtractResult> {
    const { startTime = 0, duration } = options;

    const audioContext = this.ensureAudioContext();

    // 设置视频开始时间
    videoElement.currentTime = startTime;

    // 等待视频准备就绪
    await new Promise<void>((resolve) => {
      if (videoElement.readyState >= 2) {
        resolve();
      } else {
        videoElement.addEventListener("canplay", () => resolve(), { once: true });
      }
    });

    // 使用 MediaRecorder 录制音频
    const stream =
      (videoElement as any).captureStream?.() || (videoElement as any).mozCaptureStream?.();

    if (!stream) {
      throw new Error("Video element does not support stream capture");
    }

    // 获取音频轨道
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("No audio track found in video");
    }

    // 创建仅包含音频的流
    const audioStream = new MediaStream(audioTracks);

    // 使用支持的 MIME 类型
    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(audioStream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    this.audioChunks = [];

    return new Promise<AudioExtractResult>((resolve, reject) => {
      this.mediaRecorder!.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder!.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          resolve({
            audioBuffer,
            audioBlob,
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels,
          });
        } catch (error) {
          reject(error);
        }
      };

      this.mediaRecorder!.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${event}`));
      };

      // 开始录制
      videoElement.play();
      this.mediaRecorder!.start();

      // 如果指定了持续时间，在指定时间后停止
      if (duration !== undefined) {
        setTimeout(() => {
          if (this.mediaRecorder?.state === "recording") {
            this.mediaRecorder.stop();
            videoElement.pause();
          }
        }, duration * 1000);
      } else {
        // 如果没有指定持续时间，等到视频结束
        videoElement.onended = () => {
          if (this.mediaRecorder?.state === "recording") {
            this.mediaRecorder.stop();
          }
        };
      }
    });
  }

  /**
   * 使用 Fetch API 从视频 URL 提取音频（适用于远程视频）
   */
  async extractFromVideoUrl(
    videoUrl: string,
    options: AudioExtractOptions = {},
  ): Promise<Float32Array> {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    const blob = await response.blob();
    return await this.extractFromBlob(blob, options);
  }

  /**
   * 从 Blob 提取音频
   */
  async extractFromBlob(blob: Blob, options: AudioExtractOptions = {}): Promise<Float32Array> {
    const audioContext = this.ensureAudioContext();

    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 转换为单声道
    return this.toMono(audioBuffer);
  }

  /**
   * 转换为单声道 Float32Array
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
   * 获取支持的 MIME 类型
   */
  private getSupportedMimeType(): string {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ""; // 使用默认类型
  }

  /**
   * 取消当前提取
   */
  cancel(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.audioChunks = [];
  }

  /**
   * 释放资源
   */
  release(): void {
    this.cancel();
    if (this.audioContext?.state !== "closed") {
      this.audioContext?.close();
    }
    this.audioContext = null;
    this.mediaRecorder = null;
  }
}

export const audioExtractor = new AudioExtractorClass();

export type { AudioExtractorClass };
