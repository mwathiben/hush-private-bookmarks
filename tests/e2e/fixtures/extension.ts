import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { existsSync } from 'node:fs';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

export type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    if (!existsSync(EXTENSION_PATH)) {
      throw new Error(
        `Extension build not found at ${EXTENSION_PATH}. Run 'wxt build' first.`,
      );
    }

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !!process.env.CI,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];
    if (!extensionId) {
      throw new Error('Failed to extract extension ID from service worker URL');
    }
    await use(extensionId);
  },
});

export { expect } from '@playwright/test';
