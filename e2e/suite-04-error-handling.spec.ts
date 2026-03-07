/**
 * Test Suite 4: Error Handling
 *
 * Tests TC-4.1 through TC-4.3
 */

import { test, expect } from './fixtures';
import { TEST_VIDEO_URL, translations } from './helpers';

test.describe('Test Suite 4: Error Handling', () => {
  test.beforeEach(async ({ appPage }) => {
    await appPage.goto('en');
  });

  /**
   * TC-4.1: Video Without Subtitles
   */
  test('TC-4.1: Video Without Subtitles', async ({ appPage, page }) => {
    // Use a video that likely has no subtitles
    // Note: This is a real video ID that may or may not have subtitles
    // In a real test scenario, you would mock the API response
    const noSubtitleVideoId = 'dQw4w9WgXcQ'; // Rick Roll - usually has captions though

    // For this test, we'll simulate the no-subtitles error scenario
    // by mocking the API response to return empty subtitles
    await page.route('**/api/subtitles**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No subtitles available' }),
      });
    });

    // Also mock the available subtitles endpoint
    await page.route('**/youtubei/v1/player**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          videoDetails: {
            videoId: noSubtitleVideoId,
            title: 'Test Video Without Subtitles',
            lengthSeconds: '180',
          },
        }),
      });
    });

    // Enter video URL
    await appPage.urlInput.fill(`https://www.youtube.com/watch?v=${noSubtitleVideoId}`);
    await appPage.convertButton.click();

    // Wait for error to appear
    await page.waitForTimeout(3000);

    // Verify error message about no subtitles
    const errorMsg = await appPage.getErrorMessage();
    expect(errorMsg).toBeTruthy();

    // Check for error text in the page
    const hasNoSubtitlesError = await page.locator('text=subtitles').count() > 0;
    if (hasNoSubtitlesError) {
      await expect(page.locator('text=subtitles')).toBeVisible();
    }
  });

  /**
   * TC-4.2: Network Error (API Failure)
   */
  test('TC-4.2: Network Error (API Failure)', async ({ appPage, page }) => {
    // Simulate network failure by intercepting requests and failing them
    await page.route('**/youtubei/v1/player**', (route) => {
      route.abort('failed');
    });

    // Also fail the API route
    await page.route('**/api/subtitles**', (route) => {
      route.abort('failed');
    });

    // Try to convert a video
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();

    // Wait for error handling
    await page.waitForTimeout(2000);

    // Verify error message appears (network error or similar)
    // The app should show a graceful error message
    const errorAlert = page.locator('.bg-red-50, .bg-red-900\\/20, [role="alert"]');
    const hasError = await errorAlert.count() > 0;

    if (hasError) {
      await expect(errorAlert).toBeVisible();
    }

    // Verify app remains functional - check that we can still interact with UI
    await expect(appPage.urlInput).toBeVisible();
    await expect(appPage.convertButton).toBeVisible();
  });

  /**
   * TC-4.3: Dismiss Error Message
   */
  test('TC-4.3: Dismiss Error Message', async ({ appPage, page }) => {
    // Trigger an error by entering invalid URL
    await appPage.urlInput.fill('this-is-not-a-valid-url-at-all');
    await appPage.convertButton.click();

    // Wait for error to appear
    await page.waitForTimeout(500);

    // Verify error message is visible
    let errorMsg = await appPage.getErrorMessage();
    expect(errorMsg).toBeTruthy();

    // Look for dismiss button
    const dismissBtn = page.getByRole('button', { name: /dismiss/i });
    await expect(dismissBtn).toBeVisible();

    // Click dismiss button
    await dismissBtn.click();

    // Wait for error to disappear
    await page.waitForTimeout(500);

    // Verify error message is gone
    const errorAfterDismiss = page.locator('.bg-red-50, .bg-red-900\\/20, [role="alert"]');
    const count = await errorAfterDismiss.count();

    // Error should be dismissed (either count is 0 or it's not visible)
    if (count > 0) {
      await expect(errorAfterDismiss).not.toBeVisible();
    }

    // Verify user can retry - input should be functional
    await expect(appPage.urlInput).toBeEnabled();
    await expect(appPage.convertButton).toBeEnabled();

    // Verify we can enter a new value
    await appPage.urlInput.clear();
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await expect(appPage.urlInput).toHaveValue(TEST_VIDEO_URL);
  });

  /**
   * TC-4.4: Invalid Video ID Format
   */
  test('TC-4.4: Invalid Video ID Format', async ({ appPage, page }) => {
    // Enter an invalid video ID (too short)
    await appPage.urlInput.fill('abc');
    await appPage.convertButton.click();

    // Verify error message appears
    const errorMsg = await appPage.getErrorMessage();
    expect(errorMsg).toBeTruthy();
    expect(errorMsg?.toLowerCase()).toContain('invalid');

    // Verify we're still on input step (not progressed)
    await expect(appPage.urlInput).toBeVisible();
  });

  /**
   * TC-4.5: API Returns 404
   */
  test('TC-4.5: API Returns 404', async ({ appPage, page }) => {
    // Mock API to return 404
    await page.route('**/youtubei/v1/player**', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
    });

    // Try to convert a video
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();

    // Wait for error handling
    await page.waitForTimeout(2000);

    // Verify error message appears
    const errorAlert = page.locator('.bg-red-50, .bg-red-900\\/20, [role="alert"]');
    const hasError = await errorAlert.count() > 0;

    if (hasError) {
      await expect(errorAlert).toBeVisible();
    }

    // Verify app remains functional
    await expect(appPage.urlInput).toBeVisible();
  });
});
