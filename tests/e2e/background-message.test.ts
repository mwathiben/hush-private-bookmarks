import { test, expect } from './fixtures/extension';
import type { BackgroundResponse } from '@/lib/background-types';

test.describe('Background service worker: BG-001', () => {
  test('manifest has alarms permission', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const res = await page.goto(`chrome-extension://${extensionId}/manifest.json`);
    const manifest = await res!.json();
    expect(manifest.permissions).toContain('alarms');
    await page.close();
  });

  test('manifest has incognito: spanning', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const res = await page.goto(`chrome-extension://${extensionId}/manifest.json`);
    const manifest = await res!.json();
    expect(manifest.incognito).toBe('spanning');
    await page.close();
  });

  test('manifest has _execute_action command', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const res = await page.goto(`chrome-extension://${extensionId}/manifest.json`);
    const manifest = await res!.json();
    expect(manifest.commands).toBeDefined();
    expect(manifest.commands._execute_action).toBeDefined();
    expect(manifest.commands._execute_action.description).toBe('Open Hush popup');
    await page.close();
  });

  test('service worker responds to GET_STATE with locked state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    });

    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as { isUnlocked: boolean };
      expect(state.isUnlocked).toBe(false);
    }
    await page.close();
  });

  test('service worker responds to LOCK with success', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'LOCK' });
    });

    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    await page.close();
  });

  test('non-background message returns undefined', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate(async () => {
      try {
        const result = await chrome.runtime.sendMessage({ action: 'not-ours' });
        return result === undefined ? 'undefined' : 'handled';
      } catch {
        return 'no-handler';
      }
    });

    expect(['undefined', 'no-handler']).toContain(response);
    await page.close();
  });
});

test.describe('Background service worker: BG-002', () => {
  test('GET_STATE returns locked state on fresh load', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    });

    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as { isUnlocked: boolean; activeSetId: string };
      expect(state.isUnlocked).toBe(false);
      expect(state.activeSetId).toBe('');
    }
    await page.close();
  });

  test('LOCK on already-locked state returns success', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'LOCK' });
    });

    expect(response.success).toBe(true);
    await page.close();
  });

  test('UNLOCK with no stored data returns error', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'UNLOCK', password: 'wrong' });
    });

    expect(response.success).toBe(false);
    await page.close();
  });
});
