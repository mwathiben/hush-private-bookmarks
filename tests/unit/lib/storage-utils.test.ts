/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import { StorageError } from '@/lib/errors';
import type { EncryptedStore } from '@/lib/types';

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}));

import {
  STORAGE_KEY,
  DEFAULT_STORAGE_QUOTA,
  hasData,
  clearAll,
  getStorageUsage,
} from '@/lib/storage';

const MOCK_STORE: EncryptedStore = {
  salt: 'dGVzdHNhbHQxMjM0NQ==',
  encrypted: 'ZW5jcnlwdGVkZGF0YTE=',
  iv: 'dGVzdGl2MTIz',
  iterations: 600_000,
};

describe('STORAGE-004: Utility functions — hasData, clearAll, getStorageUsage', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('DEFAULT_STORAGE_QUOTA equals 10_485_760 (10MB)', () => {
    // #given — the exported constant
    // #when — imported
    // #then — matches 10MB in bytes
    expect(DEFAULT_STORAGE_QUOTA).toBe(10_485_760);
  });

  it('hasData returns true when data exists under STORAGE_KEY', async () => {
    // #given — data stored under STORAGE_KEY
    await browser.storage.local.set({ [STORAGE_KEY]: MOCK_STORE });

    // #when — check if data exists
    const result = await hasData();

    // #then — Result success with true
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
  });

  it('hasData returns false when no data exists', async () => {
    // #given — fresh storage, no data saved
    // #when — check if data exists
    const result = await hasData();

    // #then — Result success with false
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
  });

  it('clearAll removes data from storage', async () => {
    // #given — data stored under STORAGE_KEY
    await browser.storage.local.set({ [STORAGE_KEY]: MOCK_STORE });

    // #when — clear all Hush data
    const result = await clearAll();

    // #then — Result success, key no longer in storage
    expect(result.success).toBe(true);
    const raw = await browser.storage.local.get(STORAGE_KEY);
    expect(raw[STORAGE_KEY]).toBeUndefined();
  });

  it('clearAll followed by hasData returns false', async () => {
    // #given — data stored under STORAGE_KEY
    await browser.storage.local.set({ [STORAGE_KEY]: MOCK_STORE });

    // #when — clear then check
    await clearAll();
    const result = await hasData();

    // #then — no data exists
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
  });

  it('getStorageUsage returns { used: number, quota: number }', async () => {
    // #given — some data in storage
    await browser.storage.local.set({ [STORAGE_KEY]: MOCK_STORE });

    // #when — get storage usage
    const result = await getStorageUsage();

    // #then — quota matches constant, used is a positive number
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quota).toBe(DEFAULT_STORAGE_QUOTA);
      expect(typeof result.data.used).toBe('number');
      expect(result.data.used).toBeGreaterThan(0);
    }
  });
});

describe('STORAGE-004: Error paths for utility functions', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hasData returns StorageError on read failure', async () => {
    // #given — browser.storage.local.get rejects (3x for retry exhaustion)
    const spy = vi.spyOn(browser.storage.local, 'get');
    spy
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'));

    // #when — check if data exists
    const result = await hasData();

    // #then — Result failure with read_failed
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('read_failed');
      expect(err.context.operation).toBe('read');
    }
  });

  it('clearAll returns StorageError on delete failure', async () => {
    // #given — browser.storage.local.remove rejects (3x for retry exhaustion)
    const spy = vi.spyOn(browser.storage.local, 'remove');
    spy
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'));

    // #when — attempt to clear
    const result = await clearAll();

    // #then — Result failure with operation 'delete' and reason 'write_failed'
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.operation).toBe('delete');
      expect(err.context.reason).toBe('write_failed');
    }
  });

  it('getStorageUsage returns StorageError on failure', async () => {
    // #given — browser.storage.local.get rejects (3x for retry exhaustion)
    const spy = vi.spyOn(browser.storage.local, 'get');
    spy
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'));

    // #when — get storage usage
    const result = await getStorageUsage();

    // #then — Result failure with read_failed
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('read_failed');
    }
  });
});
