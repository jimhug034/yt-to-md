/**
 * useWhisperTranscription Hook
 *
 * React Hook 用于 Whisper 语音识别
 * 提供状态管理和转录方法
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { WhisperManager } from '../lib/speech';
import type {
  TranscriptionState,
  TranscriptionProgress,
  AudioData,
} from '../lib/speech';
import type {
  WhisperWorkerOptions,
  WhisperResult,
  WhisperSegment,
} from '../workers';

export interface UseWhisperTranscriptionOptions {
  autoLoad?: boolean; // 是否自动加载模型
  model?: WhisperWorkerOptions['model'];
  language?: WhisperWorkerOptions['language'];
}

export interface UseWhisperTranscriptionReturn {
  // 状态
  state: TranscriptionState;
  isReady: boolean;
  isLoading: boolean;
  isTranscribing: boolean;
  error: string | null;

  // 结果
  result: WhisperResult | null;
  segments: WhisperSegment[];

  // 方法
  loadModel: () => Promise<void>;
  transcribe: (
    audio: AudioData,
    options?: WhisperWorkerOptions & {
      onProgress?: (progress: TranscriptionProgress) => void;
    }
  ) => Promise<{ result: WhisperResult; segments: WhisperSegment[] }>;
  cancel: () => Promise<void>;
  reset: () => void;
}

export function useWhisperTranscription(
  options: UseWhisperTranscriptionOptions = {}
): UseWhisperTranscriptionReturn {
  const { autoLoad = false, model, language } = options;

  // 状态
  const [state, setState] = useState<TranscriptionState>(WhisperManager.getState());
  const [result, setResult] = useState<WhisperResult | null>(null);
  const [segments, setSegments] = useState<WhisperSegment[]>([]);

  // 使用 ref 来跟踪是否已挂载
  const isMounted = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 订阅状态更新
  useEffect(() => {
    isMounted.current = true;

    unsubscribeRef.current = WhisperManager.subscribe((newState) => {
      if (isMounted.current) {
        setState(newState);
      }
    });

    return () => {
      isMounted.current = false;
      unsubscribeRef.current?.();
    };
  }, []);

  // 自动加载模型
  useEffect(() => {
    if (autoLoad && !state.isModelLoaded && !state.isProcessing) {
      loadModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  // 计算属性
  const isReady = state.isModelLoaded && !state.isProcessing;
  const isLoading = state.isProcessing && !state.isModelLoaded;
  const isTranscribing = state.isProcessing && state.isModelLoaded;

  // 加载模型
  const loadModel = useCallback(async () => {
    try {
      await WhisperManager.loadModel({ model, language });
    } catch (error) {
      // 错误已经在 state 中处理
      throw error;
    }
  }, [model, language]);

  // 转录
  const transcribe = useCallback(
    async (
      audio: AudioData,
      transcribeOptions?: WhisperWorkerOptions & {
        onProgress?: (progress: TranscriptionProgress) => void;
      }
    ) => {
      try {
        const response = await WhisperManager.transcribe(audio, {
          ...transcribeOptions,
          model: transcribeOptions?.model || model,
          language: transcribeOptions?.language || language,
        });

        if (isMounted.current) {
          setResult(response.result);
          setSegments(response.segments);
        }

        return response;
      } catch (error) {
        // 错误已经在 state 中处理
        throw error;
      }
    },
    [model, language]
  );

  // 取消
  const cancel = useCallback(async () => {
    try {
      await WhisperManager.cancel();
      if (isMounted.current) {
        setResult(null);
        setSegments([]);
      }
    } catch (error) {
      // 错误已经在 state 中处理
      throw error;
    }
  }, []);

  // 重置
  const reset = useCallback(() => {
    WhisperManager.reset();
    if (isMounted.current) {
      setResult(null);
      setSegments([]);
    }
  }, []);

  return {
    state,
    isReady,
    isLoading,
    isTranscribing,
    error: state.error,
    result,
    segments,
    loadModel,
    transcribe,
    cancel,
    reset,
  };
}
