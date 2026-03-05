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

import { encrypt, decrypt } from '@/lib/crypto';
import {
  STORAGE_KEY,
  saveEncryptedData,
  loadEncryptedData,
} from '@/lib/storage';

const MOCK_STORE: EncryptedStore = {
  salt: 'dGVzdHNhbHQxMjM0NQ==',
  encrypted: 'ZW5jcnlwdGVkZGF0YTE=',
  iv: 'dGVzdGl2MTIz',
  iterations: 600_000,
};

const MOCK_PLAINTEXT = '{"type":"folder","id":"root","name":"Root","children":[],"dateAdded":0}';
const MOCK_PASSWORD = 'test-password';

describe('STORAGE-001: Encrypted save and load roundtrip', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    vi.mocked(encrypt).mockResolvedValue(MOCK_STORE);
    vi.mocked(decrypt).mockResolvedValue(MOCK_PLAINTEXT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('STORAGE_KEY constant equals holyPrivateData', () => {
    // #given — the exported constant
    // #when — imported
    // #then — matches Holy PB storage key
    expect(STORAGE_KEY).toBe('holyPrivateData');
  });

  it('saveEncryptedData stores encrypted data under holyPrivateData key', async () => {
    // #given — mocked encrypt returns MOCK_STORE
    // #when — save encrypted data
    const result = await saveEncryptedData(MOCK_PLAINTEXT, MOCK_PASSWORD);

    // #then — data stored under STORAGE_KEY in browser.storage.local
    expect(result.success).toBe(true);
    const raw = await browser.storage.local.get(STORAGE_KEY);
    expect(raw[STORAGE_KEY]).toEqual(MOCK_STORE);
  });

  it('saveEncryptedData stores valid EncryptedStore JSON', async () => {
    // #given — mocked encrypt returns MOCK_STORE
    // #when — save and read raw storage
    await saveEncryptedData(MOCK_PLAINTEXT, MOCK_PASSWORD);
    const raw = await browser.storage.local.get(STORAGE_KEY);
    const stored = raw[STORAGE_KEY] as Record<string, unknown>;

    // #then — stored object has all 4 EncryptedStore fields with correct types
    expect(typeof stored['salt']).toBe('string');
    expect(typeof stored['encrypted']).toBe('string');
    expect(typeof stored['iv']).toBe('string');
    expect(typeof stored['iterations']).toBe('number');
  });

  it('loadEncryptedData retrieves and decrypts data (roundtrip)', async () => {
    // #given — data saved with saveEncryptedData
    await saveEncryptedData(MOCK_PLAINTEXT, MOCK_PASSWORD);

    // #when — load with same password
    const result = await loadEncryptedData(MOCK_PASSWORD);

    // #then — roundtrip preserves plaintext
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(MOCK_PLAINTEXT);
    }
  });

  it('loadEncryptedData returns not_found error when no data exists', async () => {
    // #given — fresh storage, no data saved
    // #when — attempt to load
    const result = await loadEncryptedData(MOCK_PASSWORD);

    // #then — Result failure with StorageError reason 'not_found'
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const storageErr = result.error as StorageError;
      expect(storageErr.context.reason).toBe('not_found');
      expect(storageErr.context.key).toBe(STORAGE_KEY);
      expect(storageErr.context.operation).toBe('read');
    }
  });
});
