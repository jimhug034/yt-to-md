/**
 * Video Decoder - 使用浏览器原生 API 解码视频
 */

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export class VideoDecoder {
  private videoElement: HTMLVideoElement | null = null;

  async loadVideo(source: { type: 'file' | 'url'; data: string | File }): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const url =
      source.type === 'file'
        ? URL.createObjectURL(source.data as File)
        : (source.data as string);

    video.src = url;

    await new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', resolve);
      video.addEventListener('error', reject);
    });

    this.videoElement = video;
    return video;
  }

  async getMetadata(video: HTMLVideoElement): Promise<VideoMetadata> {
    return {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      hasAudio: this.hasAudioTrack(video),
      hasVideo: video.videoWidth > 0 && video.videoHeight > 0,
    };
  }

  private hasAudioTrack(video: HTMLVideoElement): boolean {
    // 尝试检测音轨
    if (typeof (video as any).audioTracks !== 'undefined') {
      return (video as any).audioTracks?.length > 0;
    }
    // 默认假设有音频
    return true;
  }

  async captureFrame(video: HTMLVideoElement, time: number): Promise<ImageData | null> {
    video.currentTime = time;

    await new Promise((resolve) => {
      const handler = () => {
        video.removeEventListener('seeked', handler);
        resolve(undefined);
      };
      video.addEventListener('seeked', handler);
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  captureFrameAsBlob(video: HTMLVideoElement, time: number, quality = 0.8): Promise<Blob | null> {
    return new Promise(async (resolve) => {
      video.currentTime = time;

      await new Promise((r) => {
        const handler = () => {
          video.removeEventListener('seeked', handler);
          r(undefined);
        };
        video.addEventListener('seeked', handler);
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        quality
      );
    });
  }

  release() {
    if (this.videoElement?.src) {
      URL.revokeObjectURL(this.videoElement.src);
    }
    this.videoElement = null;
  }
}

export const videoDecoder = new VideoDecoder();
