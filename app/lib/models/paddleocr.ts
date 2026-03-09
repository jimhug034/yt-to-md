/**
 * PaddleOCR Integration
 * 使用 PaddleOCR WASM 进行文字识别
 */

import { pipeline, env } from '@xenova/transformers';

// 配置 transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface OcrOptions {
  language?: 'ch' | 'en' | 'korean' | 'japan';
  detector?: string;
  recognizer?: string;
  orientationDetector?: string;
}

export interface OcrBox {
  text: string;
  box: number[][];
  score: number;
}

export interface OcrResult {
  text: string;
  boxes: OcrBox[];
  language: string;
}

export class PaddleOCRModel {
  private ocr: any = null;
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private progressCallback: ((progress: number) => void) | null = null;

  async load(options: OcrOptions = {}): Promise<void> {
    if (this.isLoaded || this.isLoading) return;

    this.isLoading = true;

    try {
      // 使用 transformers.js 的 OCR pipeline
      // @ts-ignore - transformers.js type issue
      this.ocr = await pipeline(
        // @ts-ignore
        'image-text-to-text',
        'Xenova/trocr-base-handwritten', // 或其他合适的模型
        {
          progress_callback: (progress: any) => {
            if (this.progressCallback && progress.status === 'progress') {
              this.progressCallback(progress.progress || 0);
            }
          },
        }
      );

      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load OCR model:', error);
      // OCR 加载失败不应该阻止整个流程
      this.isLoaded = false;
    } finally {
      this.isLoading = false;
    }
  }

  onProgress(callback: (progress: number) => void) {
    this.progressCallback = callback;
  }

  async recognize(imageData: ImageData | HTMLImageElement | Blob): Promise<OcrResult> {
    if (!this.isLoaded) {
      await this.load();
    }

    if (!this.ocr) {
      return { text: '', boxes: [], language: 'en' };
    }

    try {
      let imageSource: string | Blob;

      if (imageData instanceof ImageData) {
        // 转换 ImageData 到 Blob
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx?.putImageData(imageData, 0, 0);
        imageSource = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png');
        });
      } else if (imageData instanceof Blob) {
        imageSource = imageData;
      } else {
        imageSource = imageData.src;
      }

      const output = await this.ocr(imageSource);

      return {
        text: output?.[0]?.generated_text || '',
        boxes: [],
        language: 'en',
      };
    } catch (error) {
      console.error('OCR recognition failed:', error);
      return { text: '', boxes: [], language: 'en' };
    }
  }

  async recognizeBatch(
    images: (ImageData | HTMLImageElement | Blob)[]
  ): Promise<OcrResult[]> {
    const results: OcrResult[] = [];

    for (const image of images) {
      const result = await this.recognize(image);
      results.push(result);
    }

    return results;
  }

  release() {
    this.ocr = null;
    this.isLoaded = false;
  }
}

// 单例
export let paddleOcrModel: PaddleOCRModel | null = null;

export function getPaddleOCRModel(): PaddleOCRModel {
  if (!paddleOcrModel) {
    paddleOcrModel = new PaddleOCRModel();
  }
  return paddleOcrModel;
}

export function releasePaddleOCRModel() {
  paddleOcrModel?.release();
  paddleOcrModel = null;
}

/**
 * 使用 Tesseract.js 作为备选方案
 */
export async function recognizeWithTesseract(
  image: ImageData | HTMLImageElement | Blob,
  language = 'eng+chi_sim'
): Promise<string> {
  try {
    // @ts-ignore - tesseract.js is optional
    const Tesseract = await import('tesseract.js');

    let imageSource: string | Blob;

    if (image instanceof ImageData) {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx?.putImageData(image, 0, 0);
      imageSource = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
    } else if (image instanceof Blob) {
      imageSource = image;
    } else {
      // HTMLImageElement
      imageSource = image.src;
    }

    const result = await Tesseract.recognize(imageSource, language);
    return result.data.text;
  } catch (error) {
    console.error('Tesseract OCR failed:', error);
    return '';
  }
}
