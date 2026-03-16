import sjcl from 'sjcl';
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

const HUSH_DATA = JSON.stringify({
  folders: [{
    id: '1',
    title: 'Test Folder',
    bookmarks: [
      { url: 'https://example.com', text: 'Example', created: '2024-01-01T00:00:00Z' },
    ],
  }],
});
const HUSH_PASSWORD = 'hush-pw';
const VALID_BLOB = sjcl.encrypt(HUSH_PASSWORD, HUSH_DATA);

const test = extensionTest.extend<{ settingsPage: Page }>({
  settingsPage: async ({ context, extensionId }, use) => {
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
          sets: [{
            id: setId,
            name: 'Default',
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            isDefault: true,
          }],
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
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 30_000 });

    const input = page.getByPlaceholder('Password');
    await input.click();
    await input.pressSequentially(SEED_PASSWORD, { delay: 50 });
    await page.getByRole('button', { name: /unlock/i }).click();

    await expect(page.getByTestId('tree-screen')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByTestId('settings-screen')).toBeVisible({ timeout: 10_000 });

    await use(page);
    await page.close();
  },
});

test.describe('Hush Import UI (HUSH-003)', () => {
  test.setTimeout(120_000);

  test('"Import from Hush" section is visible in settings', async ({ settingsPage }) => {
    await expect(settingsPage.getByRole('heading', { name: 'Import from Hush' })).toBeVisible();
  });

  test('textarea and password input are rendered', async ({ settingsPage }) => {
    await expect(settingsPage.getByPlaceholder('Paste encrypted data from Hush extension...')).toBeVisible();
    await expect(settingsPage.getByPlaceholder('Hush Password')).toBeVisible();
  });

  test('import button disabled when fields empty', async ({ settingsPage }) => {
    await expect(settingsPage.getByRole('button', { name: /import from hush/i })).toBeDisabled();
  });

  test('import button enabled after filling both fields', async ({ settingsPage }) => {
    const textarea = settingsPage.getByPlaceholder('Paste encrypted data from Hush extension...');
    await textarea.click();
    await textarea.fill('some blob data');

    const pwInput = settingsPage.getByPlaceholder('Hush Password');
    await pwInput.click();
    await pwInput.pressSequentially('some-pw', { delay: 50 });

    await expect(settingsPage.getByRole('button', { name: /import from hush/i })).toBeEnabled();
  });

  test('wrong password shows error message', async ({ settingsPage }) => {
    // #given
    const textarea = settingsPage.getByPlaceholder('Paste encrypted data from Hush extension...');
    await textarea.click();
    await textarea.fill(VALID_BLOB);

    const pwInput = settingsPage.getByPlaceholder('Hush Password');
    await pwInput.click();
    await pwInput.pressSequentially('wrong-password', { delay: 50 });

    // #when
    await settingsPage.getByRole('button', { name: /import from hush/i }).click();

    // #then
    await expect(settingsPage.getByRole('alert')).toBeVisible({ timeout: 30_000 });
  });

  test('correct password shows success stats', async ({ settingsPage }) => {
    // #given
    const textarea = settingsPage.getByPlaceholder('Paste encrypted data from Hush extension...');
    await textarea.click();
    await textarea.fill(VALID_BLOB);

    const pwInput = settingsPage.getByPlaceholder('Hush Password');
    await pwInput.click();
    await pwInput.pressSequentially(HUSH_PASSWORD, { delay: 50 });

    // #when
    await settingsPage.getByRole('button', { name: /import from hush/i }).click();

    // #then
    await expect(settingsPage.getByRole('status')).toBeVisible({ timeout: 30_000 });
    await expect(settingsPage.getByRole('status')).toContainText('bookmark');
  });
});
