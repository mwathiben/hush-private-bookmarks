/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { test, expect } from './fixtures/extension';

declare const chrome: {
  storage: {
    local: {
      get: (key: string | null) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (key: string) => Promise<void>;
      getBytesInUse: (keys: string | string[] | null) => Promise<number>;
    };
  };
};

test.describe('Extension storage API roundtrip', () => {
  test('chrome.storage.local set/get roundtrip works in extension context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const testData = { salt: 'abc', encrypted: 'def', iv: 'ghi', iterations: 600000 };
      await chrome.storage.local.set({ holyPrivateData: testData });
      const stored = await chrome.storage.local.get('holyPrivateData');
      return stored['holyPrivateData'];
    });

    expect(result).toEqual({
      salt: 'abc',
      encrypted: 'def',
      iv: 'ghi',
      iterations: 600000,
    });

    await page.close();
  });

  test('chrome.storage.local stores under holyPrivateData key', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const keys = await page.evaluate(async () => {
      await chrome.storage.local.set({ holyPrivateData: { test: true } });
      const all = await chrome.storage.local.get(null);
      return Object.keys(all);
    });

    expect(keys).toContain('holyPrivateData');

    await page.close();
  });

  test('chrome.storage.local returns undefined for non-existent key', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const stored = await chrome.storage.local.get('nonExistentKey');
      return stored['nonExistentKey'];
    });

    expect(result).toBeUndefined();

    await page.close();
  });

  test('chrome.storage.local.remove clears data', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      await chrome.storage.local.set({ holyPrivateData: { data: 'exists' } });
      await chrome.storage.local.remove('holyPrivateData');
      const stored = await chrome.storage.local.get('holyPrivateData');
      return stored['holyPrivateData'];
    });

    expect(result).toBeUndefined();

    await page.close();
  });
});

test.describe('Extension storage error resilience', () => {
  test('chrome.storage.local stores and retrieves invalid string under holyPrivateData', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — store corrupted (non-EncryptedStore) string under the storage key
      await chrome.storage.local.set({ holyPrivateData: 'corrupted-not-json' });
      // #when — retrieve it
      const stored = await chrome.storage.local.get('holyPrivateData');
      // #then — Chrome API stores/retrieves any data; validation is app-level
      return { value: stored['holyPrivateData'], type: typeof stored['holyPrivateData'] };
    });

    expect(result.value).toBe('corrupted-not-json');
    expect(result.type).toBe('string');

    await page.close();
  });

  test('chrome.storage.local stores partial object without error', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — store object missing required EncryptedStore fields
      await chrome.storage.local.set({ holyPrivateData: { salt: 'abc' } });
      // #when — retrieve it
      const stored = await chrome.storage.local.get('holyPrivateData');
      return stored['holyPrivateData'];
    });

    // #then — Chrome API stores any object; validateEncryptedStore is the guard
    expect(result).toEqual({ salt: 'abc' });

    await page.close();
  });
});

test.describe('Extension storage rapid operations (retry-wrapped smoke)', () => {
  test('multiple rapid set/get cycles succeed without retry interference', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const results = await page.evaluate(async () => {
      // #given — 3 rapid sequential write/read cycles
      const outcomes: unknown[] = [];
      for (let i = 0; i < 3; i++) {
        const data = { salt: `s${i}`, encrypted: `e${i}`, iv: `v${i}`, iterations: 600000 };
        await chrome.storage.local.set({ holyPrivateData: data });
        const stored = await chrome.storage.local.get('holyPrivateData');
        outcomes.push(stored['holyPrivateData']);
      }
      return outcomes;
    });

    // #then — each cycle returns the data written in that iteration
    expect(results).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(results[i]).toEqual({
        salt: `s${i}`,
        encrypted: `e${i}`,
        iv: `v${i}`,
        iterations: 600000,
      });
    }

    await page.close();
  });
});

test.describe('Extension storage utility API coverage (STORAGE-004)', () => {
  test('chrome.storage.local.getBytesInUse returns a positive number', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — some data in storage
      await chrome.storage.local.set({ holyPrivateData: { salt: 'a', encrypted: 'b', iv: 'c', iterations: 600000 } });
      // #when — check bytes in use
      return chrome.storage.local.getBytesInUse(null);
    });

    // #then — returns a positive number
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
    await page.close();
  });

  test('chrome.storage.local.get confirms data existence after set', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — data stored under holyPrivateData key
      await chrome.storage.local.set({ holyPrivateData: { data: 'exists' } });
      // #when — retrieve and check existence
      const stored = await chrome.storage.local.get('holyPrivateData');
      return stored['holyPrivateData'] != null;
    });

    // #then — data exists
    expect(result).toBe(true);
    await page.close();
  });
});
