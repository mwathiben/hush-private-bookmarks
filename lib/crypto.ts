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

import type { CryptoConfig, EncryptedStore } from '@/lib/types';
import { DecryptionError, InvalidPasswordError } from '@/lib/errors';

/**
 * Cryptographic parameters extracted verbatim from Holy PB.
 * Iterations, algorithm, key length, IV length, and hash MUST NOT be modified.
 */
export const CRYPTO_CONFIG = {
  iterations: 600_000,
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  hashAlgorithm: 'SHA-256',
} as const satisfies CryptoConfig;

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

export async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: CRYPTO_CONFIG.iterations,
      hash: CRYPTO_CONFIG.hashAlgorithm,
    },
    keyMaterial,
    { name: CRYPTO_CONFIG.algorithm, length: CRYPTO_CONFIG.keyLength },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(
  plaintext: string,
  password: string,
): Promise<EncryptedStore> {
  if (password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const salt = generateSalt();
  const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.ivLength));
  const key = await deriveKey(password, salt);

  const encoder = new TextEncoder();
  const encoded = encoder.encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: CRYPTO_CONFIG.algorithm, iv, tagLength: 128 },
    key,
    encoded,
  );

  const encryptedArray = new Uint8Array(encrypted);

  const store: EncryptedStore = {
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    encrypted: uint8ArrayToBase64(encryptedArray),
    iterations: CRYPTO_CONFIG.iterations,
  };

  for (let i = 0; i < encoded.length; i++) {
    encoded[i] = 0;
  }

  return store;
}

interface StoreFields {
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  encryptedBytes: Uint8Array<ArrayBuffer>;
}

const SALT_BYTES = 16;
const GCM_TAG_BYTES = 16;

function validateAndParseStore(store: EncryptedStore): StoreFields {
  if (store.iterations !== CRYPTO_CONFIG.iterations) {
    throw new DecryptionError(
      `Unsupported iteration count: ${store.iterations}`,
      { cause: new Error(`Expected ${CRYPTO_CONFIG.iterations}, got ${store.iterations}`) },
    );
  }

  let salt: Uint8Array<ArrayBuffer>;
  let iv: Uint8Array<ArrayBuffer>;
  let encryptedBytes: Uint8Array<ArrayBuffer>;

  try {
    salt = base64ToUint8Array(store.salt);
    iv = base64ToUint8Array(store.iv);
    encryptedBytes = base64ToUint8Array(store.encrypted);
  } catch (error) {
    throw new DecryptionError('Invalid base64 in encrypted store', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }

  if (salt.byteLength !== SALT_BYTES) {
    throw new DecryptionError(
      `Invalid salt length: expected ${SALT_BYTES} bytes, got ${salt.byteLength}`,
    );
  }

  if (iv.byteLength !== CRYPTO_CONFIG.ivLength) {
    throw new DecryptionError(
      `Invalid IV length: expected ${CRYPTO_CONFIG.ivLength} bytes, got ${iv.byteLength}`,
    );
  }

  if (encryptedBytes.byteLength < GCM_TAG_BYTES) {
    throw new DecryptionError(
      `Invalid encrypted data length: expected at least ${GCM_TAG_BYTES} bytes, got ${encryptedBytes.byteLength}`,
    );
  }

  return { salt, iv, encryptedBytes };
}

export async function decrypt(
  store: EncryptedStore,
  password: string,
): Promise<string> {
  if (password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const { salt, iv, encryptedBytes } = validateAndParseStore(store);
  const key = await deriveKey(password, salt);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: CRYPTO_CONFIG.algorithm, iv, tagLength: 128 },
      key,
      encryptedBytes,
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'OperationError') {
      throw new InvalidPasswordError(
        'Decryption failed: wrong password or corrupted data',
        { cause: error },
      );
    }
    throw new DecryptionError('Decryption failed', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  let decoded: string;
  try {
    decoded = decoder.decode(decryptedBuffer);
  } catch (error) {
    throw new DecryptionError('Decrypted data is not valid UTF-8', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }

  const decryptedArray = new Uint8Array(decryptedBuffer);
  for (let i = 0; i < decryptedArray.length; i++) {
    decryptedArray[i] = 0;
  }

  return decoded;
}

export async function verifyPassword(
  store: EncryptedStore,
  password: string,
): Promise<boolean> {
  try {
    await decrypt(store, password);
    return true;
  } catch (error) {
    if (error instanceof InvalidPasswordError) {
      return false;
    }
    throw error;
  }
}
