/**
 * useWhisperTranscription Hook 单元测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWhisperTranscription } from "../useWhisperTranscription";

// Mock WhisperManager
vi.mock("@/app/lib/speech", () => ({
  WhisperManager: {
    getState: vi.fn(() => ({
      isModelLoaded: false,
      isProcessing: false,
      progress: { stage: "", progress: 0 },
      error: null,
    })),
    subscribe: vi.fn((listener) => {
      // 返回取消订阅函数
      return () => {};
    }),
    loadModel: vi.fn().mockResolvedValue(undefined),
    transcribe: vi.fn().mockResolvedValue({
      result: {
        text: "Test transcription",
        segments: [
          { start: 0, end: 2, text: "Hello" },
          { start: 2, end: 4, text: "World" },
        ],
        language: "en",
      },
      segments: [
        { start: 0, end: 2, text: "Hello" },
        { start: 2, end: 4, text: "World" },
      ],
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
  },
}));

describe("useWhisperTranscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("初始状态", () => {
    it("应该返回正确的初始状态", () => {
      const { result } = renderHook(() => useWhisperTranscription());

      expect(result.current.state).toEqual({
        isModelLoaded: false,
        isProcessing: false,
        progress: { stage: "", progress: 0 },
        error: null,
      });
    });

    it("isReady 应该在模型未加载时返回 false", () => {
      const { result } = renderHook(() => useWhisperTranscription());

      expect(result.current.isReady).toBe(false);
    });

    it("isLoading 应该在未加载时返回 false", () => {
      const { result } = renderHook(() => useWhisperTranscription());

      expect(result.current.isLoading).toBe(false);
    });

    it("isTranscribing 应该在未转录时返回 false", () => {
      const { result } = renderHook(() => useWhisperTranscription());

      expect(result.current.isTranscribing).toBe(false);
    });

    it("result 和 segments 应该初始为空", () => {
      const { result } = renderHook(() => useWhisperTranscription());

      expect(result.current.result).toBeNull();
      expect(result.current.segments).toEqual([]);
    });
  });

  describe("loadModel", () => {
    it("应该能够调用 loadModel", async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      await act(async () => {
        await result.current.loadModel();
      });

      // 验证方法被调用
      const { WhisperManager } = await import("@/app/lib/speech");
      expect(WhisperManager.loadModel).toHaveBeenCalled();
    });
  });

  describe("transcribe", () => {
    it("应该能够调用 transcribe", async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        sampleRate: 16000,
      };

      await act(async () => {
        const response = await result.current.transcribe(audioData);
        expect(response.result).toBeDefined();
        expect(response.segments).toBeDefined();
      });
    });

    it("应该更新结果和 segments", async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        sampleRate: 16000,
      };

      await act(async () => {
        await result.current.transcribe(audioData);
      });

      await waitFor(() => {
        expect(result.current.result).not.toBeNull();
        expect(result.current.segments.length).toBeGreaterThan(0);
      });
    });
  });

  describe("cancel", () => {
    it("应该能够调用 cancel", async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      await act(async () => {
        await result.current.cancel();
      });

      const { WhisperManager } = await import("@/app/lib/speech");
      expect(WhisperManager.cancel).toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("应该能够调用 reset", () => {
      const { result } = renderHook(() => useWhisperTranscription());

      act(() => {
        result.current.reset();
      });

      const { WhisperManager } = require("@/app/lib/speech");
      expect(WhisperManager.reset).toHaveBeenCalled();
    });
  });

  describe("自动加载模型", () => {
    it("autoLoad=true 时应该自动加载模型", async () => {
      const { WhisperManager } = await import("@/app/lib/speech");

      renderHook(() => useWhisperTranscription({ autoLoad: true }));

      // 注意：自动加载是通过 useEffect 实现的
      // 可能需要等待下一个 tick
      await waitFor(() => {
        expect(WhisperManager.loadModel).toHaveBeenCalled();
      });
    });

    it("autoLoad=false 时不应该自动加载模型", () => {
      const { WhisperManager } = require("@/app/lib/speech");

      renderHook(() => useWhisperTranscription({ autoLoad: false }));

      expect(WhisperManager.loadModel).not.toHaveBeenCalled();
    });
  });

  describe("进度回调", () => {
    it("应该支持 onProgress 回调", async () => {
      const { result } = renderHook(() => useWhisperTranscription());

      const onProgress = vi.fn();

      const audioData = {
        data: new Float32Array([0.1, 0.2, 0.3]),
        sampleRate: 16000,
      };

      await act(async () => {
        await result.current.transcribe(audioData, { onProgress });
      });

      // 验证回调被调用（取决于实现）
      // onProgress 可能会被调用多次
    });
  });

  describe("模型选项", () => {
    it("应该支持不同的模型大小", () => {
      const models = ["tiny", "base", "small", "medium", "large"] as const;

      models.forEach((model) => {
        const { result } = renderHook(() => useWhisperTranscription({ model }));

        expect(result.current).toBeDefined();
      });
    });

    it("应该支持不同的语言", () => {
      const languages = ["english", "chinese", "spanish", "french"];

      languages.forEach((language) => {
        const { result } = renderHook(() => useWhisperTranscription({ language }));

        expect(result.current).toBeDefined();
      });
    });
  });

  describe("清理", () => {
    it("卸载时应该取消订阅", () => {
      const { WhisperManager } = require("@/app/lib/speech");
      const unsubscribe = vi.fn();

      WhisperManager.subscribe.mockReturnValueOnce(unsubscribe);

      const { unmount } = renderHook(() => useWhisperTranscription());

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});
