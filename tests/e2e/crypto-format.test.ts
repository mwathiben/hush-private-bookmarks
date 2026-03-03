/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { test, expect } from './fixtures/extension';

// E2E format tests use 1000 PBKDF2 iterations (not production 600K).
// These tests verify browser Web Crypto API output format and JSON
// serialization behavior, not PBKDF2 key-stretching strength.
// Production uses CRYPTO_CONFIG.iterations (600,000).

/**
 * RFC 4648 canonical base64 regex: standard alphabet, length multiple of 4,
 * 0-2 padding characters.
 */
const RFC4648_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

test.describe('EncryptedStore format in browser context', () => {
  test('encrypt produces correctly formatted EncryptedStore', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const plaintext = 'browser format validation data';
      const password = 'format-e2e-password';
      const iterations = 1000;

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey'],
      );

      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext),
      );

      function uint8ToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
      }

      const store = {
        salt: uint8ToBase64(salt),
        iv: uint8ToBase64(iv),
        encrypted: uint8ToBase64(new Uint8Array(encrypted)),
        iterations,
      };

      const saltBytes = atob(store.salt).length;
      const ivBytes = atob(store.iv).length;
      const encBytes = atob(store.encrypted).length;
      const plaintextBytes = encoder.encode(plaintext).byteLength;

      return {
        fieldCount: Object.keys(store).length,
        fieldNames: Object.keys(store).sort(),
        saltBytes,
        ivBytes,
        encBytes,
        plaintextBytes,
        iterations: store.iterations,
        salt: store.salt,
        iv: store.iv,
        encrypted: store.encrypted,
      };
    });

    expect(result.fieldCount).toBe(4);
    expect(result.fieldNames).toEqual(['encrypted', 'iterations', 'iv', 'salt']);
    expect(result.saltBytes).toBe(16);
    expect(result.ivBytes).toBe(12);
    expect(result.encBytes).toBe(result.plaintextBytes + 16);
    expect(result.iterations).toBe(1000);
    expect(result.salt).toMatch(RFC4648_BASE64);
    expect(result.iv).toMatch(RFC4648_BASE64);
    expect(result.encrypted).toMatch(RFC4648_BASE64);

    await page.close();
  });

  test('EncryptedStore survives JSON roundtrip with successful decrypt', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const plaintext = 'JSON roundtrip e2e test';
      const password = 'roundtrip-e2e-password';
      const iterations = 1000;

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey'],
      );

      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext),
      );

      function uint8ToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
      }

      function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }

      const store = {
        salt: uint8ToBase64(salt),
        iv: uint8ToBase64(iv),
        encrypted: uint8ToBase64(new Uint8Array(encrypted)),
        iterations,
      };

      const json = JSON.stringify(store);
      const parsed = JSON.parse(json) as typeof store;

      const key2Material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey'],
      );

      const key2 = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: base64ToUint8(parsed.salt),
          iterations: parsed.iterations,
          hash: 'SHA-256',
        },
        key2Material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToUint8(parsed.iv) },
        key2,
        base64ToUint8(parsed.encrypted),
      );

      return {
        decrypted: new TextDecoder().decode(decrypted),
        typesPreserved:
          typeof parsed.salt === 'string' &&
          typeof parsed.iv === 'string' &&
          typeof parsed.encrypted === 'string' &&
          typeof parsed.iterations === 'number',
      };
    });

    expect(result.decrypted).toBe('JSON roundtrip e2e test');
    expect(result.typesPreserved).toBe(true);

    await page.close();
  });
});
