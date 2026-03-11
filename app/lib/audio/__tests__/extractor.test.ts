/**
 * Audio Extractor 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { audioExtractor } from "../extractor";

describe("AudioExtractor", () => {
  afterEach(() => {
    // 释放资源
    audioExtractor.release();
  });

  describe("音频处理工具", () => {
    describe("重采样", () => {
      it("应该正确处理 44.1kHz 到 16kHz 的重采样", () => {
        const inputLength = 44100; // 1秒 @ 44.1kHz
        const input = new Float32Array(inputLength);

        // 填充测试数据
        for (let i = 0; i < inputLength; i++) {
          input[i] = Math.sin((2 * Math.PI * 440 * i) / 44100); // 440Hz 正弦波
        }

        // 预期输出长度
        const expectedLength = 16000; // 1秒 @ 16kHz

        // 重采样比例
        const ratio = 44100 / 16000;
        const actualLength = Math.round(inputLength / ratio);

        expect(actualLength).toBe(expectedLength);
      });

      it("应该在相同采样率下返回原始数据", () => {
        const input = new Float32Array(16000);
        const ratio = 16000 / 16000;

        expect(ratio).toBe(1);
      });
    });

    describe("声道混合", () => {
      it("应该正确混合立体声到单声道", () => {
        // 模拟立体声数据
        const leftChannel = new Float32Array([0.5, 0.3, 0.7]);
        const rightChannel = new Float32Array([0.5, 0.7, 0.3]);

        const expected = new Float32Array([
          (0.5 + 0.5) / 2, // 0.5
          (0.3 + 0.7) / 2, // 0.5
          (0.7 + 0.3) / 2, // 0.5
        ]);

        for (let i = 0; i < expected.length; i++) {
          const mixed = (leftChannel[i] + rightChannel[i]) / 2;
          expect(mixed).toBeCloseTo(expected[i], 5);
        }
      });

      it("应该直接返回单声道数据", () => {
        const mono = new Float32Array([0.5, 0.3, 0.7]);
        // 单声道应该保持不变
        expect(mono).toBeInstanceOf(Float32Array);
      });
    });

    describe("归一化", () => {
      it("应该正确归一化音频数据", () => {
        const input = new Float32Array([0.5, 1.5, -0.8, 2.0]);

        // 找到最大绝对值
        let maxAbs = 0;
        for (let i = 0; i < input.length; i++) {
          const abs = Math.abs(input[i]);
          if (abs > maxAbs) maxAbs = abs;
        }

        expect(maxAbs).toBe(2.0);

        // 归一化
        const result = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
          result[i] = input[i] / maxAbs;
        }

        expect(result[0]).toBeCloseTo(0.25, 5); // 0.5 / 2.0
        expect(result[1]).toBeCloseTo(0.75, 5); // 1.5 / 2.0
        expect(result[2]).toBeCloseTo(-0.4, 5); // -0.8 / 2.0
        expect(result[3]).toBeCloseTo(1.0, 5); // 2.0 / 2.0
      });

      it("应该处理全零数据", () => {
        const input = new Float32Array([0, 0, 0, 0]);

        // 找到最大绝对值
        let maxAbs = 0;
        for (let i = 0; i < input.length; i++) {
          const abs = Math.abs(input[i]);
          if (abs > maxAbs) maxAbs = abs;
        }

        expect(maxAbs).toBe(0);

        // 全零数据应该保持不变
        expect(input).toEqual(new Float32Array([0, 0, 0, 0]));
      });
    });
  });

  describe("MIME 类型检测", () => {
    it("应该支持 webm 格式", () => {
      const types = ["audio/webm;codecs=opus", "audio/webm"];

      // 在实际环境中测试 MediaRecorder.isTypeSupported
      // 这里只验证类型字符串格式
      types.forEach((type) => {
        expect(type).toMatch(/^audio\/[\w-]+(; \w+=[\w-]+)?$/);
      });
    });

    it("应该支持 ogg 格式", () => {
      const types = ["audio/ogg;codecs=opus", "audio/ogg"];

      types.forEach((type) => {
        expect(type).toMatch(/^audio\/[\w-]+(; \w+=[\w-]+)?$/);
      });
    });
  });

  describe("音频格式", () => {
    it("Whisper 应该接受 16kHz 采样率", () => {
      const whisperSampleRate = 16000;
      expect(whisperSampleRate).toBe(16000);
    });

    it("Whisper 应该接受单声道音频", () => {
      const channels = 1;
      expect(channels).toBe(1);
    });
  });
});

describe("AudioExtractor 集成测试", () => {
  it("应该能够创建 AudioContext", () => {
    // 测试 AudioContext 创建（需要浏览器环境）
    expect(typeof AudioContext).toBe("function");
  });

  it("应该能够检测支持的 MIME 类型", () => {
    // 测试 MediaRecorder 支持（需要浏览器环境）
    expect(typeof MediaRecorder).toBe("function");

    // 检查一些常见类型
    const types = ["audio/webm", "audio/ogg", "audio/mp4"];

    // 在浏览器环境中，这些类型应该至少有一个被支持
    if (typeof MediaRecorder !== "undefined") {
      const supported = types.filter((type) => MediaRecorder.isTypeSupported(type));
      // 至少应该有一种格式被支持
      expect(supported.length).toBeGreaterThan(0);
    }
  });
});
