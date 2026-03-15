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

  test('invalid type value is rejected by VALID_TYPES guard', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate(async () => {
      try {
        const result = await chrome.runtime.sendMessage({ type: 'TOTALLY_BOGUS' });
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
      expect(state.activeSetId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
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

test.describe('Background service worker: BG-003/BG-004', () => {
  test('SAVE without unlock returns NOT_UNLOCKED', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({
        type: 'SAVE',
        tree: { type: 'folder', title: 'Root', children: [], dateAdded: 0 },
      });
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
    await page.close();
  });

  test('ADD_BOOKMARK without unlock returns NOT_UNLOCKED', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({
        type: 'ADD_BOOKMARK',
        url: 'https://example.com',
        title: 'Test Bookmark',
      });
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
    await page.close();
  });

  test('GET_INCOGNITO_STATE returns success with mode', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'GET_INCOGNITO_STATE' });
    });

    expect(response.success).toBe(true);
    if (response.success) {
      expect(typeof response.data).toBe('string');
    }
    await page.close();
  });

  test('CHANGE_PASSWORD without unlock returns NOT_UNLOCKED', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({
        type: 'CHANGE_PASSWORD',
        currentPassword: 'a',
        newPassword: 'b',
      });
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
    await page.close();
  });

  test('manifest has contextMenus permission', async ({ context, extensionId }) => {
    const page = await context.newPage();
    const res = await page.goto(`chrome-extension://${extensionId}/manifest.json`);
    const manifest = await res!.json();
    expect(manifest.permissions).toContain('contextMenus');
    await page.close();
  });
});

test.describe('Background service worker: BG-005', () => {
  test('service worker is active', async ({ context, extensionId }) => {
    const [sw] = context.serviceWorkers();
    expect(sw).toBeDefined();
    expect(sw!.url()).toContain(extensionId);
  });

  test('sequential messages maintain state consistency', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const results = await page.evaluate<BackgroundResponse[]>(async () => {
      const r1 = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      const r2 = await chrome.runtime.sendMessage({ type: 'LOCK' });
      const r3 = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      return [r1, r2, r3];
    });

    expect(results).toHaveLength(3);
    expect(results[0]!.success).toBe(true);
    expect(results[1]!.success).toBe(true);
    expect(results[2]!.success).toBe(true);
    if (results[0]!.success && results[2]!.success) {
      const state0 = results[0]!.data as { isUnlocked: boolean };
      const state2 = results[2]!.data as { isUnlocked: boolean };
      expect(state0.isUnlocked).toBe(false);
      expect(state2.isUnlocked).toBe(false);
    }
    await page.close();
  });

  test('EXPORT_BACKUP without unlock returns NOT_UNLOCKED', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'EXPORT_BACKUP' });
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
    await page.close();
  });

  test('rapid sequential messages all return valid responses', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const results = await page.evaluate<BackgroundResponse[]>(async () => {
      const responses: BackgroundResponse[] = [];
      for (let i = 0; i < 5; i++) {
        responses.push(await chrome.runtime.sendMessage({ type: 'GET_STATE' }));
      }
      return responses;
    });

    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.success).toBe(true);
      if (r.success) {
        const state = r.data as { isUnlocked: boolean };
        expect(state.isUnlocked).toBe(false);
      }
    }
    await page.close();
  });
});

test.describe('Background service worker: SETTINGS-001a', () => {
  test('UPDATE_AUTO_LOCK with valid minutes returns success', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'UPDATE_AUTO_LOCK', minutes: 5 });
    });

    expect(response.success).toBe(true);
    await page.close();
  });

  test('UPDATE_AUTO_LOCK with invalid minutes returns INVALID_INPUT', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'UPDATE_AUTO_LOCK', minutes: -1 });
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_INPUT');
    }
    await page.close();
  });

  test('CLEAR_ALL with wrong confirmation returns INVALID_INPUT', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({ type: 'CLEAR_ALL', confirmation: 'WRONG' });
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_INPUT');
    }
    await page.close();
  });

  test('IMPORT_BACKUP with invalid blob returns error', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const response = await page.evaluate<BackgroundResponse>(async () => {
      return await chrome.runtime.sendMessage({
        type: 'IMPORT_BACKUP', blob: 'not-valid-json', password: 'pw',
      });
    });

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('IMPORT_ERROR');
    }
    await page.close();
  });
});
