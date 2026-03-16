import { test as extensionTest, expect } from './extension';
import { seedStorage, unlockPopup, SEED_PASSWORD, EMPTY_TREE } from './seed-storage';
import type { Page } from '@playwright/test';

export function makeSettingsTest(treeData?: string) {
  return extensionTest.extend<{ settingsPage: Page }>({
    settingsPage: async ({ context, extensionId }, use) => {
      let sw = context.serviceWorkers()[0];
      if (!sw) sw = await context.waitForEvent('serviceworker');

      await sw.evaluate(
        seedStorage(),
        [SEED_PASSWORD, treeData ?? EMPTY_TREE] as const,
      );

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await unlockPopup(page, SEED_PASSWORD);

      await page.getByRole('button', { name: /settings/i }).click();
      await expect(page.getByTestId('settings-screen')).toBeVisible({
        timeout: 10_000,
      });

      await use(page);
      await page.close();
    },
  });
}
