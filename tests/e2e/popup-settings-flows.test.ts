import { readFileSync } from 'node:fs';
import { expect } from './fixtures/extension';
import { makeSettingsTest } from './fixtures/settings-page';
import { SEED_PASSWORD } from './fixtures/seed-storage';

const test = makeSettingsTest();

test.describe('Settings E2E Flows (SETTINGS-004)', () => {
  test.setTimeout(180_000);

  test('theme persists across popup close and reopen', async ({
    settingsPage,
    context,
    extensionId,
  }) => {
    // #given — settings screen is open, theme is system default
    // #when — user clicks Dark theme
    await settingsPage.getByRole('button', { name: /dark/i }).click();

    // #then — dark class applied
    const hasDark = await settingsPage.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(hasDark).toBe(true);

    // #when — close popup and reopen (new page, same extension origin)
    await settingsPage.close();
    const newPage = await context.newPage();
    await newPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await newPage.waitForLoadState('domcontentloaded');

    // #then — dark class persists via main.tsx localStorage read before React mount
    const stillDark = await newPage.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(stillDark).toBe(true);
    await newPage.close();
  });

  test('create set and delete set lifecycle', async ({ settingsPage }) => {
    // #given — settings screen with Default set visible
    await expect(settingsPage.getByText('Default', { exact: true })).toBeVisible();

    // #when — open Create Set dialog
    await settingsPage.getByRole('button', { name: /create set/i }).click();
    await expect(settingsPage.getByText('Create New Set')).toBeVisible();

    // #when — fill name and password within dialog, click Create
    const dialog = settingsPage.getByRole('dialog');
    await dialog.getByPlaceholder('Set name').fill('Test Set');
    const pwInput = dialog.getByPlaceholder('Password');
    await pwInput.click();
    await pwInput.pressSequentially('setpass123', { delay: 30 });
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();

    // #then — CREATE_SET auto-switches to new set, app navigates to tree screen
    await expect(settingsPage.getByTestId('tree-screen')).toBeVisible({
      timeout: 90_000,
    });

    // #when — navigate back to settings to see the new set in the list
    await settingsPage.getByRole('button', { name: /settings/i }).click();
    await expect(settingsPage.getByTestId('settings-screen')).toBeVisible({
      timeout: 10_000,
    });

    // #then — new set appears in the set list
    await expect(settingsPage.getByText('Test Set', { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // #when — delete the new set
    await settingsPage.getByRole('button', { name: 'Delete Test Set' }).click();
    await expect(settingsPage.getByText('Are you sure you want to delete "Test Set"?')).toBeVisible();
    await settingsPage.getByRole('button', { name: 'Delete', exact: true }).click();

    // #then — set removed from list
    await expect(settingsPage.getByText('Test Set', { exact: true })).not.toBeVisible({
      timeout: 10_000,
    });

    // Deleting the active set may trigger navigation — if we're still on settings,
    // verify Default set is visible; if navigated to tree, go back to settings first
    const onSettings = await settingsPage.getByTestId('settings-screen').isVisible().catch(() => false);
    if (!onSettings) {
      await settingsPage.getByRole('button', { name: /settings/i }).click();
      await expect(settingsPage.getByTestId('settings-screen')).toBeVisible({
        timeout: 10_000,
      });
    }
    await expect(settingsPage.getByText('Default', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('export and import backup round-trip', async ({ settingsPage }) => {
    // #given — unlocked session with empty tree
    // #when — export backup
    const downloadPromise = settingsPage.waitForEvent('download', { timeout: 30_000 });
    await settingsPage.getByRole('button', { name: /export backup/i }).click();
    const download = await downloadPromise;

    // #then — file downloaded with expected name pattern
    expect(download.suggestedFilename()).toMatch(
      /^hush-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );

    // #when — read exported file content
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const backupContent = readFileSync(downloadPath!, 'utf-8');
    const parsed = JSON.parse(backupContent) as Record<string, unknown>;
    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('store');
    const store = parsed.store as Record<string, unknown>;
    expect(store).toHaveProperty('salt');
    expect(store).toHaveProperty('iv');
    expect(store).toHaveProperty('encrypted');

    // #when — restore from the exported backup file
    const backupInput = settingsPage.locator('input[type="file"][accept=".json"]');
    await backupInput.setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupContent),
    });

    // #then — password prompt appears
    await expect(settingsPage.getByPlaceholder('Backup password')).toBeVisible({
      timeout: 5_000,
    });

    // #when — enter password and import
    const backupPwInput = settingsPage.getByPlaceholder('Backup password');
    await backupPwInput.click();
    await backupPwInput.pressSequentially(SEED_PASSWORD, { delay: 30 });
    await settingsPage.getByRole('button', { name: /^import$/i }).click();

    // #then — password prompt disappears (import succeeded, backupPrompt cleared)
    await expect(settingsPage.getByPlaceholder('Backup password'))
      .not.toBeVisible({ timeout: 60_000 });
  });

  test('password change then re-login with new password', async ({
    settingsPage,
    context,
    extensionId,
  }) => {
    const NEW_PASSWORD = 'newpass456';

    // #given — settings screen, user authenticated with testpass123
    // #when — change password
    const currentInput = settingsPage.getByPlaceholder('Current password');
    await currentInput.click();
    await currentInput.pressSequentially(SEED_PASSWORD, { delay: 30 });

    const newInput = settingsPage.getByPlaceholder('New password', { exact: true });
    await newInput.click();
    await newInput.pressSequentially(NEW_PASSWORD, { delay: 30 });

    const confirmInput = settingsPage.getByPlaceholder('Confirm new password');
    await confirmInput.click();
    await confirmInput.pressSequentially(NEW_PASSWORD, { delay: 30 });

    await settingsPage.getByRole('button', { name: /change password/i }).click();

    // #then — success message visible (PBKDF2 2x: decrypt old + encrypt new)
    await expect(settingsPage.getByText('Password changed successfully')).toBeVisible({
      timeout: 120_000,
    });

    // #when — lock session via page context (SW can't self-message), then reopen
    await settingsPage.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'LOCK' });
    });

    await settingsPage.close();
    const loginPage = await context.newPage();
    await loginPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(loginPage.getByTestId('login-screen')).toBeVisible({
      timeout: 30_000,
    });

    // #when — try OLD password
    const loginInput = loginPage.getByPlaceholder('Password');
    await loginInput.click();
    await loginInput.pressSequentially(SEED_PASSWORD, { delay: 30 });
    await loginPage.getByRole('button', { name: /unlock/i }).click();

    // #then — old password fails
    await expect(loginPage.getByText(/invalid password/i)).toBeVisible({
      timeout: 60_000,
    });

    // #when — clear and try NEW password
    await loginInput.clear();
    await loginInput.pressSequentially(NEW_PASSWORD, { delay: 30 });
    await loginPage.getByRole('button', { name: /unlock/i }).click();

    // #then — new password succeeds, tree screen visible
    await expect(loginPage.getByTestId('tree-screen')).toBeVisible({
      timeout: 60_000,
    });

    await loginPage.close();
  });
});
