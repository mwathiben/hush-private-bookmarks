import sjcl from 'sjcl';
import { expect } from './fixtures/extension';
import { makeSettingsTest } from './fixtures/settings-page';

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

const test = makeSettingsTest();

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
    const alert = settingsPage.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30_000 });
    await expect(alert).toContainText('Invalid password');
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
