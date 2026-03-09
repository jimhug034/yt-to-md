/**
 * Audio Extractor - 使用 Web Audio API 从视频中提取音频
 */

export interface AudioBufferOptions {
  sampleRate?: number;
  channelCount?: number;
}

export class AudioExtractor {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({
        sampleRate: 16000, // Whisper 要求 16kHz
      });
    }
    return this.audioContext;
  }

  async extractAudio(
    video: HTMLVideoElement,
    options: AudioBufferOptions = {}
  ): Promise<AudioBuffer> {
    const context = this.getContext();
    const source = context.createMediaElementSource(video);

    // 从视频中提取音频
    // @ts-ignore - captureStream is not standard
    const stream = video.captureStream ? video.captureStream() : (video as any).mozCaptureStream();
    if (!stream) {
      throw new Error('Cannot capture stream from video element');
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No audio track found in video');
    }

    // 使用 MediaRecorder 录制音频
    const mediaStream = new MediaStream(audioTracks);
    const recorder = new MediaRecorder(mediaStream);

    const chunks: Blob[] = [];
    return new Promise((resolve, reject) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await context.decodeAudioData(arrayBuffer);
        resolve(audioBuffer);
      };

      recorder.onerror = reject;

      video.play();
      recorder.start();

      video.onended = () => {
        recorder.stop();
      };
    });
  }

  async extractAudioRange(
    video: HTMLVideoElement,
    startTime: number,
    endTime: number
  ): Promise<Float32Array> {
    const context = this.getContext();

    // 设置视频时间
    video.currentTime = startTime;
    await new Promise((resolve) => {
      video.addEventListener('seeked', resolve, { once: true });
    });

    // 播放并录制音频片段
    const duration = endTime - startTime;

    return new Promise((resolve, reject) => {
      // @ts-ignore - captureStream is not standard
      const stream = (video as any).captureStream
        ? (video as any).captureStream()
        : (video as any).mozCaptureStream();

      if (!stream) {
        reject(new Error('Cannot capture stream'));
        return;
      }

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        reject(new Error('No audio track'));
        return;
      }

      const mediaStream = new MediaStream(audioTracks);
      const analyzer = context.createAnalyser();
      const source = context.createMediaStreamSource(mediaStream);
      source.connect(analyzer);

      analyzer.fftSize = 2048;
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);

      const samples: Float32Array[] = [];

      video.play();

      const collectSample = () => {
        if (video.currentTime >= endTime || video.ended) {
          video.pause();
          const combined = new Float32Array(samples.reduce((acc, arr) => acc + arr.length, 0));
          let offset = 0;
          for (const sample of samples) {
            combined.set(sample, offset);
            offset += sample.length;
          }
          resolve(combined);
          return;
        }

        analyzer.getFloatTimeDomainData(dataArray);
        samples.push(new Float32Array(dataArray));
        requestAnimationFrame(collectSample);
      };

      collectSample();
    });
  }

  async convertToWav(audioBuffer: AudioBuffer): Promise<Blob> {
    const length = audioBuffer.length * audioBuffer.numberOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    // WAV 文件头
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, audioBuffer.numberOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * 2 * audioBuffer.numberOfChannels, true);
    view.setUint16(32, audioBuffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // 写入音频数据
    const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
      for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
    };

    const channels: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        view.setInt16(offset, channels[channel][i] * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  release() {
    this.audioContext?.close();
    this.audioContext = null;
  }
}

export const audioExtractor = new AudioExtractor();
