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

test.describe('Crypto quality gate in browser context', () => {
  test('full roundtrip with production PBKDF2 600K iterations', async ({
    context,
    extensionId,
  }) => {
    test.setTimeout(120_000);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const result = await page.evaluate(async () => {
        const plaintext = 'quality gate production config test';
        const password = 'quality-gate-password-600k';
        const iterations = 600_000;

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
          { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );

        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv, tagLength: 128 },
          key,
          encoder.encode(plaintext),
        );

        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv, tagLength: 128 },
          key,
          encrypted,
        );

        const decoder = new TextDecoder('utf-8', { fatal: true });
        const decryptedText = decoder.decode(decrypted);

        return {
          match: decryptedText === plaintext,
          decryptedText,
          ciphertextBytes: new Uint8Array(encrypted).byteLength,
          plaintextBytes: encoder.encode(plaintext).byteLength,
        };
      });

      expect(result.match).toBe(true);
      expect(result.decryptedText).toBe(
        'quality gate production config test',
      );
      expect(result.ciphertextBytes).toBe(result.plaintextBytes + 16);

      await page.close();
  });

  test('explicit tagLength: 128 produces 16-byte auth tag', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const testCases = [
        { plaintext: '', expectedCiphertextBytes: 16 },
        { plaintext: 'a', expectedCiphertextBytes: 17 },
        { plaintext: 'hello world', expectedCiphertextBytes: 27 },
      ];

      const password = 'taglength-test-password';
      const iterations = 1000;
      const encoder = new TextEncoder();

      const results: Array<{
        input: string;
        expected: number;
        actual: number;
        pass: boolean;
      }> = [];

      for (const tc of testCases) {
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
          { name: 'AES-GCM', iv, tagLength: 128 },
          key,
          encoder.encode(tc.plaintext),
        );

        const actual = new Uint8Array(encrypted).byteLength;
        results.push({
          input: tc.plaintext,
          expected: tc.expectedCiphertextBytes,
          actual,
          pass: actual === tc.expectedCiphertextBytes,
        });
      }

      return results;
    });

    for (const r of result) {
      expect(r.pass, `tagLength check for "${r.input}": expected ${r.expected}, got ${r.actual}`).toBe(true);
    }

    await page.close();
  });

  // This test validates that field length checks (matching lib/crypto.ts
  // validateAndParseStore logic) work correctly in a real browser context.
  // page.evaluate() cannot import extension modules — we replicate the
  // validation inline to verify base64 decoding + length checks in Chromium.
  test('field length validation rejects malformed EncryptedStore fields in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(() => {
      function uint8ToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
      }

      function base64ToUint8Array(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(0 + i);
        }
        return bytes;
      }

      const SALT_BYTES = 16;
      const IV_BYTES = 12;
      const GCM_TAG_BYTES = 16;

      const validSalt = uint8ToBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)));
      const validIv = uint8ToBase64(crypto.getRandomValues(new Uint8Array(IV_BYTES)));
      const validEncrypted = uint8ToBase64(crypto.getRandomValues(new Uint8Array(32)));

      const cases = [
        {
          name: 'short salt (8 bytes)',
          salt: uint8ToBase64(new Uint8Array(8)),
          iv: validIv,
          encrypted: validEncrypted,
          expectedError: 'Invalid salt length',
        },
        {
          name: 'short IV (8 bytes)',
          salt: validSalt,
          iv: uint8ToBase64(new Uint8Array(8)),
          encrypted: validEncrypted,
          expectedError: 'Invalid IV length',
        },
        {
          name: 'encrypted too short (10 bytes < 16-byte GCM tag)',
          salt: validSalt,
          iv: validIv,
          encrypted: uint8ToBase64(new Uint8Array(10)),
          expectedError: 'Invalid encrypted data length',
        },
      ];

      return cases.map((c) => {
        const saltBytes = base64ToUint8Array(c.salt);
        const ivBytes = base64ToUint8Array(c.iv);
        const encBytes = base64ToUint8Array(c.encrypted);

        const errors: string[] = [];

        if (saltBytes.byteLength !== SALT_BYTES) {
          errors.push(`Invalid salt length: expected ${SALT_BYTES} bytes, got ${saltBytes.byteLength}`);
        }
        if (ivBytes.byteLength !== IV_BYTES) {
          errors.push(`Invalid IV length: expected ${IV_BYTES} bytes, got ${ivBytes.byteLength}`);
        }
        if (encBytes.byteLength < GCM_TAG_BYTES) {
          errors.push(`Invalid encrypted data length: expected at least ${GCM_TAG_BYTES} bytes, got ${encBytes.byteLength}`);
        }

        return {
          name: c.name,
          rejected: errors.length > 0,
          errorMessage: errors[0] ?? '',
          matchesExpected: errors.length > 0 && (errors[0] ?? '').includes(c.expectedError),
        };
      });
    });

    for (const t of result) {
      expect(t.rejected, `"${t.name}" should be rejected`).toBe(true);
      expect(
        t.matchesExpected,
        `"${t.name}" error should match: got "${t.errorMessage}"`,
      ).toBe(true);
    }

    await page.close();
  });
});
