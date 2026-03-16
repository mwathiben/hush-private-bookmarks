import { expect } from './fixtures/extension';
import { makeSettingsTest } from './fixtures/settings-page';

const test = makeSettingsTest();

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
    const downloadPromise = settingsPage.waitForEvent('download', { timeout: 30_000 });
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
