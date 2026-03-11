/**
 * OCR Worker
 * 使用 PaddleOCR/Tesseract 进行文字识别的后台 Worker
 *
 * 这个 Worker 在独立线程中运行，执行图像文字识别任务，
 * 支持批量处理和多帧 OCR。
 */

import type { OcrResult, OcrBox } from "../lib/models/paddleocr";

// ============================================
// 消息类型定义
// ============================================

export interface OcrWorkerMessage {
  type: "recognize" | "recognizeBatch" | "loadModel" | "abort" | "getStatus";
  images?: Array<OcrImageInput>;
  imageUrl?: string;
  options?: OcrWorkerOptions;
  _id: number;
}

export interface OcrImageInput {
  imageData: Array<number>;
  width: number;
  height: number;
  timestamp?: number;
}

export interface OcrWorkerOptions {
  language?: "ch" | "en" | "korean" | "japan";
  detector?: string;
  recognizer?: string;
  mergeDuplicates?: boolean;
  minConfidence?: number;
  enableTextCleaning?: boolean;
}

export interface OcrWorkerResponse {
  type: "progress" | "result" | "batchResult" | "complete" | "error" | "status" | "aborted";
  progress?: number;
  stage?: "loadingModel" | "processing" | "complete";
  index?: number;
  result?: OcrFrameResult;
  results?: OcrFrameResult[];
  error?: string;
  isModelLoaded?: boolean;
  isProcessing?: boolean;
  _id: number;
}

export interface OcrFrameResult {
  text: string;
  confidence: number;
  boxes: OcrBox[];
  timestamp?: number;
  language: string;
  cleanedText?: string;
}

// ============================================
// Worker 状态管理
// ============================================

interface WorkerState {
  isModelLoaded: boolean;
  isProcessing: boolean;
  isAborted: boolean;
}

const state: WorkerState = {
  isModelLoaded: false,
  isProcessing: false,
  isAborted: false,
};

// OCR 模型实例
let ocrModel: any = null;

// 当前任务 ID
let currentJobId: number = 0;

// ============================================
// 消息处理
// ============================================

self.onmessage = async (e: MessageEvent<OcrWorkerMessage>) => {
  const message = e.data;
  const { type, _id } = message;

  currentJobId = _id;

  try {
    switch (type) {
      case "loadModel":
        await loadModel(message.options, _id);
        break;

      case "recognize":
        await recognize(message, _id);
        break;

      case "recognizeBatch":
        await recognizeBatch(message, _id);
        break;

      case "abort":
        abort(_id);
        break;

      case "getStatus":
        sendStatus(_id);
        break;

      default:
        sendError(`Unknown message type: ${(message as any).type}`, _id);
    }
  } catch (error) {
    sendError(error instanceof Error ? error.message : String(error), _id);
  }
};

// ============================================
// 功能函数
// ============================================

/**
 * 加载 OCR 模型
 */
async function loadModel(options?: OcrWorkerOptions, _id: number = 0): Promise<void> {
  if (state.isModelLoaded) {
    sendStatus(_id);
    return;
  }

  state.isProcessing = true;
  sendProgress(0, "loadingModel", undefined, _id);

  try {
    // 动态导入 OCR 模型
    const { getPaddleOCRModel } = await import("../lib/models/paddleocr");
    ocrModel = getPaddleOCRModel();

    // 设置进度回调
    ocrModel.onProgress((progress: number) => {
      if (!state.isAborted) {
        sendProgress(progress, "loadingModel", undefined, _id);
      }
    });

    // 加载模型
    await ocrModel.load(options);

    if (state.isAborted) {
      sendAborted(_id);
      return;
    }

    state.isModelLoaded = true;
    state.isProcessing = false;

    sendProgress(100, "loadingModel", undefined, _id);
    sendStatus(_id);
  } catch (error) {
    state.isProcessing = false;
    throw error;
  }
}

/**
 * 识别单个图像
 */
async function recognize(message: OcrWorkerMessage, _id: number = 0): Promise<void> {
  const { images, imageUrl, options } = message;

  if (!images?.length && !imageUrl) {
    throw new Error("No image data provided");
  }

  // 重置中止状态
  state.isAborted = false;
  state.isProcessing = true;

  try {
    // 确保模型已加载
    if (!state.isModelLoaded || !ocrModel) {
      await loadModel(options, _id);
      if (state.isAborted) {
        sendAborted(_id);
        return;
      }
    }

    sendProgress(0, "processing", undefined, _id);

    let imageSource: ImageData | string;

    if (images && images.length > 0) {
      const img = images[0];
      imageSource = new ImageData(new Uint8ClampedArray(img.imageData), img.width, img.height);
    } else {
      imageSource = imageUrl!;
    }

    // 执行 OCR
    const rawResult = await ocrModel.recognize(imageSource);

    if (state.isAborted) {
      sendAborted(_id);
      return;
    }

    // 应用文本清理
    let cleanedText = rawResult.text;
    if (options?.enableTextCleaning && rawResult.text) {
      cleanedText = await cleanOcrText(rawResult.text);
    }

    const result: OcrFrameResult = {
      text: rawResult.text,
      confidence: calculateAverageConfidence(rawResult.boxes),
      boxes: rawResult.boxes,
      language: rawResult.language,
      timestamp: images?.[0]?.timestamp,
      cleanedText,
    };

    state.isProcessing = false;

    sendProgress(100, "processing", undefined, _id);
    sendComplete([result], _id);
  } catch (error) {
    state.isProcessing = false;
    throw error;
  }
}

/**
 * 批量识别多个图像
 */
async function recognizeBatch(message: OcrWorkerMessage, _id: number = 0): Promise<void> {
  const { images, options } = message;

  if (!images || images.length === 0) {
    throw new Error("No images provided");
  }

  // 重置中止状态
  state.isAborted = false;
  state.isProcessing = true;

  try {
    // 确保模型已加载
    if (!state.isModelLoaded || !ocrModel) {
      await loadModel(options, _id);
      if (state.isAborted) {
        sendAborted(_id);
        return;
      }
    }

    const results: OcrFrameResult[] = [];
    const totalImages = images.length;

    for (let i = 0; i < totalImages; i++) {
      if (state.isAborted) {
        sendAborted(_id);
        return;
      }

      const img = images[i];
      const imageData = new ImageData(new Uint8ClampedArray(img.imageData), img.width, img.height);

      // 发送进度
      sendProgress((i / totalImages) * 100, "processing", i, _id);

      // 执行 OCR
      const rawResult = await ocrModel.recognize(imageData);

      // 应用文本清理
      let cleanedText = rawResult.text;
      if (options?.enableTextCleaning && rawResult.text) {
        cleanedText = await cleanOcrText(rawResult.text);
      }

      const result: OcrFrameResult = {
        text: rawResult.text,
        confidence: calculateAverageConfidence(rawResult.boxes),
        boxes: rawResult.boxes,
        language: rawResult.language,
        timestamp: img.timestamp,
        cleanedText,
      };

      results.push(result);

      // 发送中间结果
      sendProgress(((i + 1) / totalImages) * 100, "processing", i, _id);
    }

    // 合并重复文本（如果启用）
    let finalResults = results;
    if (options?.mergeDuplicates) {
      finalResults = await mergeDuplicateTexts(results);
    }

    state.isProcessing = false;

    sendProgress(100, "processing", undefined, _id);
    sendComplete(finalResults, _id);
  } catch (error) {
    state.isProcessing = false;
    throw error;
  }
}

/**
 * 中止当前处理
 */
function abort(_id: number = 0): void {
  state.isAborted = true;
  state.isProcessing = false;
  sendAborted(_id);
}

/**
 * 使用 WASM 清理 OCR 文本
 */
async function cleanOcrText(text: string): Promise<string> {
  try {
    const { cleanOcrTextWASM } = await import("../lib/wasm");
    return await cleanOcrTextWASM(text);
  } catch {
    // 如果 WASM 不可用，返回原始文本
    return text;
  }
}

/**
 * 计算平均置信度
 */
function calculateAverageConfidence(boxes: OcrBox[]): number {
  if (!boxes || boxes.length === 0) return 0;
  const sum = boxes.reduce((acc, box) => acc + box.score, 0);
  return sum / boxes.length;
}

/**
 * 合并重复文本
 */
async function mergeDuplicateTexts(results: OcrFrameResult[]): Promise<OcrFrameResult[]> {
  const uniqueTexts = new Set<string>();
  const seenHashes = new Set<string>();

  return results.filter((result) => {
    if (!result.text) return true;

    // 创建文本的简单哈希
    const normalized = result.text.toLowerCase().replace(/\s+/g, "");
    const hash = `${normalized}_${Math.floor(result.confidence * 10)}`;

    if (seenHashes.has(hash)) {
      return false;
    }

    seenHashes.add(hash);
    uniqueTexts.add(result.text);
    return true;
  });
}

/**
 * 发送进度更新
 */
function sendProgress(
  progress: number,
  stage: "loadingModel" | "processing",
  index?: number,
  _id: number = 0,
): void {
  const response: OcrWorkerResponse = {
    type: "progress",
    progress,
    stage,
    index,
    _id,
  };
  self.postMessage(response);
}

/**
 * 发送完成结果
 */
function sendComplete(results: OcrFrameResult[], _id: number = 0): void {
  const response: OcrWorkerResponse = {
    type: "complete",
    results,
    _id,
  };
  self.postMessage(response);
}

/**
 * 发送状态
 */
function sendStatus(_id: number = 0): void {
  const response: OcrWorkerResponse = {
    type: "status",
    isModelLoaded: state.isModelLoaded,
    isProcessing: state.isProcessing,
    _id,
  };
  self.postMessage(response);
}

/**
 * 发送中止通知
 */
function sendAborted(_id: number = 0): void {
  const response: OcrWorkerResponse = {
    type: "aborted",
    _id,
  };
  self.postMessage(response);
}

/**
 * 发送错误
 */
function sendError(error: string, _id: number = 0): void {
  const response: OcrWorkerResponse = {
    type: "error",
    error,
    _id,
  };
  self.postMessage(response);
}

// 导出类型供外部使用（已在文件顶部定义，无需重复导出）
