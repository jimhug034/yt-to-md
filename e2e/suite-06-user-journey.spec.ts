/**
 * Test Suite 6: Complete User Journey
 *
 * Tests TC-6.1 through TC-6.2
 */

import { test, expect } from './fixtures';
import { TEST_VIDEO_URL, TEST_VIDEO_ID, translations } from './helpers';

test.describe('Test Suite 6: Complete User Journey', () => {
  /**
   * TC-6.1: Full Flow - English
   */
  test('TC-6.1: Full Flow - English', async ({ appPage, page }) => {
    // Step 1: Navigate to home page
    await appPage.goto('en');
    await expect(page).toHaveURL(/\/en?$/);
    await expect(appPage.headerTitle).toContainText(translations.en.headerTitle);

    // Step 2: Enter test URL
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await expect(appPage.urlInput).toHaveValue(TEST_VIDEO_URL);

    // Step 3: Submit and wait for language selection
    await appPage.convertButton.click();
    await appPage.waitForLanguageSelector();

    // Verify video info is displayed
    await appPage.waitForVideoInfo();
    const thumbnail = page.locator('img[alt*=""]').first();
    await expect(thumbnail).toBeVisible();

    // Verify language selector appears
    await expect(appPage.languageSelect).toBeVisible();

    // Step 4: Select a language
    const languages = await appPage.getAvailableLanguages();
    expect(languages.length).toBeGreaterThan(0);

    // Get first language option value
    const firstLanguageValue = await appPage.languageSelect.inputValue();
    await appPage.selectLanguage(firstLanguageValue);

    // Step 5: Wait for markdown preview
    await appPage.waitForMarkdownPreview();

    // Verify markdown preview is displayed
    await expect(appPage.markdownPreview).toBeVisible();

    // Step 6: Copy markdown
    await appPage.copyMarkdown();
    await expect(page.getByText('Copied!')).toBeVisible();

    // Wait for button to revert
    await page.waitForTimeout(2500);

    // Step 7: Try "New Video" button
    await appPage.newVideoButton.click();

    // Step 8: Verify return to input step
    await expect(appPage.urlInput).toBeVisible();
    await expect(appPage.urlInput).toHaveValue('');

    // Verify we're back at input step (not at language or preview)
    await expect(appPage.languageSelect).not.toBeVisible();
    await expect(appPage.markdownPreview).not.toBeVisible();

    // Take screenshot of completed journey
    await appPage.screenshot('tc-6-1-full-flow-english');
  });

  /**
   * TC-6.2: Full Flow - Chinese
   */
  test('TC-6.2: Full Flow - Chinese', async ({ appPage, page }) => {
    // Step 1: Navigate to Chinese page
    await appPage.goto('zh-CN');
    await expect(page).toHaveURL(/\/zh-CN/);
    await expect(appPage.headerTitle).toContainText(translations['zh-CN'].headerTitle);

    // Verify all UI text is in Chinese
    await expect(appPage.heroTitle).toContainText(translations['zh-CN'].heroTitle);
    await expect(page.getByPlaceholder(translations['zh-CN'].placeholder)).toBeVisible();

    // Step 2: Enter test URL
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await expect(appPage.urlInput).toHaveValue(TEST_VIDEO_URL);

    // Step 3: Submit and wait for language selection
    await page.getByRole('button', { name: translations['zh-CN'].convertButton }).click();
    await appPage.waitForLanguageSelector();

    // Verify video info is displayed
    await appPage.waitForVideoInfo();
    const thumbnail = page.locator('img[alt*=""]').first();
    await expect(thumbnail).toBeVisible();

    // Verify language selector appears with Chinese label
    await expect(appPage.languageSelect).toBeVisible();
    await expect(page.getByText(translations['zh-CN'].languageSelect)).toBeVisible();

    // Step 4: Select a language
    const languages = await appPage.getAvailableLanguages();
    expect(languages.length).toBeGreaterThan(0);

    const firstLanguageValue = await appPage.languageSelect.inputValue();
    await appPage.selectLanguage(firstLanguageValue);

    // Step 5: Wait for markdown preview
    await appPage.waitForMarkdownPreview();

    // Verify markdown preview is displayed with Chinese title
    await expect(appPage.markdownPreview).toBeVisible();
    await expect(page.getByText(translations['zh-CN'].previewTitle || 'Markdown Preview')).toBeVisible();

    // Step 6: Copy markdown
    await appPage.copyMarkdown();
    await expect(page.getByText(translations['zh-CN'].copied)).toBeVisible();

    // Wait for button to revert
    await page.waitForTimeout(2500);

    // Step 7: Try "New Video" button
    await appPage.newVideoButton.click();

    // Step 8: Verify return to input step
    await expect(appPage.urlInput).toBeVisible();
    await expect(appPage.urlInput).toHaveValue('');

    // Verify we're back at input step
    await expect(appPage.languageSelect).not.toBeVisible();
    await expect(appPage.markdownPreview).not.toBeVisible();

    // Verify UI is still in Chinese
    await expect(appPage.heroTitle).toContainText(translations['zh-CN'].heroTitle);

    // Take screenshot of completed journey
    await appPage.screenshot('tc-6-2-full-flow-chinese');
  });

  /**
   * TC-6.3: User Journey with Download
   */
  test('TC-6.3: User Journey with Download', async ({ appPage, page }) => {
    // Navigate to home page
    await appPage.goto('en');

    // Complete conversion
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();
    await appPage.waitForLanguageSelector();
    await appPage.selectLanguage(await appPage.languageSelect.inputValue());
    await appPage.waitForMarkdownPreview();

    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Download the file
    await appPage.downloadButton.click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.md$/);

    // Now try "New Video" to reset
    await appPage.newVideoButton.click();

    // Verify state reset
    await expect(appPage.urlInput).toHaveValue('');
  });

  /**
   * TC-6.4: User Journey - Language Switch Mid-Flow
   */
  test('TC-6.4: User Journey - Language Switch Mid-Flow', async ({ appPage, page }) => {
    // Start in English
    await appPage.goto('en');

    // Enter URL but don't submit
    await appPage.urlInput.fill(TEST_VIDEO_URL);

    // Switch language to Chinese
    await appPage.languageSwitcherButton.click();
    await page.waitForURL('**/zh-CN');

    // Verify input was cleared (new session)
    await expect(appPage.urlInput).toHaveValue('');

    // Complete the flow in Chinese
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();
    await appPage.waitForLanguageSelector();

    // Verify we're in Chinese UI
    await expect(page.getByText(translations['zh-CN'].languageSelect)).toBeVisible();

    // Switch back to English
    await appPage.languageSwitcherButton.click();
    await page.waitForURL('**/en');

    // Verify state reset again
    await expect(appPage.urlInput).toHaveValue('');
  });

  /**
   * TC-6.5: Multiple Video Conversions
   */
  test('TC-6.5: Multiple Video Conversions', async ({ appPage, page }) => {
    await appPage.goto('en');

    // First video conversion
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();
    await appPage.waitForLanguageSelector();
    await appPage.selectLanguage(await appPage.languageSelect.inputValue());
    await appPage.waitForMarkdownPreview();

    // Verify first conversion worked
    await expect(appPage.markdownPreview).toBeVisible();

    // Click New Video
    await appPage.newVideoButton.click();

    // Verify reset
    await expect(appPage.urlInput).toHaveValue('');

    // Second video conversion (different video)
    const secondVideoId = 'dQw4w9WgXcQ';
    await appPage.urlInput.fill(`https://www.youtube.com/watch?v=${secondVideoId}`);
    await appPage.convertButton.click();
    await appPage.waitForLanguageSelector();

    // Verify new video info loaded
    await appPage.waitForVideoInfo();

    // Should be able to convert second video
    await appPage.selectLanguage(await appPage.languageSelect.inputValue());
    await appPage.waitForMarkdownPreview();

    // Verify second conversion worked
    await expect(appPage.markdownPreview).toBeVisible();
  });
});
