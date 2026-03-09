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

// Recovery E2E tests verify the security-critical crypto path in real Chromium V8.
// @scure/bip39 is NOT available inside page.evaluate() (separate browser context),
// so we test the Web Crypto PBKDF2 roundtrip directly — the same path used by
// deriveRecoveryPassword → encrypt → decrypt in production.
test.describe('Recovery crypto roundtrip in browser context', () => {
  test('PBKDF2-derived key encrypts and decrypts correctly', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const iterations = 1000;

      const passphrase = 'test-recovery-passphrase-simulating-mnemonic-seed';
      const plaintext = '{"bookmarks": [{"title": "test", "url": "https://example.com"}]}';

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
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

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext),
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext,
      );

      return {
        original: plaintext,
        recovered: decoder.decode(decrypted),
        ciphertextLength: ciphertext.byteLength,
      };
    });

    expect(result.recovered).toBe(result.original);
    expect(result.ciphertextLength).toBeGreaterThan(0);
  });

  test('key derivation is deterministic in real V8', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const iterations = 1000;
      const passphrase = 'determinism-test-phrase';
      const salt = new Uint8Array(16);

      async function deriveRawKey(pass: string): Promise<string> {
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(pass),
          'PBKDF2',
          false,
          ['deriveBits'],
        );

        const bits = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
          keyMaterial,
          256,
        );

        return Array.from(new Uint8Array(bits), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join('');
      }

      const key1 = await deriveRawKey(passphrase);
      const key2 = await deriveRawKey(passphrase);

      return { key1, key2, length: key1.length };
    });

    expect(result.key1).toBe(result.key2);
    expect(result.length).toBe(64);
  });

  test('wrong key fails decryption with OperationError', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const iterations = 1000;
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      async function deriveKey(pass: string): Promise<CryptoKey> {
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(pass),
          'PBKDF2',
          false,
          ['deriveKey'],
        );
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );
      }

      const correctKey = await deriveKey('correct-password');
      const wrongKey = await deriveKey('wrong-password');

      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        correctKey,
        encoder.encode('secret data'),
      );

      try {
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          wrongKey,
          ciphertext,
        );
        return { decryptedWithWrongKey: true };
      } catch (error) {
        return {
          decryptedWithWrongKey: false,
          errorName: error instanceof Error ? error.name : 'unknown',
        };
      }
    });

    expect(result.decryptedWithWrongKey).toBe(false);
    expect(result.errorName).toBe('OperationError');
  });
});
