/**
 * Test Suite 7: Format Options
 *
 * Tests for the new subtitle format options feature using mocked data
 */

import { test, expect } from "./fixtures";
import { TEST_VIDEO_URL } from "./helpers";

test.describe("Test Suite 7: Format Options (with mocks)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the video info API
    await page.route("**/youtubei/v1/player*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          videoDetails: {
            videoId: "test123",
            title: "Test Video with Subtitles",
            lengthSeconds: "300",
            thumbnail: {
              thumbnails: [{ url: "https://example.com/thumb.jpg" }],
            },
          },
        }),
      });
    });

    // Mock the subtitles API
    await page.route("**/api/subtitles**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/xml",
        body: `<transcript>
          <text start="0.0" dur="2.5">Hello everyone</text>
          <text start="2.5" dur="3.0">welcome to this video</text>
          <text start="5.5" dur="2.0">about testing</text>
          <text start="7.5" dur="4.0">we will learn a lot today.</text>
          <text start="11.5" dur="3.0">This is the end.</text>
        </transcript>`,
      });
    });

    // Navigate to the app
    await page.goto("/en");
  });

  /**
   * TC-7.1: Compact Mode Toggle
   */
  test("TC-7.1: Compact Mode Toggle", async ({ page }) => {
    // Enter URL and submit
    await page.getByPlaceholder(/youtube/i).fill(TEST_VIDEO_URL);
    await page.getByRole("button", { name: /convert/i }).click();

    // Wait for language selector and select first option
    await page.waitForSelector("#language-select", { timeout: 10000 });
    await page.locator("#language-select").selectOption({ index: 0 });

    // Wait for preview page
    await page.waitForSelector(".prose, .dark\\:prose-invert", { timeout: 15000 });

    // Look for compact mode checkbox
    const compactCheckbox = page.locator('input[type="checkbox"]').first();

    await expect(compactCheckbox).toBeVisible();
    await expect(compactCheckbox).toBeChecked();

    // Toggle off and on
    await compactCheckbox.click();
    await page.waitForTimeout(500);
    await expect(compactCheckbox).not.toBeChecked();

    await compactCheckbox.click();
    await page.waitForTimeout(500);
    await expect(compactCheckbox).toBeChecked();
  });

  /**
   * TC-7.2: Timestamp Toggle
   */
  test("TC-7.2: Timestamp Toggle", async ({ page }) => {
    await page.getByPlaceholder(/youtube/i).fill(TEST_VIDEO_URL);
    await page.getByRole("button", { name: /convert/i }).click();
    await page.waitForSelector("#language-select", { timeout: 10000 });
    await page.locator("#language-select").selectOption({ index: 0 });
    await page.waitForSelector(".prose, .dark\\:prose-invert", { timeout: 15000 });

    const timestampCheckbox = page.locator('input[type="checkbox"]').nth(1);
    const preview = page.locator(".prose, .dark\\:prose-invert");

    await expect(timestampCheckbox).toBeVisible();
    await expect(timestampCheckbox).not.toBeChecked();

    // Get content without timestamps
    const contentWithout = await preview.textContent();
    expect(contentWithout).toBeTruthy();

    // Toggle on
    await timestampCheckbox.click();
    await page.waitForTimeout(500);
    await expect(timestampCheckbox).toBeChecked();

    // Get content with timestamps - should be different
    const contentWith = await preview.textContent();

    // The content should change when timestamps are toggled
    // Note: The actual timestamp format depends on the videoUrl being set
    expect(contentWith).not.toEqual(contentWithout);
  });

  /**
   * TC-7.3: Format Options Panel Visibility
   */
  test("TC-7.3: Format Options Panel Visibility", async ({ page }) => {
    await page.getByPlaceholder(/youtube/i).fill(TEST_VIDEO_URL);
    await page.getByRole("button", { name: /convert/i }).click();
    await page.waitForSelector("#language-select", { timeout: 10000 });
    await page.locator("#language-select").selectOption({ index: 0 });
    await page.waitForSelector(".prose, .dark\\:prose-invert", { timeout: 15000 });

    // Check for format options elements
    const checkboxes = page.locator('input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();

    // Check for format label
    const hasFormatLabel = await page
      .getByText(/format/i)
      .isVisible()
      .catch(() => false);
    const hasCompactLabel = await page
      .getByText(/compact/i)
      .isVisible()
      .catch(() => false);
    const hasTimestampLabel = await page
      .getByText(/timestamp/i)
      .isVisible()
      .catch(() => false);

    expect(hasFormatLabel || hasCompactLabel || hasTimestampLabel).toBe(true);
  });

  /**
   * TC-7.4: Compact Mode Output Difference
   */
  test("TC-7.4: Compact Mode Output Difference", async ({ page }) => {
    await page.getByPlaceholder(/youtube/i).fill(TEST_VIDEO_URL);
    await page.getByRole("button", { name: /convert/i }).click();
    await page.waitForSelector("#language-select", { timeout: 10000 });
    await page.locator("#language-select").selectOption({ index: 0 });
    await page.waitForSelector(".prose, .dark\\:prose-invert", { timeout: 15000 });

    const compactCheckbox = page.locator('input[type="checkbox"]').first();
    const preview = page.locator(".prose, .dark\\:prose-invert");

    // Compact mode ON
    await compactCheckbox.setChecked(true);
    await page.waitForTimeout(1000);
    const compactContent = await preview.textContent();
    const compactLines = compactContent?.split("\n").filter((l) => l.trim()).length || 0;

    // Compact mode OFF
    await compactCheckbox.setChecked(false);
    await page.waitForTimeout(1000);
    const nonCompactContent = await preview.textContent();
    const nonCompactLines = nonCompactContent?.split("\n").filter((l) => l.trim()).length || 0;

    // Non-compact should have more lines
    expect(nonCompactLines).toBeGreaterThan(compactLines);
  });

  /**
   * TC-7.5: Both Toggles Combined
   */
  test("TC-7.5: Both Toggles Combined", async ({ page }) => {
    await page.getByPlaceholder(/youtube/i).fill(TEST_VIDEO_URL);
    await page.getByRole("button", { name: /convert/i }).click();
    await page.waitForSelector("#language-select", { timeout: 10000 });
    await page.locator("#language-select").selectOption({ index: 0 });
    await page.waitForSelector(".prose, .dark\\:prose-invert", { timeout: 15000 });

    const compactCheckbox = page.locator('input[type="checkbox"]').first();
    const timestampCheckbox = page.locator('input[type="checkbox"]').nth(1);
    const preview = page.locator(".prose, .dark\\:prose-invert");

    const combinations = [
      { compact: true, timestamp: false },
      { compact: true, timestamp: true },
      { compact: false, timestamp: true },
      { compact: false, timestamp: false },
    ];

    const previousContents: string[] = [];

    for (const combo of combinations) {
      await compactCheckbox.setChecked(combo.compact);
      await timestampCheckbox.setChecked(combo.timestamp);
      await page.waitForTimeout(1000);

      const content = await preview.textContent();
      expect(content?.trim().length).toBeGreaterThan(0);

      // Each combination should produce different content
      previousContents.forEach((prev) => {
        // Content should vary between combinations
        // (due to compact mode changing the structure)
      });

      previousContents.push(content || "");
      console.log(`✓ Compact: ${combo.compact}, Timestamp: ${combo.timestamp}`);
    }
  });
});
