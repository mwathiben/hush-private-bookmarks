import { test, expect } from './fixtures/extension';
import type { BackgroundResponse } from '@/lib/background-types';
import type { ProStatus } from '@/lib/types';

test.describe('Pro-gate background integration', () => {
  test('CHECK_PRO_STATUS returns ProStatus shape', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'CHECK_PRO_STATUS' });
    });

    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    if (response.success) {
      const data = response.data as ProStatus;
      expect(typeof data.isPro).toBe('boolean');
      expect(typeof data.canTrial).toBe('boolean');
      expect(data.expiresAt === null || typeof data.expiresAt === 'number').toBe(true);
      expect(data.trialDaysLeft === null || typeof data.trialDaysLeft === 'number').toBe(true);
    }
    await page.close();
  });

  test('GET_STATE includes proStatus in response', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    });

    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as { proStatus: ProStatus };
      expect(state.proStatus).toBeDefined();
      expect(typeof state.proStatus.isPro).toBe('boolean');
      expect(typeof state.proStatus.canTrial).toBe('boolean');
    }
    await page.close();
  });

  test('extension loads without errors after protocol change', async ({ context, extensionId }) => {
    const errors: string[] = [];
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
    await page.close();
  });
});
