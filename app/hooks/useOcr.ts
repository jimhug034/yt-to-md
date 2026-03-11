/**
 * useOcr Hook
 *
 * React Hook 用于 OCR 文字识别
 * 提供状态管理和识别方法
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { OcrManager } from "../lib/ocr";
import type { OcrState, OcrProgress, FrameInput } from "../lib/ocr";
import type { OcrWorkerOptions } from "../workers/ocr.worker";

export interface UseOcrOptions {
  autoLoad?: boolean; // 是否自动加载模型
  language?: OcrWorkerOptions["language"];
}

export interface UseOcrReturn {
  // 状态
  state: OcrState;
  isReady: boolean;
  isLoading: boolean;
  isRecognizing: boolean;
  error: string | null;

  // 进度
  progress: OcrProgress;

  // 方法
  loadModel: () => Promise<void>;
  recognizeFrame: (
    frame: FrameInput,
    options?: OcrWorkerOptions & {
      onProgress?: (progress: OcrProgress) => void;
    },
  ) => Promise<{ text: string; confidence: number; timestamp?: number }>;
  recognizeBatch: (
    frames: FrameInput[],
    options?: OcrWorkerOptions & {
      onProgress?: (progress: OcrProgress) => void;
    },
  ) => Promise<Array<{ text: string; confidence: number; timestamp?: number }>>;
  cancel: () => Promise<void>;
  reset: () => void;
}

export function useOcr(options: UseOcrOptions = {}): UseOcrReturn {
  const { autoLoad = false, language } = options;

  // 状态
  const [state, setState] = useState<OcrState>(OcrManager.getState());

  // 使用 ref 来跟踪是否已挂载
  const isMounted = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 订阅状态更新
  useEffect(() => {
    isMounted.current = true;

    unsubscribeRef.current = OcrManager.subscribe((newState) => {
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
  const isRecognizing = state.isProcessing && state.isModelLoaded;

  // 加载模型
  const loadModel = useCallback(async () => {
    try {
      await OcrManager.loadModel({ language });
    } catch (error) {
      // 错误已经在 state 中处理
      throw error;
    }
  }, [language]);

  // 单帧识别
  const recognizeFrame = useCallback(
    async (
      frame: FrameInput,
      recognizeOptions?: OcrWorkerOptions & {
        onProgress?: (progress: OcrProgress) => void;
      },
    ) => {
      try {
        const response = await OcrManager.recognizeFrame(frame, {
          ...recognizeOptions,
          language: recognizeOptions?.language || language,
        });

        return response;
      } catch (error) {
        // 错误已经在 state 中处理
        throw error;
      }
    },
    [language],
  );

  // 批量识别
  const recognizeBatch = useCallback(
    async (
      frames: FrameInput[],
      recognizeOptions?: OcrWorkerOptions & {
        onProgress?: (progress: OcrProgress) => void;
      },
    ) => {
      try {
        const response = await OcrManager.recognizeBatch(frames, {
          ...recognizeOptions,
          language: recognizeOptions?.language || language,
        });

        return response;
      } catch (error) {
        // 错误已经在 state 中处理
        throw error;
      }
    },
    [language],
  );

  // 取消
  const cancel = useCallback(async () => {
    try {
      await OcrManager.cancel();
    } catch (error) {
      // 错误已经在 state 中处理
      throw error;
    }
  }, []);

  // 重置
  const reset = useCallback(() => {
    OcrManager.reset();
  }, []);

  return {
    state,
    isReady,
    isLoading,
    isRecognizing,
    error: state.error,
    progress: state.progress,
    loadModel,
    recognizeFrame,
    recognizeBatch,
    cancel,
    reset,
  };
}
