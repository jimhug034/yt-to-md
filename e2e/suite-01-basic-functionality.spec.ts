/**
 * Test Suite 1: Basic Functionality
 *
 * Tests TC-1.1 through TC-1.7
 */

import { test, expect } from "./fixtures";
import { TEST_VIDEO_URL, TEST_VIDEO_SHORT_URL, TEST_VIDEO_ID, translations } from "./helpers";

test.describe("Test Suite 1: Basic Functionality", () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.goto("en");
  });

  /**
   * TC-1.1: Initial Page Load (English Default)
   */
  test("TC-1.1: Initial Page Load (English Default)", async ({ appPage, page }) => {
    // Verify page loads without errors
    await expect(page).toHaveURL(/\/en?$/);

    // Check for console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Wait a bit to catch any initial console errors
    await page.waitForTimeout(1000);

    expect(errors.filter((e) => !e.includes("DevTools")).length).toBe(0);

    // Verify header shows correct title
    await expect(appPage.headerTitle).toContainText(translations.en.headerTitle);

    // Verify hero section displays correctly
    await expect(appPage.heroTitle).toContainText(translations.en.heroTitle);

    // Verify three feature cards are visible
    const featuresSection = page
      .locator(".grid")
      .filter({ has: page.locator("text=Clean Markdown") });
    await expect(featuresSection).toBeVisible();

    // Verify all three features are displayed
    await expect(page.getByText(translations.en.features.cleanMarkdown)).toBeVisible();
    await expect(page.getByText(translations.en.features.multiLanguage)).toBeVisible();
    await expect(page.getByText(translations.en.features.fastReliable)).toBeVisible();

    // Verify footer displays correctly
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator("footer")).toContainText("YouTube Subtitle to Markdown");
  });

  /**
   * TC-1.2: URL Input - Valid Full URL
   */
  test("TC-1.2: URL Input - Valid Full URL", async ({ appPage, page }) => {
    // Enter the full YouTube URL
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();

    // Verify loading state appears
    await expect(page.getByText(/loading|fetching/i)).toBeVisible();

    // Wait for video info card to display with thumbnail
    await appPage.waitForVideoInfo();

    // Verify video thumbnail is displayed
    const thumbnail = page.locator('img[alt*=""]').first();
    await expect(thumbnail).toBeVisible();

    // Verify language selector appears with available languages
    await appPage.waitForLanguageSelector();
    await expect(appPage.languageSelect).toBeVisible();

    // Verify no error messages
    const errorMsg = await appPage.getErrorMessage();
    expect(errorMsg).toBeNull();
  });

  /**
   * TC-1.3: URL Input - Short URL Format
   */
  test("TC-1.3: URL Input - Short URL Format", async ({ appPage, page }) => {
    // Enter the short YouTube URL (youtu.be format)
    await appPage.urlInput.fill(TEST_VIDEO_SHORT_URL);
    await appPage.convertButton.click();

    // Wait for video info to load
    await appPage.waitForVideoInfo();

    // Verify video thumbnail is displayed
    const thumbnail = page.locator('img[alt*=""]').first();
    await expect(thumbnail).toBeVisible();

    // Verify language selector appears
    await appPage.waitForLanguageSelector();
    await expect(appPage.languageSelect).toBeVisible();
  });

  /**
   * TC-1.4: URL Input - Video ID Only
   */
  test("TC-1.4: URL Input - Video ID Only", async ({ appPage, page }) => {
    // Enter just the 11-character video ID
    await appPage.urlInput.fill(TEST_VIDEO_ID);
    await appPage.convertButton.click();

    // Wait for video info to load
    await appPage.waitForVideoInfo();

    // Verify video thumbnail is displayed
    const thumbnail = page.locator('img[alt*=""]').first();
    await expect(thumbnail).toBeVisible();

    // Verify language selector appears
    await appPage.waitForLanguageSelector();
    await expect(appPage.languageSelect).toBeVisible();
  });

  /**
   * TC-1.5: URL Input - Invalid URL
   */
  test("TC-1.5: URL Input - Invalid URL", async ({ appPage, page }) => {
    // Enter an invalid URL
    await appPage.urlInput.fill("invalid-url");
    await appPage.convertButton.click();

    // Verify error message appears
    const errorMsg = await appPage.getErrorMessage();
    expect(errorMsg).toBeTruthy();
    expect(errorMsg?.toLowerCase()).toContain("invalid");

    // Verify the error message contains expected text
    await expect(page.locator("text=Invalid YouTube URL")).toBeVisible();
  });

  /**
   * TC-1.6: URL Input - Empty Input
   */
  test("TC-1.6: URL Input - Empty Input", async ({ appPage, page }) => {
    // Leave input empty and click convert
    await appPage.urlInput.fill("");
    await appPage.convertButton.click();

    // Verify error message about empty input
    const errorMsg = await appPage.getErrorMessage();
    expect(errorMsg).toBeTruthy();
    expect(errorMsg?.toLowerCase()).toContain("please enter");

    // Check for validation error text
    await expect(page.locator("text=Please enter")).toBeVisible();
  });

  /**
   * TC-1.7: Language Selection & Subtitle Fetch
   */
  test("TC-1.7: Language Selection & Subtitle Fetch", async ({ appPage, page }) => {
    // First, reach language selection step
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();
    await appPage.waitForLanguageSelector();

    // Get available languages
    const languages = await appPage.getAvailableLanguages();
    expect(languages.length).toBeGreaterThan(0);

    // Select a language (first available)
    await appPage.selectLanguage(await appPage.languageSelect.inputValue());

    // Verify loading state: "Converting subtitles..."
    await expect(page.getByText(/converting/i)).toBeVisible();

    // Wait for markdown preview to appear
    await appPage.waitForMarkdownPreview();

    // Verify subtitle entries count is displayed
    await expect(page.locator("text=subtitle entries")).toBeVisible();

    // Verify Copy button is available
    await expect(appPage.copyButton).toBeVisible();

    // Verify Download button is available
    await expect(appPage.downloadButton).toBeVisible();
  });
});
