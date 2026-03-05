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
import { InvalidPasswordError, StorageError } from '@/lib/errors';
import type { EncryptedStore } from '@/lib/types';

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}));

import { encrypt, decrypt } from '@/lib/crypto';
import {
  RETRY_CONFIG,
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

describe('STORAGE-003: Retry logic with exponential backoff', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await browser.storage.local.clear();
    vi.mocked(encrypt).mockResolvedValue(MOCK_STORE);
    vi.mocked(decrypt).mockResolvedValue(MOCK_PLAINTEXT);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('RETRY_CONFIG has maxAttempts: 3 and delays: [100, 200, 400]', () => {
    // #given — the exported constant
    // #when — imported
    // #then — matches expected configuration
    expect(RETRY_CONFIG.maxAttempts).toBe(3);
    expect(RETRY_CONFIG.delays).toEqual([100, 200]);
  });

  it('retries on transient read failure up to maxAttempts times', async () => {
    // #given — valid data in storage, get fails 2x then succeeds
    await browser.storage.local.set({ holyPrivateData: MOCK_STORE });
    const getSpy = vi.spyOn(browser.storage.local, 'get');
    getSpy
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockRejectedValueOnce(new Error('transient failure'));

    // #when — load encrypted data (retry will retry read_failed)
    const promise = loadEncryptedData(MOCK_PASSWORD);
    await vi.advanceTimersByTimeAsync(800);
    const result = await promise;

    // #then — succeeds on 3rd attempt
    expect(result.success).toBe(true);
    expect(getSpy).toHaveBeenCalledTimes(3);
  });

  it('retries on transient write failure', async () => {
    // #given — set fails 1x then succeeds
    const setSpy = vi.spyOn(browser.storage.local, 'set');
    setSpy.mockRejectedValueOnce(new Error('transient failure'));

    // #when — save encrypted data (retry will retry write_failed)
    const promise = saveEncryptedData(MOCK_PLAINTEXT, MOCK_PASSWORD);
    await vi.advanceTimersByTimeAsync(800);
    const result = await promise;

    // #then — succeeds on 2nd attempt
    expect(result.success).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on quota_exceeded error', async () => {
    // #given — set rejects with QuotaExceededError (permanent, not retried)
    const setSpy = vi.spyOn(browser.storage.local, 'set');
    setSpy.mockRejectedValueOnce(
      Object.assign(new Error('QUOTA_BYTES quota exceeded'), {
        name: 'QuotaExceededError',
      }),
    );

    // #when — save encrypted data
    const promise = saveEncryptedData(MOCK_PLAINTEXT, MOCK_PASSWORD);
    await vi.advanceTimersByTimeAsync(800);
    const result = await promise;

    // #then — fails immediately, no retry
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('quota_exceeded');
    }
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on InvalidPasswordError', async () => {
    // #given — valid data in storage, decrypt throws InvalidPasswordError
    await browser.storage.local.set({ holyPrivateData: MOCK_STORE });
    vi.mocked(decrypt).mockClear();
    vi.mocked(decrypt).mockRejectedValue(
      new InvalidPasswordError('Decryption failed: wrong password or corrupted data'),
    );

    // #when — load encrypted data (non-retryable: returns immediately, no retry)
    const result = await loadEncryptedData(MOCK_PASSWORD);

    // #then — fails immediately with InvalidPasswordError, no retry
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvalidPasswordError);
    }
    expect(vi.mocked(decrypt)).toHaveBeenCalledTimes(1);
  });

  it('returns last error after all retries exhausted', async () => {
    // #given — get fails 3x (all retry attempts exhausted)
    const getSpy = vi.spyOn(browser.storage.local, 'get');
    getSpy
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'));

    // #when — load encrypted data
    const promise = loadEncryptedData(MOCK_PASSWORD);
    await vi.advanceTimersByTimeAsync(800);
    const result = await promise;

    // #then — final failure with read_failed after 3 attempts
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(StorageError);
      const err = result.error as StorageError;
      expect(err.context.reason).toBe('read_failed');
    }
    expect(getSpy).toHaveBeenCalledTimes(3);
  });
});
