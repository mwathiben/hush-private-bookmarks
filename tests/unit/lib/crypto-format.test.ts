/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { CRYPTO_CONFIG, decrypt, encrypt } from '@/lib/crypto';
import type { EncryptedStore } from '@/lib/types';

const PLAINTEXT = 'format validation test data';
const PASSWORD = 'format-test-password';

/**
 * RFC 4648 canonical base64 regex: validates standard alphabet (A-Z, a-z, 0-9, +, /),
 * enforces length as multiple of 4, and allows 0-2 padding characters (=).
 * Empty string is valid base64 (zero bytes encoded).
 */
const RFC4648_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const GCM_TAG_BYTES = 16;

describe('EncryptedStore format validation', () => {
  let store: EncryptedStore;

  beforeAll(async () => {
    store = await encrypt(PLAINTEXT, PASSWORD);
  });

  it('contains exactly 4 fields: salt, encrypted, iv, iterations', () => {
    const keys = Object.keys(store).sort();
    expect(keys).toEqual(['encrypted', 'iterations', 'iv', 'salt']);
    expect(keys).toHaveLength(4);
  });

  it('salt is valid base64 decoding to exactly 16 bytes', () => {
    const decoded = Uint8Array.from(atob(store.salt), (c) => c.charCodeAt(0));
    expect(decoded).toHaveLength(16);
  });

  it('iv is valid base64 decoding to exactly 12 bytes', () => {
    const decoded = Uint8Array.from(atob(store.iv), (c) => c.charCodeAt(0));
    expect(decoded).toHaveLength(12);
  });

  it('encrypted field is valid base64 with GCM auth tag', () => {
    const decoded = Uint8Array.from(atob(store.encrypted), (c) =>
      c.charCodeAt(0),
    );
    const plaintextBytes = new TextEncoder().encode(PLAINTEXT).byteLength;
    expect(decoded.byteLength).toBe(plaintextBytes + GCM_TAG_BYTES);
  });

  it('iterations equals exactly CRYPTO_CONFIG.iterations (600000)', () => {
    expect(store.iterations).toBe(CRYPTO_CONFIG.iterations);
    expect(store.iterations).toBe(600_000);
  });

  it('survives JSON serialize/deserialize roundtrip with successful decrypt', async () => {
    const json = JSON.stringify(store);
    const parsed: EncryptedStore = JSON.parse(json) as EncryptedStore;

    expect(typeof parsed.salt).toBe('string');
    expect(typeof parsed.encrypted).toBe('string');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.iterations).toBe('number');

    const decrypted = await decrypt(parsed, PASSWORD);
    expect(decrypted).toBe(PLAINTEXT);
  });

  it('all base64 fields use standard alphabet per RFC 4648', () => {
    expect(store.salt.length).toBeGreaterThan(0);
    expect(store.iv.length).toBeGreaterThan(0);
    expect(store.encrypted.length).toBeGreaterThan(0);

    expect(store.salt).toMatch(RFC4648_BASE64);
    expect(store.iv).toMatch(RFC4648_BASE64);
    expect(store.encrypted).toMatch(RFC4648_BASE64);
  });

  it('empty plaintext produces encrypted field of exactly GCM tag size', async () => {
    const emptyStore = await encrypt('', PASSWORD);

    expect(Object.keys(emptyStore).sort()).toEqual([
      'encrypted',
      'iterations',
      'iv',
      'salt',
    ]);

    const decoded = Uint8Array.from(atob(emptyStore.encrypted), (c) =>
      c.charCodeAt(0),
    );
    expect(decoded.byteLength).toBe(GCM_TAG_BYTES);

    expect(emptyStore.salt).toMatch(RFC4648_BASE64);
    expect(emptyStore.iv).toMatch(RFC4648_BASE64);
    expect(emptyStore.encrypted).toMatch(RFC4648_BASE64);
  });
});
