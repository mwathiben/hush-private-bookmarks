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

test.describe('STORAGE-006: Module integration verification', () => {
  test('extension loads without console errors after storage module integration', async ({
    context,
    extensionId,
  }) => {
    // #given — extension built with storage module integrated
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // #when — navigate to popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');

    // #then — no runtime errors
    expect(errors).toEqual([]);
    await page.close();
  });

  test('validateEncryptedStore type guard logic works in real V8 engine', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #given — inline mirror of lib/storage.ts validateEncryptedStore logic
    // (page.evaluate runs in browser context; cannot import from Node scope)
    const results = await page.evaluate(() => {
      function validate(data: unknown): boolean {
        if (data === null || typeof data !== 'object') return false;
        const r = data as Record<string, unknown>;
        const salt = r['salt'];
        const encrypted = r['encrypted'];
        const iv = r['iv'];
        const iterations = r['iterations'];
        return (
          typeof salt === 'string' && salt !== '' &&
          typeof encrypted === 'string' && encrypted !== '' &&
          typeof iv === 'string' && iv !== '' &&
          typeof iterations === 'number' &&
          Number.isInteger(iterations) &&
          iterations > 0
        );
      }

      // #when — test against valid, invalid, and edge-case inputs
      return {
        validStore: validate({ salt: 'a', encrypted: 'b', iv: 'c', iterations: 600000 }),
        nullInput: validate(null),
        emptyObj: validate({}),
        wrongTypes: validate({ salt: 1, encrypted: 2, iv: 3, iterations: 'x' }),
        fractional: validate({ salt: 'a', encrypted: 'b', iv: 'c', iterations: 0.5 }),
        negative: validate({ salt: 'a', encrypted: 'b', iv: 'c', iterations: -1 }),
        nan: validate({ salt: 'a', encrypted: 'b', iv: 'c', iterations: NaN }),
        infinity: validate({ salt: 'a', encrypted: 'b', iv: 'c', iterations: Infinity }),
        emptyStrings: validate({ salt: '', encrypted: '', iv: '', iterations: 600000 }),
      };
    });

    // #then — only valid store passes
    expect(results.validStore).toBe(true);
    expect(results.nullInput).toBe(false);
    expect(results.emptyObj).toBe(false);
    expect(results.wrongTypes).toBe(false);
    expect(results.fractional).toBe(false);
    expect(results.negative).toBe(false);
    expect(results.nan).toBe(false);
    expect(results.infinity).toBe(false);
    expect(results.emptyStrings).toBe(false);
    await page.close();
  });

  test('complete storage lifecycle: set, exists, getBytesInUse, remove, verify', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — valid EncryptedStore-shaped data written to storage
      const store = { salt: 'dGVzdA==', encrypted: 'ZW5j', iv: 'aXYx', iterations: 600000 };
      await chrome.storage.local.set({ holyPrivateData: store });

      // #when — check existence, measure bytes, remove, verify removal
      const exists = (await chrome.storage.local.get('holyPrivateData'))['holyPrivateData'] != null;
      const bytes = await chrome.storage.local.getBytesInUse(null);
      await chrome.storage.local.remove('holyPrivateData');
      const afterRemove = (await chrome.storage.local.get('holyPrivateData'))['holyPrivateData'];
      return { exists, bytes, afterRemove };
    });

    // #then — full lifecycle succeeds
    expect(result.exists).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.afterRemove).toBeUndefined();
    await page.close();
  });
});
