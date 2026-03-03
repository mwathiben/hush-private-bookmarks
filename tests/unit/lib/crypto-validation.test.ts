/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CRYPTO_CONFIG, decrypt, encrypt } from '@/lib/crypto';
import { DecryptionError } from '@/lib/errors';
import type { EncryptedStore } from '@/lib/types';

const PASSWORD = 'validation-test-password';
const PLAINTEXT = 'validation test data';

let validStore: EncryptedStore;

beforeAll(async () => {
  validStore = await encrypt(PLAINTEXT, PASSWORD);
}, 120_000);

afterEach(() => {
  vi.restoreAllMocks();
});

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

describe('EncryptedStore field validation', () => {
  it('rejects salt shorter than 16 bytes', async () => {
    const shortSalt = uint8ArrayToBase64(new Uint8Array(8));
    const store: EncryptedStore = { ...validStore, salt: shortSalt };

    await expect(decrypt(store, PASSWORD)).rejects.toThrow(DecryptionError);
    await expect(decrypt(store, PASSWORD)).rejects.toThrow(
      /Invalid salt length: expected 16 bytes, got 8/,
    );
  });

  it('rejects salt longer than 16 bytes', async () => {
    const longSalt = uint8ArrayToBase64(new Uint8Array(32));
    const store: EncryptedStore = { ...validStore, salt: longSalt };

    await expect(decrypt(store, PASSWORD)).rejects.toThrow(DecryptionError);
    await expect(decrypt(store, PASSWORD)).rejects.toThrow(
      /Invalid salt length: expected 16 bytes, got 32/,
    );
  });

  it('rejects IV shorter than 12 bytes', async () => {
    const shortIv = uint8ArrayToBase64(new Uint8Array(8));
    const store: EncryptedStore = { ...validStore, iv: shortIv };

    await expect(decrypt(store, PASSWORD)).rejects.toThrow(DecryptionError);
    await expect(decrypt(store, PASSWORD)).rejects.toThrow(
      /Invalid IV length: expected 12 bytes, got 8/,
    );
  });

  it('rejects IV longer than 12 bytes', async () => {
    const longIv = uint8ArrayToBase64(new Uint8Array(16));
    const store: EncryptedStore = { ...validStore, iv: longIv };

    await expect(decrypt(store, PASSWORD)).rejects.toThrow(DecryptionError);
    await expect(decrypt(store, PASSWORD)).rejects.toThrow(
      /Invalid IV length: expected 12 bytes, got 16/,
    );
  });

  it('rejects encrypted data shorter than GCM tag (16 bytes)', async () => {
    const tooShort = uint8ArrayToBase64(new Uint8Array(15));
    const store: EncryptedStore = { ...validStore, encrypted: tooShort };

    await expect(decrypt(store, PASSWORD)).rejects.toThrow(DecryptionError);
    await expect(decrypt(store, PASSWORD)).rejects.toThrow(
      /Invalid encrypted data length: expected at least 16 bytes, got 15/,
    );
  });
});

describe('EncryptedStore base64 validation', () => {
  it('rejects invalid base64 in salt field', async () => {
    const store: EncryptedStore = { ...validStore, salt: 'not-valid-base64!!!' };

    await expect(decrypt(store, PASSWORD)).rejects.toThrow(DecryptionError);
    await expect(decrypt(store, PASSWORD)).rejects.toThrow(
      /Invalid base64 in encrypted store/,
    );
  });

  it('rejects invalid base64 in iv field', async () => {
    const store: EncryptedStore = { ...validStore, iv: '%%%invalid%%%' };

    await expect(decrypt(store, PASSWORD)).rejects.toThrow(DecryptionError);
    await expect(decrypt(store, PASSWORD)).rejects.toThrow(
      /Invalid base64 in encrypted store/,
    );
  });
});

describe('EncryptedStore iterations validation', () => {
  it('rejects mismatched iteration count', async () => {
    const store: EncryptedStore = { ...validStore, iterations: 100_000 };

    await expect(decrypt(store, PASSWORD)).rejects.toThrow(DecryptionError);
    await expect(decrypt(store, PASSWORD)).rejects.toThrow(
      /Unsupported iteration count: 100000/,
    );
  });

  it('iterations validation error includes expected value in cause', async () => {
    const store: EncryptedStore = { ...validStore, iterations: 100_000 };

    const error = await decrypt(store, PASSWORD).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(DecryptionError);
    expect((error as DecryptionError).cause).toBeInstanceOf(Error);
    expect(((error as DecryptionError).cause as Error).message).toMatch(
      /Expected 600000, got 100000/,
    );
  });
});

describe('valid store still decrypts after validation changes', () => {
  it('roundtrip works with production CRYPTO_CONFIG', async () => {
    const result = await decrypt(validStore, PASSWORD);
    expect(result).toBe(PLAINTEXT);
  }, 120_000);

  it('store.iterations matches CRYPTO_CONFIG.iterations', () => {
    expect(validStore.iterations).toBe(CRYPTO_CONFIG.iterations);
  });
});
