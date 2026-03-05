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

/** Type guard: validates unknown data conforms to EncryptedStore shape. */
export function validateEncryptedStore(data: unknown): data is EncryptedStore {
  if (data === null || typeof data !== 'object') {
    return false;
  }
  const record = data as Record<string, unknown>;
  return (
    typeof record['salt'] === 'string' &&
    record['salt'] !== '' &&
    typeof record['encrypted'] === 'string' &&
    record['encrypted'] !== '' &&
    typeof record['iv'] === 'string' &&
    record['iv'] !== '' &&
    typeof record['iterations'] === 'number' &&
    Number.isFinite(record['iterations']) &&
    record['iterations'] > 0
  );
}

/** Encrypt plaintext and persist to extension storage under STORAGE_KEY. */
export async function saveEncryptedData(
  plaintext: string,
  password: string,
): Promise<Result<void, StorageError>> {
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
        { cause: error instanceof Error ? error : new Error(String(error)) },
      ),
    };
  }
}

/** Load encrypted blob from extension storage, validate, and decrypt. */
export async function loadEncryptedData(
  password: string,
): Promise<Result<string, StorageError | InvalidPasswordError>> {
  let raw: Record<string, unknown>;
  try {
    raw = await browser.storage.local.get(STORAGE_KEY);
  } catch (error) {
    return {
      success: false,
      error: new StorageError(
        'Failed to read from extension storage',
        { key: STORAGE_KEY, operation: 'read', reason: 'read_failed' },
        { cause: error instanceof Error ? error : new Error(String(error)) },
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
    if (error instanceof InvalidPasswordError) {
      return { success: false, error };
    }
    if (error instanceof DecryptionError) {
      return {
        success: false,
        error: new StorageError(
          'Decryption failed: data may be corrupted',
          { key: STORAGE_KEY, operation: 'read', reason: 'corrupted' },
          { cause: error },
        ),
      };
    }
    return {
      success: false,
      error: new StorageError(
        'Unexpected error during decryption',
        { key: STORAGE_KEY, operation: 'read', reason: 'read_failed' },
        { cause: error instanceof Error ? error : new Error(String(error)) },
      ),
    };
  }
}
