import { test, expect } from './fixtures/extension';

test.describe('Crypto error handling in browser context', () => {
  test('Web Crypto AES-GCM roundtrip works in extension context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const password = 'test-password-e2e';
      const plaintext = 'Hello from Playwright E2E';

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
        { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
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

    expect(result).toBe('Hello from Playwright E2E');

    await page.close();
  });

  test('wrong password produces OperationError in extension context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const errorName = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode('correct-password'),
        'PBKDF2',
        false,
        ['deriveKey'],
      );

      const encryptKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encryptKey,
        encoder.encode('secret data'),
      );

      const wrongKeyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode('wrong-password'),
        'PBKDF2',
        false,
        ['deriveKey'],
      );

      const wrongKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
        wrongKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      try {
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          wrongKey,
          encrypted,
        );
        return 'no-error';
      } catch (error) {
        return (error as Error).name;
      }
    });

    expect(errorName).toBe('OperationError');

    await page.close();
  });

  test('AES-GCM rejects corrupted ciphertext in extension context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const errorName = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode('password'),
        'PBKDF2',
        false,
        ['deriveKey'],
      );

      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode('test data'),
      );

      const corruptedBytes = new Uint8Array(encrypted);
      corruptedBytes[0] = corruptedBytes[0]! ^ 0xff;

      try {
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          corruptedBytes,
        );
        return 'no-error';
      } catch (error) {
        return (error as Error).name;
      }
    });

    expect(errorName).toBe('OperationError');

    await page.close();
  });
});
