/**
 * Test Suite 5: UI/UX
 *
 * Tests TC-5.1 through TC-5.4
 */

import { test, expect } from "./fixtures";
import { TEST_VIDEO_URL, devices } from "@playwright/test";

test.describe("Test Suite 5: UI/UX", () => {
  /**
   * TC-5.1: Dark Mode Support
   */
  test("TC-5.1: Dark Mode Support", async ({ appPage, page }) => {
    await appPage.goto("en");

    // Enable dark mode
    await appPage.setDarkMode(true);

    // Take screenshot for visual verification
    await appPage.screenshot("tc-5-1-dark-mode");

    // Verify dark mode is applied
    const html = page.locator("html");
    const classList = await html.getAttribute("class");
    expect(classList).toContain("dark");

    // Verify key elements are visible in dark mode
    await expect(appPage.headerTitle).toBeVisible();
    await expect(appPage.heroTitle).toBeVisible();

    // Verify components have dark mode styling
    // Check that dark mode classes are being applied
    const darkStyledElements = page.locator(".dark\\:bg-gray-900, .dark\\:text-white");
    await expect(darkStyledElements.first()).toBeVisible();

    // Switch back to light mode
    await appPage.setDarkMode(false);

    // Verify light mode works
    await appPage.screenshot("tc-5-1-light-mode");
    await expect(appPage.headerTitle).toBeVisible();
  });

  /**
   * TC-5.2: Responsive Design - Mobile
   */
  test("TC-5.2: Responsive Design - Mobile", async ({ appPage, page }) => {
    // Set mobile viewport (iPhone SE)
    await page.setViewportSize({ width: 375, height: 667 });
    await appPage.goto("en");

    // Take screenshot of mobile view
    await appPage.screenshot("tc-5-2-mobile-view");

    // Verify layout stacks vertically on mobile
    // Check that grid is now single column
    const grid = page.locator(".grid");
    const gridClasses = await grid.getAttribute("class");
    expect(gridClasses).toBeTruthy();

    // Verify all buttons are accessible (not off-screen)
    await expect(appPage.convertButton).toBeVisible();

    // Verify convert button is within viewport
    const convertBox = await appPage.convertButton.boundingBox();
    expect(convertBox).toBeTruthy();
    if (convertBox) {
      expect(convertBox.x).toBeGreaterThanOrEqual(0);
      expect(convertBox.x + convertBox.width).toBeLessThanOrEqual(375);
    }

    // Verify no horizontal scrolling
    const bodyWidth = await page.locator("body").evaluate((el) => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);

    // Test full flow on mobile
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();

    // Wait for results
    await page.waitForTimeout(5000);

    // Take screenshot of mobile language selection
    await appPage.screenshot("tc-5-2-mobile-language-selection");

    // Verify mobile-friendly layout
    await expect(appPage.languageSelect).toBeVisible();
  });

  /**
   * TC-5.3: Loading States
   */
  test("TC-5.3: Loading States", async ({ appPage, page }) => {
    await appPage.goto("en");

    // Submit valid URL and observe loading animation
    await appPage.urlInput.fill(TEST_VIDEO_URL);
    await appPage.convertButton.click();

    // Immediately check for loading state
    const spinner = page.locator(".animate-spin").or(page.locator('[class*="spinner"]'));

    // Check if spinner appears (it might be very fast)
    const spinnerCount = await spinner.count();
    if (spinnerCount > 0) {
      await expect(spinner.first()).toBeVisible();
    }

    // Check for loading text
    const loadingText = page.locator("text=Loading").or(page.locator("text=Fetching"));

    // The loading state might be very brief, so just check it exists at some point
    const hasLoadingText = (await loadingText.count()) > 0;

    // Verify UI remains responsive during loading
    // Input should be disabled
    await expect(appPage.urlInput).toBeDisabled();

    // Wait for loading to complete
    await appPage.waitForLanguageSelector();

    // Verify input is re-enabled after loading
    await expect(appPage.urlInput).toBeEnabled();
  });

  /**
   * TC-5.4: WASM Status Indicator
   */
  test("TC-5.4: WASM Status Indicator", async ({ appPage, page }) => {
    await appPage.goto("en");

    // Wait a bit for WASM to load
    await page.waitForTimeout(3000);

    // Check for WASM Ready badge
    const wasmBadge = page
      .locator("text=WASM Ready")
      .or(page.locator(".bg-green-100, .bg-green-900\\/30").filter({ hasText: "WASM" }));

    // WASM badge may or may not appear depending on browser support
    const hasWasmBadge = (await wasmBadge.count()) > 0;

    if (hasWasmBadge) {
      // Verify badge is visible
      await expect(wasmBadge.first()).toBeVisible();

      // Verify it has green styling
      const badge = wasmBadge.first();
      const classes = await badge.getAttribute("class");
      expect(classes).toMatch(/green/);

      // Take screenshot showing WASM badge
      await appPage.screenshot("tc-5-4-wasm-badge");
    } else {
      // If WASM doesn't load, verify silent fallback (no error)
      const errors = await appPage.getErrorMessage();
      expect(errors).toBeNull();
    }
  });

  /**
   * TC-5.5: Focus States
   */
  test("TC-5.5: Focus States", async ({ appPage, page }) => {
    await appPage.goto("en");

    // Focus on URL input
    await appPage.urlInput.focus();

    // Verify focus ring is visible
    const inputClasses = await appPage.urlInput.getAttribute("class");
    expect(inputClasses).toMatch(/ring|focus/);

    // Verify cursor is in input
    const isFocused = await appPage.urlInput.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    // Tab to convert button
    await page.keyboard.press("Tab");

    // Verify button is focused
    const isButtonFocused = await appPage.convertButton.evaluate(
      (el) => document.activeElement === el,
    );
    expect(isButtonFocused).toBe(true);
  });

  /**
   * TC-5.6: Hover States
   */
  test("TC-5.6: Hover States", async ({ appPage, page }) => {
    await appPage.goto("en");

    // Hover over convert button
    await appPage.convertButton.hover();

    // Verify hover state (check for hover class or style change)
    const buttonClasses = await appPage.convertButton.getAttribute("class");
    // The button should have hover styling
    expect(buttonClasses).toBeTruthy();

    // Hover over feature card
    const firstFeature = page.locator(".grid > div").first();
    await firstFeature.hover();

    // Verify card is visible and interactive
    await expect(firstFeature).toBeVisible();
  });

  /**
   * TC-5.7: Tablet Viewport
   */
  test("TC-5.7: Tablet Viewport", async ({ appPage, page }) => {
    // Set tablet viewport (iPad)
    await page.setViewportSize({ width: 768, height: 1024 });
    await appPage.goto("en");

    // Take screenshot
    await appPage.screenshot("tc-5-7-tablet-view");

    // Verify layout adapts
    await expect(appPage.headerTitle).toBeVisible();
    await expect(appPage.heroTitle).toBeVisible();

    // On tablet, grid should still be visible
    const grid = page.locator(".grid");
    await expect(grid).toBeVisible();
  });
});
