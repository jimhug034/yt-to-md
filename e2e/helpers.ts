/**
 * E2E Test Helpers
 *
 * Reusable utilities and page object models for testing
 * YouTube Subtitle to Markdown converter
 */

import { Page, Locator, expect } from "@playwright/test";

// Test constants
export const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=7xTGNNLPyMI";
export const TEST_VIDEO_SHORT_URL = "https://youtu.be/7xTGNNLPyMI";
export const TEST_VIDEO_ID = "7xTGNNLPyMI";
export const BASE_URL = "http://localhost:3000";

// i18n paths
export const EN_PATH = "/en";
export const ZH_CN_PATH = "/zh-CN";

/**
 * Page Object Model for the YouTube Subtitle to Markdown app
 */
export class AppPage {
  readonly page: Page;
  readonly urlInput: Locator;
  readonly convertButton: Locator;
  readonly languageSelect: Locator;
  readonly copyButton: Locator;
  readonly downloadButton: Locator;
  readonly newVideoButton: Locator;
  readonly languageSwitcherButton: Locator;
  readonly errorAlert: Locator;
  readonly dismissButton: Locator;
  readonly headerTitle: Locator;
  readonly heroTitle: Locator;
  readonly markdownPreview: Locator;

  constructor(page: Page) {
    this.page = page;

    // Input elements
    this.urlInput = page.getByPlaceholder(/youtube/i);
    this.convertButton = page.getByRole("button", { name: /convert|loading/i });

    // Language selection
    this.languageSelect = page.locator("#language-select");

    // Action buttons
    this.copyButton = page.getByRole("button", { name: /copy|copied/i });
    this.downloadButton = page.getByRole("button", { name: /download/i });
    this.newVideoButton = page.getByRole("button", { name: /new video|new/i });
    this.languageSwitcherButton = page
      .getByRole("button")
      .filter({ hasText: /中文|english|globe/i });

    // Error handling
    this.errorAlert = page
      .locator("div")
      .filter({ hasText: /^Invalid/ })
      .or(page.locator(".bg-red-50, .bg-red-900\\/20"));
    this.dismissButton = page.getByRole("button", { name: /dismiss/i });

    // Content elements
    this.headerTitle = page.locator("h1");
    this.heroTitle = page.locator("main h2").first();
    this.markdownPreview = page.locator(".prose, .dark\\:prose-invert");
  }

  /**
   * Navigate to the app's base URL
   */
  async goto(locale = "en") {
    const path = locale === "en" ? EN_PATH : ZH_CN_PATH;
    await this.page.goto(BASE_URL + path);
  }

  /**
   * Enter a video URL and submit
   */
  async enterVideoUrl(url: string) {
    await this.urlInput.fill(url);
    await this.convertButton.click();
  }

  /**
   * Wait for video info card to appear
   */
  async waitForVideoInfo() {
    await this.page.waitForSelector('img[alt*=""]', { timeout: 15000 });
  }

  /**
   * Wait for language selector to appear
   */
  async waitForLanguageSelector() {
    await this.page.waitForSelector("#language-select", { timeout: 15000 });
  }

  /**
   * Wait for markdown preview to appear
   */
  async waitForMarkdownPreview() {
    await this.page.waitForSelector(".prose, .dark\\:prose-invert", { timeout: 30000 });
  }

  /**
   * Select a subtitle language
   */
  async selectLanguage(languageCode: string) {
    await this.waitForLanguageSelector();
    await this.languageSelect.selectOption(languageCode);
  }

  /**
   * Get available language options
   */
  async getAvailableLanguages(): Promise<string[]> {
    await this.waitForLanguageSelector();
    const options = await this.languageSelect.locator("option").allTextContents();
    return options;
  }

  /**
   * Click copy button and wait for "Copied!" state
   */
  async copyMarkdown() {
    await this.copyButton.click();
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector("button");
        return btn?.textContent?.includes("Copied") || btn?.textContent?.includes("已复制");
      },
      { timeout: 3000 },
    );
  }

  /**
   * Switch language (English <-> Chinese)
   */
  async switchLanguage() {
    const currentUrl = this.page.url();
    const isEnglish = currentUrl.includes("/en") || !currentUrl.includes("/zh-CN");

    await this.languageSwitcherButton.click();

    // Wait for navigation to complete
    const expectedLocale = isEnglish ? "zh-CN" : "en";
    await this.page.waitForURL(`**/${expectedLocale}`);
  }

  /**
   * Get current locale from URL
   */
  getCurrentLocale(): string {
    const url = this.page.url();
    if (url.includes("/zh-CN")) return "zh-CN";
    return "en";
  }

  /**
   * Check if WASM badge is visible
   */
  async isWASMReady(): Promise<boolean> {
    const badge = this.page
      .locator("text=WASM Ready")
      .or(this.page.locator(".bg-green-100, .bg-green-900\\/30"));
    return (await badge.count()) > 0;
  }

  /**
   * Get error message text if present
   */
  async getErrorMessage(): Promise<string | null> {
    const count = await this.errorAlert.count();
    if (count === 0) return null;
    return await this.errorAlert.textContent();
  }

  /**
   * Dismiss error alert
   */
  async dismissError() {
    await this.dismissButton.click();
  }

  /**
   * Get markdown content from preview
   */
  async getMarkdownContent(): Promise<string> {
    await this.waitForMarkdownPreview();
    return (await this.markdownPreview.textContent()) || "";
  }

  /**
   * Check if element has dark mode styling
   */
  async isDarkMode(): Promise<boolean> {
    const html = this.page.locator("html");
    const classList = await html.getAttribute("class");
    return classList?.includes("dark") || false;
  }

  /**
   * Enable/disable dark mode via classList
   */
  async setDarkMode(enabled: boolean) {
    const html = this.page.locator("html");
    if (enabled) {
      await html.evaluate((el) => el.classList.add("dark"));
    } else {
      await html.evaluate((el) => el.classList.remove("dark"));
    }
  }

  /**
   * Take screenshot with consistent naming
   */
  async screenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }
}

/**
 * Translation helpers
 */
export const translations = {
  en: {
    headerTitle: "YouTube Subtitle to Markdown",
    heroTitle: "Convert YouTube Subtitles to Markdown",
    placeholder: "Enter YouTube URL or video ID",
    convertButton: "Convert",
    copied: "Copied!",
    download: "Download",
    newVideo: "New Video",
    languageSelect: "Select Subtitle Language",
    features: {
      cleanMarkdown: "Clean Markdown",
      multiLanguage: "Multi-language",
      fastReliable: "Fast & Reliable",
    },
    errors: {
      required: "Please enter a YouTube URL or video ID",
      invalid: "Invalid YouTube URL or video ID",
      noSubtitles: "doesn't have any subtitles",
    },
  },
  "zh-CN": {
    headerTitle: "YouTube 字幕转 Markdown",
    heroTitle: "将 YouTube 字幕转换为 Markdown",
    placeholder: "输入 YouTube 链接或视频 ID",
    convertButton: "转换",
    copied: "已复制",
    download: "下载",
    newVideo: "新视频",
    languageSelect: "选择字幕语言",
    features: {
      cleanMarkdown: "简洁 Markdown",
      multiLanguage: "多语言",
      fastReliable: "快速可靠",
    },
    errors: {
      required: "请输入",
      invalid: "无效",
      noSubtitles: "没有字幕",
    },
  },
};

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 30000) {
  await page.waitForLoadState("networkidle", { timeout });
}

/**
 * Mock video info for testing without actual API calls
 */
export function mockVideoInfo(page: Page, videoId: string) {
  return page.route("**/youtubei/v1/player", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        videoDetails: {
          videoId: videoId,
          title: "Test Video",
          lengthSeconds: "180",
          thumbnail: { thumbnails: [{ url: `https://example.com/thumb_${videoId}.jpg` }] },
        },
      }),
    });
  });
}

/**
 * Mock subtitle response for testing
 */
export function mockSubtitles(page: Page) {
  return page.route("**/api/subtitles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/xml",
      body: `<transcript>
        <text start="0.0" dur="3.5">Hello world</text>
        <text start="3.5" dur="5.0">This is a test subtitle</text>
        <text start="8.5" dur="4.0">End of test</text>
      </transcript>`,
    });
  });
}
