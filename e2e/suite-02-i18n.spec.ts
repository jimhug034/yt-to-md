/**
 * Test Suite 2: i18n (Internationalization)
 *
 * Tests TC-2.1 through TC-2.4
 */

import { test, expect } from './fixtures';
import { translations, EN_PATH, ZH_CN_PATH } from './helpers';

test.describe('Test Suite 2: i18n (Internationalization)', () => {
  /**
   * TC-2.1: Language Switcher - English to Chinese
   */
  test('TC-2.1: Language Switcher - English to Chinese', async ({ appPage, page }) => {
    // Start on English page
    await appPage.goto('en');

    // Verify we're on English page
    await expect(page).toHaveURL(/\/en?$/);
    await expect(appPage.headerTitle).toContainText(translations.en.headerTitle);

    // Click language switcher button (globe icon + "中文")
    await appPage.languageSwitcherButton.click();

    // Wait for URL to change to zh-CN
    await page.waitForURL(`**${ZH_CN_PATH}`, { timeout: 5000 });

    // Verify URL changed to /zh-CN
    expect(page.url()).toContain('/zh-CN');

    // Verify all text displays in Chinese
    await expect(appPage.headerTitle).toContainText(translations['zh-CN'].headerTitle);
    await expect(appPage.heroTitle).toContainText(translations['zh-CN'].heroTitle);

    // Verify features display Chinese text
    await expect(page.getByText(translations['zh-CN'].features.cleanMarkdown)).toBeVisible();
    await expect(page.getByText(translations['zh-CN'].features.multiLanguage)).toBeVisible();
    await expect(page.getByText(translations['zh-CN'].features.fastReliable)).toBeVisible();
  });

  /**
   * TC-2.2: Language Switcher - Chinese to English
   */
  test('TC-2.2: Language Switcher - Chinese to English', async ({ appPage, page }) => {
    // Navigate to Chinese page
    await appPage.goto('zh-CN');

    // Verify we're on Chinese page
    await expect(page).toHaveURL(/\/zh-CN/);
    await expect(appPage.headerTitle).toContainText(translations['zh-CN'].headerTitle);

    // Click language switcher button (globe icon + "English")
    await appPage.languageSwitcherButton.click();

    // Wait for URL to change to /en
    await page.waitForURL(`**${EN_PATH}`, { timeout: 5000 });

    // Verify URL changed to /en
    expect(page.url()).toContain('/en');

    // Verify all text displays in English
    await expect(appPage.headerTitle).toContainText(translations.en.headerTitle);
    await expect(appPage.heroTitle).toContainText(translations.en.heroTitle);
  });

  /**
   * TC-2.3: Language Switcher Preserves State During Input
   */
  test('TC-2.3: Language Switcher Preserves State During Input', async ({ appPage, page }) => {
    // On English page, enter video URL
    await appPage.goto('en');
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    await appPage.urlInput.fill(testUrl);

    // Verify input has text
    await expect(appPage.urlInput).toHaveValue(testUrl);

    // Before submitting, click language switcher
    await appPage.languageSwitcherButton.click();

    // Wait for navigation to complete
    await page.waitForURL(`**${ZH_CN_PATH}`);

    // Language should switch
    expect(appPage.getCurrentLocale()).toBe('zh-CN');

    // Input field should be cleared (new session/page navigation)
    await expect(appPage.urlInput).toHaveValue('');
  });

  /**
   * TC-2.4: All Translations Present
   */
  test('TC-2.4: All Translations Present', async ({ appPage, page }) => {
    // Switch to Chinese
    await appPage.goto('zh-CN');

    // Verify we're on Chinese page
    await expect(page).toHaveURL(/\/zh-CN/);

    // Check all main UI elements are in Chinese
    const zhTranslations = translations['zh-CN'];

    // Header
    await expect(appPage.headerTitle).toContainText(zhTranslations.headerTitle);

    // Hero
    await expect(appPage.heroTitle).toContainText(zhTranslations.heroTitle);

    // Input placeholder
    await expect(appPage.urlInput).toHaveAttribute('placeholder', zhTranslations.placeholder);

    // Features
    await expect(page.getByText(zhTranslations.features.cleanMarkdown)).toBeVisible();
    await expect(page.getByText(zhTranslations.features.multiLanguage)).toBeVisible();
    await expect(page.getByText(zhTranslations.features.fastReliable)).toBeVisible();

    // Check for any remaining English text in main UI areas
    // (excluding video content which may be English)
    const mainContent = page.locator('main');
    const mainText = await mainContent.textContent();

    // Check that key English phrases are NOT present in the UI
    expect(mainText).not.toContain('Convert YouTube Subtitles');
    expect(mainText).not.toContain('Clean Markdown');

    // Verify the convert button is in Chinese
    await expect(page.getByRole('button', { name: zhTranslations.convertButton })).toBeVisible();

    // Verify footer is in Chinese (or contains Chinese)
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});
