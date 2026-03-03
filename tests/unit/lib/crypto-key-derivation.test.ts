/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest';
import {
  encrypt,
  decrypt,
  deriveKey,
  generateSalt,
  CRYPTO_CONFIG,
} from '@/lib/crypto';
import { InvalidPasswordError } from '@/lib/errors';

describe('key derivation isolation and salt uniqueness', () => {
  it(
    'different passwords produce different ciphertext and cross-decryption fails',
    async () => {
      const [storeA, storeB] = await Promise.all([
        encrypt('same plaintext', 'password-alpha'),
        encrypt('same plaintext', 'password-beta'),
      ]);

      expect(storeA.encrypted).not.toBe(storeB.encrypted);

      await expect(decrypt(storeA, 'password-beta')).rejects.toBeInstanceOf(
        InvalidPasswordError,
      );
      await expect(decrypt(storeB, 'password-alpha')).rejects.toBeInstanceOf(
        InvalidPasswordError,
      );
    },
    120_000,
  );

  it('same password with different salt produces different ciphertext', async () => {
    const storeA = await encrypt('same plaintext', 'same-password');
    const storeB = await encrypt('same plaintext', 'same-password');

    expect(storeA.salt).not.toBe(storeB.salt);
    expect(storeA.encrypted).not.toBe(storeB.encrypted);
  });

  it(
    '50 encryptions produce 50 unique salts',
    async () => {
      const salts = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const store = await encrypt('test', 'password');
        salts.add(store.salt);
      }

      expect(salts.size).toBe(50);
    },
    120_000,
  );

  it('generateSalt returns exactly 16 bytes', () => {
    const salt = generateSalt();

    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.byteLength).toBe(16);

    const allZeros = salt.every((byte) => byte === 0);
    expect(allZeros).toBe(false);
  });

  it(
    'independent deriveKey calls with same inputs produce compatible keys',
    async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('password', salt);
      const key2 = await deriveKey('password', salt);

      const iv = crypto.getRandomValues(
        new Uint8Array(CRYPTO_CONFIG.ivLength),
      );
      const encoder = new TextEncoder();
      const plainBytes = encoder.encode('test data');

      const encrypted = await crypto.subtle.encrypt(
        { name: CRYPTO_CONFIG.algorithm, iv },
        key1,
        plainBytes,
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: CRYPTO_CONFIG.algorithm, iv },
        key2,
        encrypted,
      );

      const decoder = new TextDecoder();
      expect(decoder.decode(decrypted)).toBe('test data');
    },
    120_000,
  );

  it('deriveKey produces non-extractable keys', async () => {
    const key = await deriveKey('password', generateSalt());

    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });
});
