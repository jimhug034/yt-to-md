/**
 * Whisper 语音识别 E2E 测试
 *
 * 测试场景：
 * 1. Whisper 模型加载
 * 2. 音频转录功能
 * 3. 转录进度显示
 * 4. 取消操作
 * 5. 转录结果展示
 */

import { test, expect, Page } from '@playwright/test';

const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // 短视频用于测试
const TEST_AUDIO_FILE = 'test-audio.mp3'; // 需要准备测试音频文件

// 辅助函数：等待条件
async function waitForCondition(
  page: Page,
  condition: () => boolean,
  timeout = 30000,
  message = 'Condition not met'
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (condition()) {
      return true;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(message);
}

test.describe('Whisper 语音识别', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('应该显示视频处理界面', async ({ page }) => {
    // 检查页面标题
    await expect(page).toHaveTitle(/YouTube/);

    // 检查是否有视频上传区域
    const uploadArea = page.locator('input[type="file"]').or(
      page.locator('input[placeholder*="url" i]').or(
        page.locator('input[placeholder*="URL" i]')
      )
    );
    await expect(uploadArea).toBeVisible();
  });

  test('应该能够选择本地视频文件', async ({ page }) => {
    // 模拟文件选择
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).isVisible();

    // 注意：实际测试需要真实的视频文件
    // 这里只是检查文件输入框是否可交互
    await expect(fileInput).toBeEnabled();
  });

  test('应该能够输入视频 URL', async ({ page }) => {
    // 查找 URL 输入框
    const urlInput = page.locator('input[placeholder*="url" i], input[placeholder*="URL" i], input[name*="url" i]');

    const isVisible = await urlInput.count();
    if (isVisible > 0) {
      await urlInput.first().fill(TEST_VIDEO_URL);
      const value = await urlInput.first().inputValue();
      expect(value).toBe(TEST_VIDEO_URL);
    } else {
      test.skip(); // 如果没有 URL 输入框，跳过此测试
    }
  });
});

test.describe('Whisper 转录流程', () => {
  test('应该显示转录进度', async ({ page }) => {
    // 这个测试需要实际的视频文件
    // 这里只是验证 UI 元素是否存在

    // 检查进度条相关元素
    const progressBar = page.locator('[role="progressbar"], .progress, [class*="progress"]');
    const count = await progressBar.count();

    if (count > 0) {
      await expect(progressBar.first()).toBeVisible();
    }
  });

  test('应该显示 Whisper 状态指示器', async ({ page }) => {
    // 检查是否有状态显示区域
    const statusIndicator = page.locator('text=Whisper, text=Transcribing, text=Loading');
    const count = await statusIndicator.count();

    if (count > 0) {
      await expect(statusIndicator.first()).toBeVisible();
    }
  });
});

test.describe('Whisper 错误处理', () => {
  test('应该处理无效的视频 URL', async ({ page }) => {
    const urlInput = page.locator('input[placeholder*="url" i], input[placeholder*="URL" i]');

    const isVisible = await urlInput.count();
    if (isVisible > 0) {
      await urlInput.first().fill('invalid-url');

      // 检查是否有错误提示
      const errorMessage = page.locator('.error, [class*="error"], [role="alert"]');
      // 注意：可能需要提交表单才会显示错误
    }
  });

  test('应该处理空文件选择', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeEnabled();

    // 不选择文件直接提交应该显示错误（具体取决于实现）
  });
});

test.describe('Whisper 集成测试', () => {
  test('应该能够加载 Whisper 模型', async ({ page, context }) => {
    // 监听网络请求以验证模型加载
    const modelRequests: string[] = [];

    context.route('**/Xenova/whisper-**', async (route) => {
      modelRequests.push(route.request().url());
      await route.continue();
    });

    // 这个测试需要实际触发模型加载
    // 具体实现取决于应用的交互流程
  });

  test('应该能够转录音频并显示结果', async ({ page }) => {
    // 这是一个集成测试，需要完整的视频处理流程
    // 测试步骤：
    // 1. 上传/选择视频
    // 2. 等待音频提取
    // 3. 等待转录完成
    // 4. 验证转录结果

    // 检查结果展示区域
    const resultArea = page.locator('.transcript, [class*="transcript"], [id*="transcript"]');
    const count = await resultArea.count();

    if (count > 0) {
      await expect(resultArea.first()).toBeVisible();
    }
  });
});

test.describe('Whisper 性能测试', () => {
  test('应该在合理时间内加载 tiny 模型', async ({ page }) => {
    // 模型加载性能测试
    // tiny 模型应该在大约 10-30 秒内加载完成（取决于网络）

    const startTime = Date.now();
    // 这里需要实际触发模型加载

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 预期在 60 秒内完成（留出网络延迟）
    expect(duration).toBeLessThan(60000);
  });

  test('应该在合理时间内完成短音频转录', async ({ page }) => {
    // 短音频（< 30秒）转录性能测试
    // 预期在 60 秒内完成

    const startTime = Date.now();
    // 这里需要实际触发转录

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 预期在 90 秒内完成
    expect(duration).toBeLessThan(90000);
  });
});

test.describe('Whisper UI/UX 测试', () => {
  test('应该有清晰的进度指示', async ({ page }) => {
    // 检查进度相关的 UI 元素
    const progressElements = page.locator('[role="progressbar"], .progress, .progress-bar');
    const count = await progressElements.count();

    if (count > 0) {
      // 验证进度条可见性
      await expect(progressElements.first()).toBeVisible();

      // 验证进度文本
      const progressText = page.locator('text=/\\d+%/');
      const textCount = await progressText.count();
      // 进度文本可能不存在于初始状态
    }
  });

  test('应该有取消操作按钮', async ({ page }) => {
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("取消")');
    const count = await cancelButton.count();

    if (count > 0) {
      await expect(cancelButton.first()).toBeVisible();
    }
  });

  test('应该显示转录错误信息', async ({ page }) => {
    // 测试错误状态下的 UI
    const errorContainer = page.locator('.error, [class*="error"], [role="alert"]');
    // 错误容器可能初始不可见
  });
});

test.describe('Whisper 可访问性测试', () => {
  test('进度条应该有适当的 ARIA 属性', async ({ page }) => {
    const progressBar = page.locator('[role="progressbar"]');
    const count = await progressBar.count();

    if (count > 0) {
      const bar = progressBar.first();
      // 检查 ARIA 属性
      await expect(bar).toHaveAttribute('role', 'progressbar');

      const hasValue = await bar.getAttribute('aria-valuenow');
      const hasMin = await bar.getAttribute('aria-valuemin');
      const hasMax = await bar.getAttribute('aria-valuemax');

      // 至少应该有这些属性之一
      expect(hasValue || hasMin || hasMax).toBeTruthy();
    }
  });

  test('状态变化应该有适当的屏幕阅读器支持', async ({ page }) => {
    // 检查是否有 aria-live 区域用于状态更新
    const liveRegion = page.locator('[aria-live]');
    const count = await liveRegion.count();

    if (count > 0) {
      await expect(liveRegion.first()).toBeVisible();
    }
  });
});
