/**
 * OCR Processor Worker
 * 处理图像文字识别任务
 */

import { getPaddleOCRModel, recognizeWithTesseract } from '../lib/models/paddleocr';

export interface OcrProcessorMessage {
  type: 'recognize' | 'recognizeBatch' | 'loadModel';
  images?: Array<{ imageData: number[]; width: number; height: number }>;
  imageUrl?: string;
  language?: string;
}

export interface OcrProcessorResponse {
  type: 'progress' | 'result' | 'batchResult' | 'error';
  progress?: number;
  result?: string;
  results?: string[];
  error?: string;
}

let ocrModel: any = null;

self.onmessage = async (e: MessageEvent<OcrProcessorMessage>) => {
  const message = e.data;

  try {
    switch (message.type) {
      case 'loadModel': {
        await loadModel(message);
        break;
      }
      case 'recognize': {
        await recognizeImage(message);
        break;
      }
      case 'recognizeBatch': {
        await recognizeBatch(message);
        break;
      }
      default:
        self.postMessage({
          type: 'error',
          error: `Unknown message type: ${message.type}`,
        } as OcrProcessorResponse);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    } as OcrProcessorResponse);
  }
};

async function loadModel(message: OcrProcessorMessage) {
  if (!ocrModel) {
    ocrModel = getPaddleOCRModel();

    ocrModel.onProgress((progress: number) => {
      self.postMessage({
        type: 'progress',
        progress,
      } as OcrProcessorResponse);
    });

    await ocrModel.load({ language: message.language || 'en' });
  }

  self.postMessage({
    type: 'result',
    result: 'Model loaded',
  } as OcrProcessorResponse);
}

async function recognizeImage(message: OcrProcessorMessage) {
  const { images, imageUrl } = message;

  let imageSource: ImageData | Blob | string;

  if (images && images.length > 0) {
    // 从 imageData 创建 ImageData 对象
    const img = images[0];
    imageSource = new ImageData(
      new Uint8ClampedArray(img.imageData),
      img.width,
      img.height
    );
  } else if (imageUrl) {
    imageSource = imageUrl;
  } else {
    throw new Error('No image data provided');
  }

  let result = '';

  if (ocrModel) {
    const ocrResult = await ocrModel.recognize(imageSource as ImageData | Blob);
    result = ocrResult.text;
  } else {
    // 使用 Tesseract 作为后备
    // Tesseract 需要 ImageData | HTMLImageElement | Blob，如果是 URL 则跳过
    // @ts-ignore
    if (imageSource instanceof ImageData || imageSource instanceof Blob) {
      result = await recognizeWithTesseract(imageSource, message.language || 'eng');
    }
  }

  self.postMessage({
    type: 'result',
    result,
  } as OcrProcessorResponse);
}

async function recognizeBatch(message: OcrProcessorMessage) {
  const { images } = message;

  if (!images || images.length === 0) {
    throw new Error('No images provided');
  }

  const results: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const imageData = new ImageData(
      new Uint8ClampedArray(img.imageData),
      img.width,
      img.height
    );

    let result = '';
    if (ocrModel) {
      const ocrResult = await ocrModel.recognize(imageData);
      result = ocrResult.text;
    } else {
      result = await recognizeWithTesseract(imageData, message.language || 'eng');
    }

    results.push(result);

    self.postMessage({
      type: 'progress',
      progress: ((i + 1) / images.length) * 100,
    } as OcrProcessorResponse);
  }

  self.postMessage({
    type: 'batchResult',
    results,
  } as OcrProcessorResponse);
}

