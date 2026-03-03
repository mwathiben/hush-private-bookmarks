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

// E2E key derivation tests use 1000 PBKDF2 iterations (not production 600K).
// These tests verify browser Web Crypto API behavior for key derivation and
// salt properties, not PBKDF2 key-stretching strength. Production uses
// CRYPTO_CONFIG.iterations (600,000).
test.describe('Key derivation isolation in browser context', () => {
  test('crypto.getRandomValues produces unique 16-byte salts', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(() => {
      const salts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hex = Array.from(salt)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        salts.push(hex);
      }
      return {
        salts,
        allUnique: new Set(salts).size === salts.length,
        allCorrectLength: salts.every((h) => h.length === 32),
      };
    });

    expect(result.allUnique).toBe(true);
    expect(result.allCorrectLength).toBe(true);
    expect(result.salts).toHaveLength(10);

    await page.close();
  });

  test('different passwords produce different ciphertext with same salt and IV', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Shared salt + IV isolates the password variable. IV reuse is safe here
    // because different PBKDF2-derived keys produce independent keystreams.
    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const plaintext = 'identical test data';
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      async function deriveAndEncrypt(password: string): Promise<string> {
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveKey'],
        );

        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' },
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

        return Array.from(new Uint8Array(encrypted))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }

      const ctAlpha = await deriveAndEncrypt('password-alpha');
      const ctBeta = await deriveAndEncrypt('password-beta');
      return { ctAlpha, ctBeta };
    });

    expect(result.ctAlpha).not.toBe(result.ctBeta);

    await page.close();
  });

  test('same password with different salts produces different ciphertext', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const plaintext = 'identical test data';
      const password = 'same-password';
      const iv = crypto.getRandomValues(new Uint8Array(12));

      async function deriveAndEncrypt(
        salt: Uint8Array<ArrayBuffer>,
      ): Promise<string> {
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveKey'],
        );

        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' },
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

        return Array.from(new Uint8Array(encrypted))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }

      const salt1 = crypto.getRandomValues(new Uint8Array(16));
      const salt2 = crypto.getRandomValues(new Uint8Array(16));
      const hex1 = Array.from(salt1)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const hex2 = Array.from(salt2)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const ct1 = await deriveAndEncrypt(salt1);
      const ct2 = await deriveAndEncrypt(salt2);
      return { hex1, hex2, ct1, ct2 };
    });

    expect(result.hex1).not.toBe(result.hex2);
    expect(result.ct1).not.toBe(result.ct2);

    await page.close();
  });

  test('key derivation is deterministic: encrypt with key1, decrypt with key2', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const password = 'test-password';
      const plaintext = 'determinism test data';
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      async function derive(): Promise<CryptoKey> {
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveKey'],
        );

        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );
      }

      const key1 = await derive();
      const key2 = await derive();

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        encoder.encode(plaintext),
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key2,
        encrypted,
      );

      return new TextDecoder().decode(decrypted);
    });

    expect(result).toBe('determinism test data');

    await page.close();
  });

  test('non-extractable key: exportKey rejects with InvalidAccessError', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode('test-password'),
        'PBKDF2',
        false,
        ['deriveKey'],
      );

      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      try {
        await crypto.subtle.exportKey('raw', key);
        return { rejected: false, errorName: '' };
      } catch (error) {
        return {
          rejected: true,
          errorName: (error as DOMException).name,
        };
      }
    });

    expect(result.rejected).toBe(true);
    expect(result.errorName).toBe('InvalidAccessError');

    await page.close();
  });
});
