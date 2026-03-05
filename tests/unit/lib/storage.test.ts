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
import {
  DecryptionError,
  InvalidPasswordError,
  StorageError,
} from '@/lib/errors';
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

describe('STORAGE-002: Error handling for all failure modes', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    vi.mocked(encrypt).mockResolvedValue(MOCK_STORE);
    vi.mocked(decrypt).mockResolvedValue(MOCK_PLAINTEXT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loadEncryptedData returns corrupted error for invalid JSON in storage', async () => {
    // #given — raw string stored under STORAGE_KEY (not an EncryptedStore object)
    await browser.storage.local.set({ [STORAGE_KEY]: 'not-json' });

    // #when — attempt to load
    const result = await loadEncryptedData(MOCK_PASSWORD);

    // #then — Result failure with reason 'corrupted'
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('corrupted');
      expect(err.context.key).toBe(STORAGE_KEY);
      expect(err.context.operation).toBe('read');
    }
  });

  it('loadEncryptedData returns corrupted error for valid JSON but not EncryptedStore', async () => {
    // #given — object stored but missing required EncryptedStore fields
    await browser.storage.local.set({ [STORAGE_KEY]: { foo: 'bar' } });

    // #when — attempt to load
    const result = await loadEncryptedData(MOCK_PASSWORD);

    // #then — Result failure with reason 'corrupted'
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('corrupted');
    }
  });

  it('loadEncryptedData returns InvalidPasswordError for wrong password', async () => {
    // #given — valid EncryptedStore in storage, decrypt throws InvalidPasswordError
    await browser.storage.local.set({ [STORAGE_KEY]: MOCK_STORE });
    vi.mocked(decrypt).mockRejectedValueOnce(
      new InvalidPasswordError('Decryption failed: wrong password or corrupted data'),
    );

    // #when — attempt to load with wrong password
    const result = await loadEncryptedData('wrong-password');

    // #then — Result failure with InvalidPasswordError (not StorageError)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvalidPasswordError);
      expect(result.error).not.toBeInstanceOf(StorageError);
    }
  });

  it('saveEncryptedData returns quota_exceeded error when storage quota exceeded', async () => {
    // #given — browser.storage.local.set rejects with QuotaExceededError
    vi.spyOn(browser.storage.local, 'set').mockRejectedValueOnce(
      Object.assign(new Error('QUOTA_BYTES quota exceeded'), {
        name: 'QuotaExceededError',
      }),
    );

    // #when — attempt to save
    const result = await saveEncryptedData(MOCK_PLAINTEXT, MOCK_PASSWORD);

    // #then — Result failure with reason 'quota_exceeded'
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('quota_exceeded');
      expect(err.context.operation).toBe('write');
      expect(err.context.key).toBe(STORAGE_KEY);
    }
  });

  it('saveEncryptedData returns write_failed error for generic storage failure', async () => {
    // #given — browser.storage.local.set rejects with generic Error (3x for retry exhaustion)
    const spy = vi.spyOn(browser.storage.local, 'set');
    spy
      .mockRejectedValueOnce(new Error('disk full'))
      .mockRejectedValueOnce(new Error('disk full'))
      .mockRejectedValueOnce(new Error('disk full'));

    // #when — attempt to save
    const result = await saveEncryptedData(MOCK_PLAINTEXT, MOCK_PASSWORD);

    // #then — Result failure with reason 'write_failed'
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('write_failed');
      expect(err.context.operation).toBe('write');
    }
  });

  it('loadEncryptedData returns read_failed error for generic storage failure', async () => {
    // #given — browser.storage.local.get rejects with generic Error (3x for retry exhaustion)
    const spy = vi.spyOn(browser.storage.local, 'get');
    spy
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockRejectedValueOnce(new Error('storage unavailable'));

    // #when — attempt to load
    const result = await loadEncryptedData(MOCK_PASSWORD);

    // #then — Result failure with reason 'read_failed'
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('read_failed');
      expect(err.context.operation).toBe('read');
    }
  });

  it('loadEncryptedData returns corrupted error when DecryptionError thrown by decrypt', async () => {
    // #given — valid EncryptedStore in storage, decrypt throws DecryptionError
    await browser.storage.local.set({ [STORAGE_KEY]: MOCK_STORE });
    vi.mocked(decrypt).mockRejectedValueOnce(
      new DecryptionError('Invalid base64 in encrypted store'),
    );

    // #when — attempt to load
    const result = await loadEncryptedData(MOCK_PASSWORD);

    // #then — Result failure with StorageError reason 'corrupted', sanitized cause
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('corrupted');
      expect(err.cause).toBeInstanceOf(Error);
    }
  });

  it('loadEncryptedData returns read_failed for unexpected non-typed error from decrypt', async () => {
    // #given — valid EncryptedStore, decrypt throws a plain Error (3x for retry exhaustion)
    await browser.storage.local.set({ [STORAGE_KEY]: MOCK_STORE });
    vi.mocked(decrypt)
      .mockRejectedValueOnce(new Error('Password cannot be empty'))
      .mockRejectedValueOnce(new Error('Password cannot be empty'))
      .mockRejectedValueOnce(new Error('Password cannot be empty'));

    // #when — attempt to load
    const result = await loadEncryptedData(MOCK_PASSWORD);

    // #then — wrapped as StorageError with reason 'read_failed' (unknown error type)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('read_failed');
      expect(err.cause).toBeInstanceOf(Error);
    }
  });

  it('saveEncryptedData wraps non-Error thrown values safely', async () => {
    // #given — browser.storage.local.set rejects with a string (3x for retry exhaustion)
    const spy = vi.spyOn(browser.storage.local, 'set');
    spy
      .mockRejectedValueOnce('raw string error')
      .mockRejectedValueOnce('raw string error')
      .mockRejectedValueOnce('raw string error');

    // #when — attempt to save
    const result = await saveEncryptedData(MOCK_PLAINTEXT, MOCK_PASSWORD);

    // #then — wrapped in StorageError with cause as new Error(String(...))
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('write_failed');
      expect(err.cause).toBeInstanceOf(Error);
    }
  });
});
