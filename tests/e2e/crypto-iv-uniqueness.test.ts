import { test, expect } from './fixtures/extension';

test.describe('IV uniqueness in browser extension context', () => {
  test('crypto.getRandomValues produces unique 12-byte IVs', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(() => {
      const ivs: string[] = [];
      for (let i = 0; i < 10; i++) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const hex = Array.from(iv)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        ivs.push(hex);
      }
      return {
        ivs,
        allUnique: new Set(ivs).size === ivs.length,
        allCorrectLength: ivs.every((h) => h.length === 24),
      };
    });

    expect(result.allUnique).toBe(true);
    expect(result.allCorrectLength).toBe(true);
    expect(result.ivs).toHaveLength(10);

    await page.close();
  });

  test('two AES-GCM encryptions produce different IVs and ciphertext', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const result = await page.evaluate(async () => {
      const encoder = new TextEncoder();
      const plaintext = 'identical test data';
      const password = 'test-password';

      async function encryptOnce(): Promise<{ iv: string; ct: string }> {
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

        const toHex = (arr: Uint8Array): string =>
          Array.from(arr)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        return { iv: toHex(iv), ct: toHex(new Uint8Array(encrypted)) };
      }

      const a = await encryptOnce();
      const b = await encryptOnce();
      return { a, b };
    });

    expect(result.a.iv).not.toBe(result.b.iv);
    expect(result.a.ct).not.toBe(result.b.ct);

    await page.close();
  });
});
