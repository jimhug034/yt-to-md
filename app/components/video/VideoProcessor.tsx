'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { VideoUploader } from './VideoUploader';
import { ProgressStepper } from './ProgressStepper';
import { RealtimeTranscript } from './RealtimeTranscript';
import { FrameGallery } from './FrameGallery';
import { OutputViewer } from './OutputViewer';
import { useWhisperTranscription } from '@/app/hooks';
import { audioExtractor } from '@/app/lib/audio';
import type { VideoJob, TranscriptSegment, KeyFrame, Chapter } from '@/app/lib/wasm';
import { videoDecoder } from '@/app/lib/video/decoder';
import { frameExtractor } from '@/app/lib/video/frame-extractor';
import type { ExtractedFrame } from '@/app/lib/video/frame-extractor';
import type { WhisperSegment } from '@/app/workers';

export type ProcessingStep =
  | 'idle'
  | 'loading'
  | 'extracting_audio'
  | 'transcribing'
  | 'extracting_frames'
  | 'running_ocr'
  | 'generating_summary'
  | 'complete'
  | 'error';

interface ProcessingState {
  step: ProcessingStep;
  progress: number;
  job: VideoJob | null;
  segments: TranscriptSegment[];
  frames: KeyFrame[];
  chapters: Chapter[];
  error: string | null;
  videoElement: HTMLVideoElement | null;
  useWhisper: boolean; // 是否使用 Whisper 转录
}

export function VideoProcessor() {
  const [state, setState] = useState<ProcessingState>({
    step: 'idle',
    progress: 0,
    job: null,
    segments: [],
    frames: [],
    chapters: [],
    error: null,
    videoElement: null,
    useWhisper: true, // 默认使用 Whisper
  });

  const processingAbortRef = useRef<AbortController | null>(null);

  // Whisper hook
  const whisper = useWhisperTranscription({
    autoLoad: state.useWhisper,
    model: 'tiny', // 使用 tiny 模型以加快加载速度
  });

  const updateProgress = useCallback((step: ProcessingStep, progress: number) => {
    setState((prev) => ({ ...prev, step, progress }));
  }, []);

  const handleVideoSelect = useCallback(async (source: {
    type: 'file' | 'url';
    data: string | File;
  }) => {
    // Cancel any ongoing processing
    if (processingAbortRef.current) {
      processingAbortRef.current.abort();
    }
    processingAbortRef.current = new AbortController();
    const { signal } = processingAbortRef.current;

    try {
      setState((prev) => ({ ...prev, step: 'loading', progress: 0, error: null }));

      // Load video
      const videoElement = await videoDecoder.loadVideo(source);
      const metadata = await videoDecoder.getMetadata(videoElement);

      if (!metadata || metadata.duration === 0) {
        throw new Error('Failed to load video metadata');
      }

      // Create job
      const job: VideoJob = {
        id: crypto.randomUUID(),
        source_url: source.type === 'url' ? source.data as string : null,
        file_name: source.type === 'file' ? (source.data as File).name : 'video',
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        created_at: Date.now(),
        status: 'Pending' as const,
        progress: 0,
        error_message: null,
      };

      setState((prev) => ({
        ...prev,
        job,
        videoElement,
        step: 'extracting_audio',
        progress: 5,
      }));

      // Start processing pipeline
      await processVideoPipeline(job, videoElement, signal);

    } catch (error) {
      if (signal.aborted) {
        setState((prev) => ({ ...prev, step: 'idle', error: null }));
      } else {
        setState((prev) => ({
          ...prev,
          step: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    }
  }, []);

  const processVideoPipeline = async (
    job: VideoJob,
    videoElement: HTMLVideoElement,
    signal: AbortSignal
  ) => {
    // Step 1: Initialize frame extractor
    await frameExtractor.initialize(videoElement);

    // Step 2: Extract audio and transcribe (5% - 35%)
    if (state.useWhisper) {
      await extractAudioAndTranscribe(job, videoElement, signal);
    }
    if (signal.aborted) return;

    // Step 3: Extract frames (35% - 65%)
    updateProgress('extracting_frames', 35);
    const extractedFrames = await extractKeyFrames(job, signal);
    if (signal.aborted) return;

    // Step 4: Convert to KeyFrame format (65% - 75%)
    updateProgress('running_ocr', 65);
    const keyFrames = await Promise.all(
      extractedFrames.map((frame) =>
        frameExtractor.toKeyFrame(frame, job.id).then(kf => ({
          ...kf,
          ocr_text: null, // OCR is optional/simulated for now
        }))
      )
    );

    setState((prev) => ({ ...prev, frames: keyFrames }));

    // Step 5: Generate chapters (75% - 95%)
    updateProgress('generating_summary', 75);
    await generateChapters(job, signal);
    if (signal.aborted) return;

    // Complete
    updateProgress('complete', 100);
  };

  const extractAudioAndTranscribe = async (
    job: VideoJob,
    videoElement: HTMLVideoElement,
    signal: AbortSignal
  ) => {
    updateProgress('extracting_audio', 5);

    try {
      // 加载 Whisper 模型
      if (!whisper.state.isModelLoaded) {
        updateProgress('extracting_audio', 8);
        await whisper.loadModel();
      }

      if (signal.aborted) return;

      // 提取音频
      updateProgress('extracting_audio', 10);

      let audioData: Float32Array;

      if (job.source_url) {
        // 从 URL 提取
        audioData = await audioExtractor.extractFromVideoUrl(job.source_url, {
          sampleRate: 16000,
        });
      } else {
        // 从视频元素提取
        const result = await audioExtractor.extractFromVideo(videoElement, {
          startTime: 0,
        });
        audioData = await audioExtractor.extractFromBlob(result.audioBlob, {
          sampleRate: 16000,
        });
      }

      if (signal.aborted) return;

      updateProgress('transcribing', 15);

      // 转录
      const response = await whisper.transcribe(
        { data: audioData, sampleRate: 16000, channels: 1 },
        {
          onProgress: (progress) => {
            const overallProgress = 15 + progress.progress * 0.2; // 15% - 35%
            updateProgress('transcribing', overallProgress);
          },
        }
      );

      if (signal.aborted) return;

      // 转换 Whisper segments 到 TranscriptSegments
      const transcriptSegments: TranscriptSegment[] = response.segments.map(
        (seg: WhisperSegment) => ({
          id: crypto.randomUUID(),
          job_id: job.id,
          start_time: seg.start,
          end_time: seg.end,
          text: seg.text.trim(),
          confidence: 0.9, // Whisper 不直接提供置信度
        })
      );

      setState((prev) => ({ ...prev, segments: transcriptSegments }));

    } catch (error) {
      console.error('Transcription failed:', error);
      // 转录失败时使用模拟数据
      await simulateTranscription(job, signal);
    }
  };

  const simulateTranscription = async (
    job: VideoJob,
    signal: AbortSignal
  ) => {
    // 模拟转录（用于 Whisper 不可用时）
    await new Promise(resolve => setTimeout(resolve, 500));

    if (signal.aborted) return;

    const mockSegments: TranscriptSegment[] = [
      {
        id: crypto.randomUUID(),
        job_id: job.id,
        start_time: 0,
        end_time: 5,
        text: 'Welcome to this video about video processing.',
        confidence: 0.95,
      },
      {
        id: crypto.randomUUID(),
        job_id: job.id,
        start_time: 5,
        end_time: 10,
        text: 'We will explore how to extract and process video frames.',
        confidence: 0.92,
      },
      {
        id: crypto.randomUUID(),
        job_id: job.id,
        start_time: 10,
        end_time: 15,
        text: 'The system uses WebAssembly for high-performance processing.',
        confidence: 0.88,
      },
      {
        id: crypto.randomUUID(),
        job_id: job.id,
        start_time: 15,
        end_time: 20,
        text: 'Let\'s dive into the technical details.',
        confidence: 0.90,
      },
    ];

    if (job.duration > 30) {
      mockSegments.push({
        id: crypto.randomUUID(),
        job_id: job.id,
        start_time: 20,
        end_time: 30,
        text: 'This demonstrates the scalability of the approach.',
        confidence: 0.85,
      });
    }

    setState((prev) => ({ ...prev, segments: mockSegments }));
  };

  const extractKeyFrames = async (
    job: VideoJob,
    signal: AbortSignal
  ): Promise<ExtractedFrame[]> => {
    const interval = 5; // Extract frame every 5 seconds
    const frames: ExtractedFrame[] = [];
    const duration = job.duration;

    for (let time = 0; time < duration; time += interval) {
      if (signal.aborted) throw new Error('Aborted');

      const frame = await frameExtractor.extractFrameAt(time, 0.8);
      if (frame) {
        frames.push(frame);
      }

      // Update progress
      const progress = 35 + ((time / duration) * 30);
      updateProgress('extracting_frames', progress);
    }

    return frames;
  };

  const generateChapters = async (
    job: VideoJob,
    signal: AbortSignal
  ) => {
    await new Promise(resolve => setTimeout(resolve, 500));

    const { segments } = state;
    if (segments.length === 0) return;

    // Simple chaptering based on time
    const chapterDuration = 15; // seconds per chapter
    const chapters: Chapter[] = [];

    for (let startTime = 0; startTime < job.duration; startTime += chapterDuration) {
      const endTime = Math.min(startTime + chapterDuration, job.duration);

      // Find segments in this chapter
      const chapterSegments = segments.filter(
        s => s.start_time >= startTime && s.end_time <= endTime
      );

      const title = chapterSegments.length > 0
        ? `Chapter ${chapters.length + 1}: ${chapterSegments[0].text.slice(0, 30)}...`
        : `Chapter ${chapters.length + 1}`;

      const summary = chapterSegments
        .map(s => s.text)
        .join(' ')
        .slice(0, 200);

      chapters.push({
        id: crypto.randomUUID(),
        job_id: job.id,
        title,
        start_time: startTime,
        end_time: endTime,
        summary,
      });
    }

    setState((prev) => ({ ...prev, chapters }));
  };

  const handleReset = useCallback(() => {
    if (processingAbortRef.current) {
      processingAbortRef.current.abort();
      processingAbortRef.current = null;
    }
    whisper.reset();
    videoDecoder.release();
    frameExtractor.release();
    audioExtractor.release();
    setState({
      step: 'idle',
      progress: 0,
      job: null,
      segments: [],
      frames: [],
      chapters: [],
      error: null,
      videoElement: null,
      useWhisper: true,
    });
  }, [whisper]);

  const handleCancel = useCallback(async () => {
    if (processingAbortRef.current) {
      processingAbortRef.current.abort();
    }
    await whisper.cancel();
    setState((prev) => ({ ...prev, step: 'idle' }));
  }, [whisper]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingAbortRef.current) {
        processingAbortRef.current.abort();
      }
      whisper.reset();
      videoDecoder.release();
      frameExtractor.release();
      audioExtractor.release();
    };
  }, [whisper]);

  if (state.step === 'idle') {
    return <VideoUploader onVideoSelect={handleVideoSelect} />;
  }

  // 计算当前步骤描述
  const getCurrentStepDescription = (): string | undefined => {
    if (state.step === 'complete') return undefined;
    if (state.step === 'transcribing') {
      if (whisper.isLoading) return 'Loading Whisper model...';
      if (whisper.isTranscribing) return `Transcribing: ${Math.round(whisper.state.progress.progress)}%`;
      return 'Transcribing...';
    }
    return `Processing: ${state.step.replace(/_/g, ' ')}`;
  };

  return (
    <div className="space-y-8">
      <ProgressStepper
        currentStep={state.step}
        progress={state.progress}
        stepDetails={{
          current: getCurrentStepDescription(),
          total: state.job ? `${Math.round(state.job.duration)}s video` : undefined,
        }}
      />

      {/* Whisper 状态指示器 */}
      {state.useWhisper && state.step === 'transcribing' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${whisper.isLoading ? 'bg-yellow-500 animate-pulse' : whisper.isTranscribing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              {whisper.isLoading && 'Loading Whisper model...'}
              {whisper.isTranscribing && `Transcribing audio: ${Math.round(whisper.state.progress.progress)}%`}
              {!whisper.isLoading && !whisper.isTranscribing && 'Whisper ready'}
            </span>
            {whisper.isTranscribing && (
              <button
                onClick={handleCancel}
                className="ml-auto px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {state.step === 'error' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">
                Processing Error
              </h3>
              <p className="text-red-600 dark:text-red-300 mb-4">{state.error}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(state.step === 'transcribing' ||
        state.step === 'extracting_frames' ||
        state.step === 'running_ocr' ||
        state.step === 'generating_summary') && (
        <RealtimeTranscript
          segments={state.segments}
          isProcessing={true}
          currentTime={0}
        />
      )}

      {(state.step === 'extracting_frames' || state.step === 'running_ocr' || state.step === 'generating_summary' || state.step === 'complete') && state.frames.length > 0 && (
        <FrameGallery
          frames={state.frames}
          isProcessing={state.step === 'extracting_frames'}
        />
      )}

      {state.step === 'complete' && state.job && (
        <OutputViewer
          job={state.job}
          segments={state.segments}
          chapters={state.chapters}
          frames={state.frames}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
