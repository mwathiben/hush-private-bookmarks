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

// E2E stateless tests use 1000 PBKDF2 iterations (not production 600K).
// These tests verify browser Web Crypto API statelessness and call
// independence in a real Chromium extension context, not PBKDF2
// key-stretching strength. Production uses CRYPTO_CONFIG.iterations (600,000).
test.describe('Stateless call independence in browser context', () => {
  test('sequential encrypt/decrypt with different passwords are independent', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const iterations = 1000;

      async function encryptData(
        plaintext: string,
        password: string,
      ): Promise<{
        salt: string;
        iv: string;
        encrypted: string;
      }> {
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
        const toHex = (arr: Uint8Array): string =>
          Array.from(arr)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        return {
          salt: toHex(salt),
          iv: toHex(iv),
          encrypted: toHex(new Uint8Array(encrypted)),
        };
      }

      async function decryptData(
        store: { salt: string; iv: string; encrypted: string },
        password: string,
      ): Promise<string> {
        const fromHex = (hex: string): Uint8Array<ArrayBuffer> => {
          const arr = hex.match(/.{2}/g)!.map((b) => parseInt(b, 16));
          return new Uint8Array(arr);
        };
        const salt = fromHex(store.salt);
        const iv = fromHex(store.iv);
        const encrypted = fromHex(store.encrypted);
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
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          encrypted,
        );
        return decoder.decode(decrypted);
      }

      const storeA = await encryptData('data-alpha', 'password-alpha');
      const storeB = await encryptData('data-beta', 'password-beta');
      const resultA = await decryptData(storeA, 'password-alpha');
      const resultB = await decryptData(storeB, 'password-beta');

      return { resultA, resultB };
    });

    expect(result.resultA).toBe('data-alpha');
    expect(result.resultB).toBe('data-beta');

    await page.close();
  });

  test('concurrent encrypt/decrypt calls produce correct results', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const iterations = 1000;

      async function roundtrip(
        plaintext: string,
        password: string,
      ): Promise<string> {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveKey'],
        );
        const encKey = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          encKey,
          encoder.encode(plaintext),
        );

        const decKeyMaterial = await crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          'PBKDF2',
          false,
          ['deriveKey'],
        );
        const decKey = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
          decKeyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          decKey,
          encrypted,
        );
        return decoder.decode(decrypted);
      }

      const pairs = Array.from({ length: 5 }, (_, i) => ({
        plaintext: `concurrent-${i}`,
        password: `pwd-${i}`,
      }));

      const results = await Promise.all(
        pairs.map((p) => roundtrip(p.plaintext, p.password)),
      );

      return {
        allCorrect: results.every((r, i) => r === pairs[i]!.plaintext),
        results,
        expected: pairs.map((p) => p.plaintext),
      };
    });

    expect(result.allCorrect).toBe(true);
    for (let i = 0; i < result.results.length; i++) {
      expect(result.results[i]).toBe(result.expected[i]);
    }

    await page.close();
  });
});
