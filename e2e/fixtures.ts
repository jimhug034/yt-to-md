/**
 * E2E Test Fixtures
 *
 * Custom Playwright fixtures for the YouTube Subtitle to Markdown app
 */

import { test as base, Page } from "@playwright/test";
import { AppPage } from "./helpers";

// Define custom fixtures
export type AppFixtures = {
  appPage: AppPage;
};

export const test = base.extend<AppFixtures>({
  appPage: async ({ page }, use) => {
    const appPage = new AppPage(page);
    await use(appPage);
  },
});

export { expect } from "@playwright/test";
