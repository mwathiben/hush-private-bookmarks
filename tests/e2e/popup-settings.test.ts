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

    const input = page.getByPlaceholder('Password');
    await input.click();
    await input.pressSequentially(SEED_PASSWORD, { delay: 50 });
    await page.getByRole('button', { name: /unlock/i }).click();

    await expect(page.getByTestId('tree-screen')).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByTestId('settings-screen')).toBeVisible({
      timeout: 10_000,
    });

    await use(page);
    await page.close();
  },
});

test.describe('SettingsScreen E2E (SETTINGS-002)', () => {
  test.setTimeout(120_000);

  test('settings screen shows Import / Export section', async ({ settingsPage }) => {
    await expect(settingsPage.getByText('Import / Export')).toBeVisible();
    await expect(settingsPage.getByText('Import', { exact: true })).toBeVisible();
    await expect(settingsPage.getByText('Export', { exact: true })).toBeVisible();
  });

  test('export backup button is visible and enabled when unlocked', async ({
    settingsPage,
  }) => {
    const exportBtn = settingsPage.getByRole('button', { name: /export backup/i });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
  });

  test('import chrome bookmarks button is visible', async ({ settingsPage }) => {
    await expect(
      settingsPage.getByRole('button', { name: /import chrome bookmarks/i }),
    ).toBeVisible();
  });

  test('import HTML file button is visible', async ({ settingsPage }) => {
    await expect(
      settingsPage.getByRole('button', { name: /import html file/i }),
    ).toBeVisible();
  });

  test('restore backup button is visible', async ({ settingsPage }) => {
    await expect(
      settingsPage.getByRole('button', { name: /restore backup/i }),
    ).toBeVisible();
  });

  test('export backup triggers download', async ({ settingsPage }) => {
    const downloadPromise = settingsPage.waitForEvent('download');
    await settingsPage.getByRole('button', { name: /export backup/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^hush-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  test('restore backup shows password prompt after file select', async ({
    settingsPage,
  }) => {
    const backupInput = settingsPage.locator('input[type="file"][accept=".json"]');
    const backupContent = JSON.stringify({ version: 1, store: {} });
    await backupInput.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupContent),
    });

    await expect(settingsPage.getByPlaceholder('Backup password')).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      settingsPage.getByRole('button', { name: /^import$/i }),
    ).toBeVisible();
  });
});

test.describe('SettingsScreen E2E (SETTINGS-001b)', () => {
  test.setTimeout(120_000);

  test('settings screen is reachable from tree', async ({ settingsPage }) => {
    await expect(settingsPage.getByText('Account')).toBeVisible();
    await expect(settingsPage.getByRole('heading', { name: 'Change Password' })).toBeVisible();
    await expect(settingsPage.getByRole('heading', { name: 'Verify Recovery Phrase' })).toBeVisible();
  });

  test('back button returns to tree', async ({ settingsPage }) => {
    await settingsPage.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(settingsPage.getByTestId('tree-screen')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('password change with mismatched passwords shows client error', async ({
    settingsPage,
  }) => {
    const currentInput = settingsPage.getByPlaceholder('Current password');
    await currentInput.click();
    await currentInput.pressSequentially('anything', { delay: 30 });

    const newInput = settingsPage.getByPlaceholder('New password', { exact: true });
    await newInput.click();
    await newInput.pressSequentially('pass1', { delay: 30 });

    const confirmInput = settingsPage.getByPlaceholder('Confirm new password');
    await confirmInput.click();
    await confirmInput.pressSequentially('pass2', { delay: 30 });

    await settingsPage.getByRole('button', { name: /change password/i }).click();
    await expect(settingsPage.getByText('Passwords do not match')).toBeVisible();
  });

  test('password change with wrong current password shows error', async ({
    settingsPage,
  }) => {
    const currentInput = settingsPage.getByPlaceholder('Current password');
    await currentInput.click();
    await currentInput.pressSequentially('wrongpassword', { delay: 30 });

    const newInput = settingsPage.getByPlaceholder('New password', { exact: true });
    await newInput.click();
    await newInput.pressSequentially('newpass123', { delay: 30 });

    const confirmInput = settingsPage.getByPlaceholder('Confirm new password');
    await confirmInput.click();
    await confirmInput.pressSequentially('newpass123', { delay: 30 });

    await settingsPage.getByRole('button', { name: /change password/i }).click();

    await expect(settingsPage.getByText(/invalid password/i)).toBeVisible({
      timeout: 60_000,
    });
  });

  test('recovery phrase verify shows invalid for wrong phrase', async ({
    settingsPage,
  }) => {
    const textarea = settingsPage.getByPlaceholder('Enter your 12-word recovery phrase');
    await textarea.click();
    await textarea.fill('this is not a valid recovery phrase at all');

    await settingsPage.getByRole('button', { name: /verify/i }).click();
    await expect(settingsPage.getByText('Invalid recovery phrase')).toBeVisible();
  });
});

test.describe('SettingsScreen E2E (SETTINGS-003)', () => {
  test.setTimeout(120_000);

  test('settings screen shows new sections', async ({ settingsPage }) => {
    await expect(settingsPage.getByText('Data Management')).toBeVisible();
    await expect(settingsPage.getByText('Preferences')).toBeVisible();
    await expect(settingsPage.getByText('Danger Zone')).toBeVisible();
  });

  test('theme toggle shows three theme buttons', async ({ settingsPage }) => {
    await expect(settingsPage.getByRole('button', { name: /light/i })).toBeVisible();
    await expect(settingsPage.getByRole('button', { name: /dark/i })).toBeVisible();
    await expect(settingsPage.getByRole('button', { name: /system/i })).toBeVisible();
  });

  test('clicking dark theme adds dark class', async ({ settingsPage }) => {
    await settingsPage.getByRole('button', { name: /dark/i }).click();
    const hasDark = await settingsPage.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(hasDark).toBe(true);
  });

  test('auto-lock config accepts valid minutes', async ({ settingsPage }) => {
    const input = settingsPage.getByRole('spinbutton');
    await input.clear();
    await input.fill('5');
    await settingsPage.getByRole('button', { name: /update auto-lock/i }).click();
    await expect(settingsPage.getByText(/auto-lock updated/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('set management section shows default set', async ({ settingsPage }) => {
    await expect(settingsPage.getByText('Default', { exact: true })).toBeVisible();
  });

  test('clear data requires typing DELETE', async ({ settingsPage }) => {
    await settingsPage.getByRole('button', { name: /delete all data/i }).click();
    const confirmBtn = settingsPage.getByRole('button', { name: /confirm delete/i });
    await expect(confirmBtn).toBeDisabled();
    await settingsPage.getByPlaceholder(/type delete/i).fill('DELETE');
    await expect(confirmBtn).toBeEnabled();
  });
});
