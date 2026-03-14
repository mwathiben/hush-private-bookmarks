import { test as extensionTest, expect } from './fixtures/extension';
import type { Page } from '@playwright/test';

const SEED_PASSWORD = 'testpass123';
const EMPTY_TREE = JSON.stringify({
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [],
  dateAdded: 0,
});

const test = extensionTest.extend<{ loginPage: Page }>({
  loginPage: async ({ context, extensionId }, use) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker');

    await sw.evaluate(
      async ([password, plaintext]: readonly [string, string]) => {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const encoder = new TextEncoder();
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
          ['encrypt'],
        );
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv, tagLength: 128 },
          key,
          encoder.encode(plaintext),
        );

        function toBase64(bytes: Uint8Array): string {
          let binary = '';
          for (let i = 0; i < bytes.length; i++)
            binary += String.fromCharCode(bytes[i]!);
          return btoa(binary);
        }

        const store = {
          salt: toBase64(salt),
          iv: toBase64(iv),
          encrypted: toBase64(new Uint8Array(encrypted)),
          iterations: 600_000,
        };

        const setId = 'default';
        const manifest = {
          version: 1,
          activeSetId: setId,
          sets: [
            {
              id: setId,
              name: 'Default',
              createdAt: Date.now(),
              lastAccessedAt: Date.now(),
              isDefault: true,
            },
          ],
        };

        await chrome.storage.local.set({
          hush_manifest: manifest,
          holyPrivateData: store,
        });
      },
      [SEED_PASSWORD, EMPTY_TREE] as const,
    );

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByTestId('login-screen')).toBeVisible({
      timeout: 30_000,
    });

    await use(page);
    await page.close();
  },
});

test.describe('LoginScreen E2E (AUTH-002)', () => {
  test.setTimeout(120_000);

  test('shows login screen with password input and unlock button', async ({
    loginPage,
  }) => {
    await expect(loginPage.getByPlaceholder('Password')).toBeVisible();
    await expect(
      loginPage.getByRole('button', { name: /unlock/i }),
    ).toBeVisible();
  });

  test('unlock button is disabled when password is empty', async ({
    loginPage,
  }) => {
    await expect(
      loginPage.getByRole('button', { name: /unlock/i }),
    ).toBeDisabled();
  });

  test('shows error on wrong password', async ({ loginPage }) => {
    const input = loginPage.getByPlaceholder('Password');
    await input.click();
    await input.pressSequentially('wrongpassword', { delay: 50 });
    const btn = loginPage.getByRole('button', { name: /unlock/i });
    await expect(btn).toBeEnabled();
    await btn.click();

    await expect(loginPage.getByText('Invalid password')).toBeVisible({
      timeout: 60_000,
    });
  });

  test('unlocks with correct password and transitions to tree screen', async ({
    loginPage,
  }) => {
    const input = loginPage.getByPlaceholder('Password');
    await input.click();
    await input.pressSequentially(SEED_PASSWORD, { delay: 50 });
    const btn = loginPage.getByRole('button', { name: /unlock/i });
    await expect(btn).toBeEnabled();
    await btn.click();

    await expect(loginPage.getByTestId('tree-screen')).toBeVisible({
      timeout: 60_000,
    });
  });

  test('toggles password visibility', async ({ loginPage }) => {
    const input = loginPage.getByPlaceholder('Password');
    await expect(input).toHaveAttribute('type', 'password');

    await loginPage
      .getByRole('button', { name: /toggle password/i })
      .click();
    await expect(input).toHaveAttribute('type', 'text');

    await loginPage
      .getByRole('button', { name: /toggle password/i })
      .click();
    await expect(input).toHaveAttribute('type', 'password');
  });
});
