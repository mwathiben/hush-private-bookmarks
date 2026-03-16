import sjcl from 'sjcl';
import { expect } from './fixtures/extension';
import { makeSettingsTest } from './fixtures/settings-page';

const HUSH_DATA = JSON.stringify({
  folders: [
    {
      id: '1',
      title: 'Test Folder',
      bookmarks: [
        { url: 'https://example.com', text: 'Example', created: '2024-01-01T00:00:00Z' },
        { url: 'https://github.com', text: 'GitHub', created: '2024-06-15T12:00:00Z' },
      ],
    },
    {
      id: '2',
      title: 'Trash',
      bookmarks: [
        { url: 'https://deleted.com', text: 'Deleted', created: '2024-01-01T00:00:00Z' },
      ],
    },
  ],
});
const HUSH_PASSWORD = 'hush-integration-pw';
const VALID_BLOB = sjcl.encrypt(HUSH_PASSWORD, HUSH_DATA);

const test = makeSettingsTest();

test.describe('Hush Import E2E Integration (HUSH-004)', () => {
  test.setTimeout(120_000);

  test('valid import creates bookmarks visible in tree after navigation', async ({ settingsPage }) => {
    // #given — disable animations for reliable accordion expansion
    await settingsPage.emulateMedia({ reducedMotion: 'reduce' });

    // #when — fill form and import
    const textarea = settingsPage.getByPlaceholder('Paste encrypted data from Hush extension...');
    await textarea.click();
    await textarea.fill(VALID_BLOB);

    const pwInput = settingsPage.getByPlaceholder('Hush Password');
    await pwInput.click();
    await pwInput.pressSequentially(HUSH_PASSWORD, { delay: 50 });

    await settingsPage.getByRole('button', { name: /import from hush/i }).click();

    // #then — success stats appear
    await expect(settingsPage.getByRole('status')).toBeVisible({ timeout: 30_000 });
    await expect(settingsPage.getByRole('status')).toContainText('bookmark');

    // #when — navigate back to tree screen
    await settingsPage.getByLabel('Back').click();
    await expect(settingsPage.getByTestId('settings-screen')).toBeHidden();
    await expect(settingsPage.getByTestId('tree-screen')).toBeVisible({ timeout: 10_000 });

    // #then — "Hush Import" folder is visible in tree
    const hushImportTrigger = settingsPage.getByRole('button', { name: /Hush Import/i });
    await expect(hushImportTrigger).toBeVisible({ timeout: 5_000 });

    // #when — expand "Hush Import" accordion
    await hushImportTrigger.click();

    // #then — "Test Folder" subfolder is visible (Trash folder was filtered out)
    const testFolderTrigger = settingsPage.getByRole('button', { name: /Test Folder/i });
    await expect(testFolderTrigger).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.getByRole('button', { name: /Trash/i })).toBeHidden();

    // #when — expand "Test Folder" accordion
    await testFolderTrigger.click();

    // #then — imported bookmarks are visible (excluding Trash bookmark)
    await expect(settingsPage.getByRole('button', { name: 'Example' })).toBeVisible({ timeout: 5_000 });
    await expect(settingsPage.getByRole('button', { name: 'GitHub' })).toBeVisible();
    await expect(settingsPage.getByRole('button', { name: 'Deleted' })).toBeHidden();
  });

  test('malformed blob shows user-friendly error without crypto internals', async ({ settingsPage }) => {
    // #given — fill form with garbage data
    const textarea = settingsPage.getByPlaceholder('Paste encrypted data from Hush extension...');
    await textarea.click();
    await textarea.fill('not-a-valid-sjcl-blob');

    const pwInput = settingsPage.getByPlaceholder('Hush Password');
    await pwInput.click();
    await pwInput.pressSequentially('any-password', { delay: 50 });

    // #when — attempt import
    await settingsPage.getByRole('button', { name: /import from hush/i }).click();

    // #then — error is visible and user-friendly
    const alert = settingsPage.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toContainText(/decrypt|import|Hush/i);

    // #then — error does NOT leak crypto internals
    await expect(alert).not.toContainText('CORRUPT');
    await expect(alert).not.toContainText('sjcl');
    await expect(alert).not.toContainText('INVALID');
    await expect(alert).not.toContainText('stack');
  });
});
