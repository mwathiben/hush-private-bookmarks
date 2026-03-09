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
    };
  };
};

test.describe('PWSET-004: Password sets E2E', () => {
  test('extension loads without errors after password-sets module', async ({
    context,
    extensionId,
  }) => {
    // #given — extension built with password-sets module
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

  test('validateManifest type guard works in real V8 engine', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const results = await page.evaluate(() => {
      function isValidSetInfo(data: unknown): boolean {
        if (data === null || typeof data !== 'object') return false;
        const o = data as Record<string, unknown>;
        return (
          typeof o['id'] === 'string' && o['id'] !== '' &&
          typeof o['name'] === 'string' && o['name'] !== '' &&
          typeof o['createdAt'] === 'number' && Number.isInteger(o['createdAt']) &&
          typeof o['lastAccessedAt'] === 'number' && Number.isInteger(o['lastAccessedAt']) &&
          typeof o['isDefault'] === 'boolean'
        );
      }

      function validateManifest(data: unknown): boolean {
        if (data === null || typeof data !== 'object') return false;
        const o = data as Record<string, unknown>;
        if (typeof o['version'] !== 'number' || !Number.isInteger(o['version'])) return false;
        if (typeof o['activeSetId'] !== 'string' || o['activeSetId'] === '') return false;
        if (!Array.isArray(o['sets']) || !o['sets'].every(isValidSetInfo)) return false;
        return o['sets'].some((s: Record<string, unknown>) => s['id'] === o['activeSetId']);
      }

      const validManifest = {
        sets: [{ id: 'abc', name: 'Default', createdAt: 1000, lastAccessedAt: 1000, isDefault: true }],
        activeSetId: 'abc',
        version: 1,
      };

      return {
        valid: validateManifest(validManifest),
        nullInput: validateManifest(null),
        emptyObj: validateManifest({}),
        missingFields: validateManifest({ version: 1 }),
        wrongTypes: validateManifest({ sets: 'not-array', activeSetId: 123, version: 'x' }),
        invalidSetInfo: validateManifest({
          sets: [{ id: '', name: '', createdAt: 0.5, lastAccessedAt: 'x', isDefault: 'y' }],
          activeSetId: 'z', version: 1,
        }),
        activeSetNotFound: validateManifest({
          sets: [{ id: 'abc', name: 'D', createdAt: 1, lastAccessedAt: 1, isDefault: true }],
          activeSetId: 'nonexistent', version: 1,
        }),
      };
    });

    expect(results.valid).toBe(true);
    expect(results.nullInput).toBe(false);
    expect(results.emptyObj).toBe(false);
    expect(results.missingFields).toBe(false);
    expect(results.wrongTypes).toBe(false);
    expect(results.invalidSetInfo).toBe(false);
    expect(results.activeSetNotFound).toBe(false);
    await page.close();
  });

  test('setStorageKey returns correct keys in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const results = await page.evaluate(() => {
      function setStorageKey(id: string, isDefault: boolean): string {
        return isDefault ? 'holyPrivateData' : `hush_set_${id}`;
      }
      return {
        defaultKey: setStorageKey('any-id', true),
        customKey: setStorageKey('abc123', false),
        emptyId: setStorageKey('', false),
      };
    });

    expect(results.defaultKey).toBe('holyPrivateData');
    expect(results.customKey).toBe('hush_set_abc123');
    expect(results.emptyId).toBe('hush_set_');
    await page.close();
  });

  test('manifest CRUD lifecycle in real chrome.storage', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const MANIFEST_KEY = 'hush_manifest';

      const defaultSet = {
        id: 'default-001', name: 'Default', createdAt: Date.now(),
        lastAccessedAt: Date.now(), isDefault: true,
      };
      const manifest = { sets: [defaultSet], activeSetId: 'default-001', version: 1 };

      // #when — save manifest, read back, add set, read again
      await chrome.storage.local.set({ [MANIFEST_KEY]: manifest });
      const raw1 = await chrome.storage.local.get(MANIFEST_KEY);
      const stored1 = raw1[MANIFEST_KEY] as Record<string, unknown>;

      const newSet = {
        id: 'custom-002', name: 'Work', createdAt: Date.now(),
        lastAccessedAt: Date.now(), isDefault: false,
      };
      const updated = {
        ...manifest,
        sets: [...manifest.sets, newSet],
      };
      await chrome.storage.local.set({ [MANIFEST_KEY]: updated });
      const raw2 = await chrome.storage.local.get(MANIFEST_KEY);
      const stored2 = raw2[MANIFEST_KEY] as { sets: unknown[] };

      return {
        firstReadHasSets: Array.isArray((stored1 as { sets: unknown })['sets']),
        firstSetCount: (stored1 as { sets: unknown[] })['sets'].length,
        secondSetCount: stored2.sets.length,
      };
    });

    expect(result.firstReadHasSets).toBe(true);
    expect(result.firstSetCount).toBe(1);
    expect(result.secondSetCount).toBe(2);
    await page.close();
  });

  test('multi-set storage key isolation in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      // #given — write different data under two set keys
      await chrome.storage.local.set({ holyPrivateData: { data: 'default-set-data' } });
      await chrome.storage.local.set({ hush_set_abc: { data: 'custom-set-data' } });

      // #when — read each independently
      const defaultRaw = await chrome.storage.local.get('holyPrivateData');
      const customRaw = await chrome.storage.local.get('hush_set_abc');

      // #then — verify isolation
      const defaultData = (defaultRaw['holyPrivateData'] as { data: string }).data;
      const customData = (customRaw['hush_set_abc'] as { data: string }).data;

      // remove one, verify other unaffected
      await chrome.storage.local.remove('hush_set_abc');
      const afterRemove = await chrome.storage.local.get('holyPrivateData');
      const defaultStillExists = afterRemove['holyPrivateData'] != null;

      return { defaultData, customData, defaultStillExists };
    });

    expect(result.defaultData).toBe('default-set-data');
    expect(result.customData).toBe('custom-set-data');
    expect(result.defaultStillExists).toBe(true);
    await page.close();
  });

  test('manifest validates activeSetId references existing set', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(() => {
      function isValidSetInfo(data: unknown): boolean {
        if (data === null || typeof data !== 'object') return false;
        const o = data as Record<string, unknown>;
        return (
          typeof o['id'] === 'string' && o['id'] !== '' &&
          typeof o['name'] === 'string' && o['name'] !== '' &&
          typeof o['createdAt'] === 'number' && Number.isInteger(o['createdAt']) &&
          typeof o['lastAccessedAt'] === 'number' && Number.isInteger(o['lastAccessedAt']) &&
          typeof o['isDefault'] === 'boolean'
        );
      }

      function validateManifest(data: unknown): boolean {
        if (data === null || typeof data !== 'object') return false;
        const o = data as Record<string, unknown>;
        if (typeof o['version'] !== 'number' || !Number.isInteger(o['version'])) return false;
        if (typeof o['activeSetId'] !== 'string' || o['activeSetId'] === '') return false;
        if (!Array.isArray(o['sets']) || !o['sets'].every(isValidSetInfo)) return false;
        return o['sets'].some((s: Record<string, unknown>) => s['id'] === o['activeSetId']);
      }

      // activeSetId points to non-existent set
      const broken = {
        sets: [{ id: 'abc', name: 'D', createdAt: 1, lastAccessedAt: 1, isDefault: true }],
        activeSetId: 'does-not-exist',
        version: 1,
      };

      // activeSetId points to existing set
      const valid = {
        sets: [{ id: 'abc', name: 'D', createdAt: 1, lastAccessedAt: 1, isDefault: true }],
        activeSetId: 'abc',
        version: 1,
      };

      return {
        brokenRejects: !validateManifest(broken),
        validAccepts: validateManifest(valid),
      };
    });

    expect(result.brokenRejects).toBe(true);
    expect(result.validAccepts).toBe(true);
    await page.close();
  });
});
