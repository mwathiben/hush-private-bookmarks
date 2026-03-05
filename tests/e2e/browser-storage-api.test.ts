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

test.describe('Extension storage type guard validation (STORAGE-005)', () => {
  test('valid EncryptedStore shape is preserved through chrome.storage.local roundtrip', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — valid EncryptedStore-shaped object
      const store = { salt: 'dGVzdA==', encrypted: 'ZW5j', iv: 'aXYxMg==', iterations: 600000 };
      await chrome.storage.local.set({ holyPrivateData: store });
      // #when — retrieve from storage
      const raw = await chrome.storage.local.get('holyPrivateData');
      const retrieved = raw['holyPrivateData'] as Record<string, unknown>;
      return {
        saltType: typeof retrieved['salt'],
        encryptedType: typeof retrieved['encrypted'],
        ivType: typeof retrieved['iv'],
        iterationsType: typeof retrieved['iterations'],
        iterationsValue: retrieved['iterations'],
      };
    });

    expect(result.saltType).toBe('string');
    expect(result.encryptedType).toBe('string');
    expect(result.ivType).toBe('string');
    expect(result.iterationsType).toBe('number');
    expect(result.iterationsValue).toBe(600000);
    await page.close();
  });

  test('object with wrong field types retains incorrect types through storage', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — object where iterations is string (wrong type)
      await chrome.storage.local.set({
        holyPrivateData: { salt: 's', encrypted: 'e', iv: 'i', iterations: '600000' },
      });
      const raw = await chrome.storage.local.get('holyPrivateData');
      const retrieved = raw['holyPrivateData'] as Record<string, unknown>;
      return typeof retrieved['iterations'];
    });

    // #then — chrome.storage preserves wrong type; type guard must catch this
    expect(result).toBe('string');
    await page.close();
  });

  test('null stored under holyPrivateData is retrievable as null', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — null stored under the storage key
      await chrome.storage.local.set({ holyPrivateData: null });
      const raw = await chrome.storage.local.get('holyPrivateData');
      return raw['holyPrivateData'];
    });

    // #then — null is preserved; validateEncryptedStore must reject this
    expect(result).toBeNull();
    await page.close();
  });
});
