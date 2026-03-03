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

// E2E edge case tests use 1000 PBKDF2 iterations (not production 600K).
// These tests verify browser Web Crypto API behavior for edge case inputs,
// not PBKDF2 key-stretching strength. Production uses CRYPTO_CONFIG.iterations.
test.describe('Crypto edge cases in browser context', () => {
  test('AES-GCM roundtrip with empty plaintext in extension context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const password = 'test-password-e2e';
      const plaintext = '';

      const encoder = new TextEncoder();
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

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted,
      );

      return new TextDecoder().decode(decrypted);
    });

    expect(result).toBe('');

    await page.close();
  });

  test('AES-GCM roundtrip with Unicode characters in extension context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const password = 'test-password-e2e';
      const plaintext = '\u{1F512} \u79C1\u306E\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF \u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';

      const encoder = new TextEncoder();
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

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted,
      );

      return new TextDecoder().decode(decrypted);
    });

    expect(result).toBe('\u{1F512} \u79C1\u306E\u30D6\u30C3\u30AF\u30DE\u30FC\u30AF \u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}');

    await page.close();
  });

  test('AES-GCM roundtrip preserves null bytes in extension context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const password = 'test-password-e2e';
      const plaintext = 'hello\x00world\x00end';

      const encoder = new TextEncoder();
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

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted,
      );

      const decoded = new TextDecoder().decode(decrypted);
      return {
        text: decoded,
        length: decoded.length,
        hasNull: decoded.includes('\x00'),
      };
    });

    expect(result.text).toBe('hello\x00world\x00end');
    expect(result.length).toBe(15);
    expect(result.hasNull).toBe(true);

    await page.close();
  });

  test('browser PBKDF2 importKey accepts empty password (proves app-level validation is necessary)', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const emptyPassword = encoder.encode('');

      try {
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          emptyPassword,
          'PBKDF2',
          false,
          ['deriveKey'],
        );

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          encoder.encode('secret data'),
        );

        return {
          accepted: true,
          encryptedByteLength: encrypted.byteLength,
        };
      } catch {
        return { accepted: false, encryptedByteLength: 0 };
      }
    });

    expect(result.accepted).toBe(true);
    expect(result.encryptedByteLength).toBeGreaterThan(0);

    await page.close();
  });
});
