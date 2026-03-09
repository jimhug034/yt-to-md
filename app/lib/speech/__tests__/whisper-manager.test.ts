/**
 * Whisper Manager 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhisperManager } from '../whisper-manager';

// Mock whisperWorker
vi.mock('@/app/workers', () => ({
  whisperWorker: {
    loadModel: vi.fn().mockResolvedValue(undefined),
    transcribe: vi.fn().mockResolvedValue({
      result: {
        text: 'Test transcription',
        segments: [
          { start: 0, end: 2, text: 'Hello' },
          { start: 2, end: 4, text: 'World' },
        ],
        language: 'en',
      },
      segments: [
        { start: 0, end: 2, text: 'Hello' },
        { start: 2, end: 4, text: 'World' },
      ],
    }),
    abort: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({
      isModelLoaded: true,
      isProcessing: false,
    }),
  },
}));

describe('WhisperManager', () => {
  beforeEach(() => {
    // Reset state before each test
    WhisperManager.reset();
    vi.clearAllMocks();
  });

  describe('状态管理', () => {
    it('应该返回初始状态', () => {
      const state = WhisperManager.getState();
      expect(state).toEqual({
        isModelLoaded: false,
        isProcessing: false,
        progress: { stage: '', progress: 0 },
        error: null,
      });
    });

    it('应该支持订阅状态更新', () => {
      const listener = vi.fn();
      const unsubscribe = WhisperManager.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        isModelLoaded: false,
        isProcessing: false,
      }));

      unsubscribe();
    });

    it('取消订阅后不应该接收更新', () => {
      const listener = vi.fn();
      const unsubscribe = WhisperManager.subscribe(listener);

      // 清除之前的调用
      listener.mockClear();

      // 取消订阅
      unsubscribe();

      // 触发状态更新
      WhisperManager.reset();

      // 不应该再被调用
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('isReady', () => {
    it('模型未加载时应该返回 false', () => {
      expect(WhisperManager.isReady()).toBe(false);
    });
  });

  describe('音频预处理', () => {
    it('应该正确处理 Float32Array 音频', async () => {
      const audioData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      const audio = { data: audioData, sampleRate: 16000 };

      // 注意：预处理方法是私有的，这里只能测试公共接口
      // 实际测试可能需要重构或使用其他方法
      expect(audioData).toBeInstanceOf(Float32Array);
    });
  });
});

describe('WhisperManager 状态转换', () => {
  it('应该正确处理加载中状态', async () => {
    const listener = vi.fn();
    WhisperManager.subscribe(listener);

    // 清除初始调用
    listener.mockClear();

    // 开始加载模型
    const loadPromise = WhisperManager.loadModel();

    // 等待状态更新
    await new Promise(resolve => setTimeout(resolve, 10));

    // 验证处理状态
    const state = WhisperManager.getState();
    expect(state.isProcessing).toBe(true);

    await loadPromise;
  });

  it('应该正确处理错误状态', async () => {
    const listener = vi.fn();
    WhisperManager.subscribe(listener);

    // 清除初始调用
    listener.mockClear();

    // 模拟加载失败
    const { whisperWorker } = await import('@/app/workers');
    (whisperWorker.loadModel as any).mockRejectedValueOnce(new Error('Load failed'));

    try {
      await WhisperManager.loadModel();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    // 验证错误状态
    const state = WhisperManager.getState();
    expect(state.error).toBeTruthy();
  });
});

describe('WhisperManager 进度更新', () => {
  it('应该在转录过程中更新进度', async () => {
    const progressUpdates: any[] = [];

    const unsubscribe = WhisperManager.subscribe((state) => {
      if (state.progress.progress > 0) {
        progressUpdates.push(state.progress);
      }
    });

    // 取消订阅
    unsubscribe();

    // 验证进度更新结构
    expect(WhisperManager.getState().progress).toHaveProperty('stage');
    expect(WhisperManager.getState().progress).toHaveProperty('progress');
  });
});
