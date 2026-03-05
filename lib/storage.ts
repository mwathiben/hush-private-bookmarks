/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * Derived from Holy Private Bookmarks (GPL-3.0)
 * Copyright (C) 2026 OSV-IT-Studio
 * Source: https://github.com/OSV-IT-Studio/holy-private-bookmarks
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { browser } from 'wxt/browser';

import type { EncryptedStore, Result } from '@/lib/types';
import { DecryptionError, InvalidPasswordError, StorageError } from '@/lib/errors';
import { decrypt, encrypt } from '@/lib/crypto';

/** Holy PB backward-compatible key for the single encrypted blob. */
export const STORAGE_KEY = 'holyPrivateData';

export const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [100, 200],
} as const;

function isRetryable(error: StorageError | InvalidPasswordError): boolean {
  if (error instanceof InvalidPasswordError) return false;
  return error.context.reason === 'read_failed' || error.context.reason === 'write_failed';
}

async function withRetry<T, E extends StorageError | InvalidPasswordError>(
  operation: () => Promise<Result<T, E>>,
): Promise<Result<T, E>> {
  let lastResult = await operation();
  for (let attempt = 1; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    if (lastResult.success || !isRetryable(lastResult.error)) {
      return lastResult;
    }
    const delay = RETRY_CONFIG.delays[attempt - 1];
    if (delay !== undefined) {
      await new Promise<void>(resolve => { setTimeout(resolve, delay); });
    }
    lastResult = await operation();
  }
  return lastResult;
}

/** Type guard: validates unknown data conforms to EncryptedStore shape. */
export function validateEncryptedStore(data: unknown): data is EncryptedStore {
  if (data === null || typeof data !== 'object') {
    return false;
  }
  const record = data as Record<string, unknown>;
  const salt = record['salt'];
  const encrypted = record['encrypted'];
  const iv = record['iv'];
  const iterations = record['iterations'];
  return (
    typeof salt === 'string' && salt !== '' &&
    typeof encrypted === 'string' && encrypted !== '' &&
    typeof iv === 'string' && iv !== '' &&
    typeof iterations === 'number' && Number.isInteger(iterations) && iterations > 0
  );
}

/** Encrypt plaintext and persist to extension storage under STORAGE_KEY. */
export async function saveEncryptedData(
  plaintext: string,
  password: string,
): Promise<Result<void, StorageError>> {
  return withRetry(async () => {
    try {
      const store = await encrypt(plaintext, password);
      await browser.storage.local.set({ [STORAGE_KEY]: store });
      return { success: true, data: undefined };
    } catch (error) {
      const isQuotaError =
        error instanceof Error &&
        (error.name === 'QuotaExceededError' ||
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          (typeof DOMException !== 'undefined' &&
            error instanceof DOMException &&
            error.code === 22));
      return {
        success: false,
        error: new StorageError(
          isQuotaError
            ? 'Storage quota exceeded'
            : 'Failed to save encrypted data',
          {
            key: STORAGE_KEY,
            operation: 'write',
            reason: isQuotaError ? 'quota_exceeded' : 'write_failed',
          },
          { cause: new Error('Storage write failed') },
        ),
      };
    }
  });
}

function handleDecryptError(
  error: unknown,
): Result<never, StorageError | InvalidPasswordError> {
  if (error instanceof InvalidPasswordError) {
    return { success: false, error };
  }
  if (error instanceof DecryptionError) {
    return {
      success: false,
      error: new StorageError(
        'Decryption failed: data may be corrupted',
        { key: STORAGE_KEY, operation: 'read', reason: 'corrupted' },
        { cause: new Error('Decryption failed') },
      ),
    };
  }
  return {
    success: false,
    error: new StorageError(
      'Unexpected error during decryption',
      { key: STORAGE_KEY, operation: 'read', reason: 'read_failed' },
      { cause: new Error('Storage operation failed') },
    ),
  };
}

/** Load encrypted blob from extension storage, validate, and decrypt. */
export async function loadEncryptedData(
  password: string,
): Promise<Result<string, StorageError | InvalidPasswordError>> {
  return withRetry<string, StorageError | InvalidPasswordError>(async () => {
    let raw: Record<string, unknown>;
    try {
      raw = await browser.storage.local.get(STORAGE_KEY);
    } catch {
      return {
        success: false,
        error: new StorageError(
          'Failed to read from extension storage',
          { key: STORAGE_KEY, operation: 'read', reason: 'read_failed' },
          { cause: new Error('Storage read failed') },
        ),
      };
    }

    const stored = raw[STORAGE_KEY];
    if (stored == null) {
      return {
        success: false,
        error: new StorageError(
          'No encrypted data found',
          { key: STORAGE_KEY, operation: 'read', reason: 'not_found' },
        ),
      };
    }

    if (!validateEncryptedStore(stored)) {
      return {
        success: false,
        error: new StorageError(
          'Stored data is not a valid encrypted store',
          { key: STORAGE_KEY, operation: 'read', reason: 'corrupted' },
        ),
      };
    }

    try {
      const plaintext = await decrypt(stored, password);
      return { success: true, data: plaintext };
    } catch (error) {
      return handleDecryptError(error);
    }
  });
}

/**
 * Default chrome.storage.local quota in bytes (10 MB).
 * Extensions can request the `unlimitedStorage` permission to bypass this limit.
 */
export const DEFAULT_STORAGE_QUOTA = 10_485_760;

/** Check if encrypted data exists without decrypting. */
export async function hasData(): Promise<Result<boolean, StorageError>> {
  return withRetry(async () => {
    try {
      const raw = await browser.storage.local.get(STORAGE_KEY);
      return { success: true, data: raw[STORAGE_KEY] != null };
    } catch {
      return {
        success: false,
        error: new StorageError(
          'Failed to check for existing data',
          { key: STORAGE_KEY, operation: 'read', reason: 'read_failed' },
          { cause: new Error('Storage read failed') },
        ),
      };
    }
  });
}

/** Remove all Hush data from extension storage. */
export async function clearAll(): Promise<Result<void, StorageError>> {
  return withRetry(async () => {
    try {
      await browser.storage.local.remove(STORAGE_KEY);
      return { success: true, data: undefined };
    } catch {
      return {
        success: false,
        error: new StorageError(
          'Failed to clear storage data',
          { key: STORAGE_KEY, operation: 'delete', reason: 'write_failed' },
          { cause: new Error('Storage delete failed') },
        ),
      };
    }
  });
}

/**
 * Report storage consumption against the default quota.
 * On Firefox (which lacks getBytesInUse for storage.local), falls back to
 * estimating usage via JSON serialization size.
 */
export async function getStorageUsage(): Promise<
  Result<{ used: number; quota: number }, StorageError>
> {
  return withRetry(async () => {
    try {
      let used: number;
      const storage = browser.storage.local;
      if ('getBytesInUse' in storage && typeof storage.getBytesInUse === 'function') {
        used = await storage.getBytesInUse(null);
      } else {
        const all = await storage.get(null);
        used = new Blob([JSON.stringify(all)]).size;
      }
      return { success: true, data: { used, quota: DEFAULT_STORAGE_QUOTA } };
    } catch {
      return {
        success: false,
        error: new StorageError(
          'Failed to get storage usage',
          { key: STORAGE_KEY, operation: 'read', reason: 'read_failed' },
          { cause: new Error('Storage usage check failed') },
        ),
      };
    }
  });
}
