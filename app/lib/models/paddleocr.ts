/**
 * Rust OCR WASM 绑定
 *
 * 导出 Rust OCR 模块的类型和函数
 */

import { OcrProcessor } from "../../../wasm/pkg";

// ============================================
// 类型定义
// ============================================

export interface OcrBox {
  text: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  score: number;
}

export interface OcrResult {
  text: string;
  boxes: OcrBox[];
  language: string;
}

export interface OcrOptions {
  language?: "ch" | "en" | "korean" | "japan" | "auto";
  minConfidence?: number;
  mergeDuplicates?: boolean;
  enableTextCleaning?: boolean;
}

// ============================================
// OCR 模型类
// ============================================

class RustOcrModel {
  private processor: OcrProcessor;

  constructor(language: string = "auto") {
    this.processor = new OcrProcessor(language);
  }

  /**
   * 解析 OCR JSON 结果
   */
  parseOcrResult(resultJson: string): OcrResult {
    const parsed = this.processor.parse_ocr_result(resultJson);
    return JSON.parse(parsed);
  }

  /**
   * 清理 OCR 文本
   */
  cleanOcrText(text: string): string {
    return this.processor.clean_ocr_text(text);
  }

  /**
   * 合并多帧文本
   */
  mergeFrameTexts(ocrResults: string): string {
    return this.processor.merge_frame_texts(ocrResults);
  }

  /**
   * 释放资源
   */
  terminate(): void {
    // Rust 端不需要显式释放
  }
}

// ============================================
// 单例导出
// ============================================

let ocrModel: RustOcrModel | null = null;

export function getPaddleOCRModel(): RustOcrModel {
  if (!ocrModel) {
    ocrModel = new RustOcrModel();
  }
  return ocrModel;
}

export function releasePaddleOCRModel(): void {
  ocrModel = null;
}

// 导出类型（已经在顶部定义，这里不需要重复导出）
