import { test, expect } from './fixtures/extension';
import type { BackgroundResponse } from '@/lib/background-types';

test.describe('Background service worker: SYNC-004', () => {
  test('extension loads with sync-handlers module bundled', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(
      page.locator('[data-testid="setup-screen"]'),
    ).toBeVisible({ timeout: 10_000 });

    expect(pageErrors.filter((e) => e.includes('sync-handler'))).toHaveLength(0);

    await page.close();
  });

  test('service worker registers successfully', async ({ context, extensionId }) => {
    let [sw] = context.serviceWorkers();
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    }
    expect(sw).toBeTruthy();
    expect(sw.url()).toContain(extensionId);
  });

  test('SYNC_STATUS returns SYNC_NOT_CONFIGURED', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'SYNC_STATUS' });
    });

    expect(response).toBeDefined();
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error).toBe('Sync not configured');
      expect(response.code).toBe('SYNC_NOT_CONFIGURED');
    }
    await page.close();
  });

  test('SYNC_UPLOAD returns SYNC_NOT_CONFIGURED', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({
        type: 'SYNC_UPLOAD',
        blob: 'AQID',
        timestamp: Date.now(),
      });
    });

    expect(response).toBeDefined();
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error).toBe('Sync not configured');
      expect(response.code).toBe('SYNC_NOT_CONFIGURED');
    }
    await page.close();
  });

  test('SYNC_DOWNLOAD returns SYNC_NOT_CONFIGURED', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'SYNC_DOWNLOAD' });
    });

    expect(response).toBeDefined();
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error).toBe('Sync not configured');
      expect(response.code).toBe('SYNC_NOT_CONFIGURED');
    }
    await page.close();
  });
});
