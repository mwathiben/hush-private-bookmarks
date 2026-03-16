import { test as extensionTest, expect } from './fixtures/extension';
import type { Page } from '@playwright/test';

const SEED_PASSWORD = 'testpass123';

const POPULATED_TREE = JSON.stringify({
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [
    {
      type: 'bookmark',
      id: 'b1',
      title: 'GitHub',
      url: 'https://github.com',
      dateAdded: 0,
    },
    {
      type: 'folder',
      id: 'f1',
      name: 'Work',
      children: [
        {
          type: 'bookmark',
          id: 'b2',
          title: 'Jira',
          url: 'https://jira.example.com',
          dateAdded: 0,
        },
      ],
      dateAdded: 0,
    },
  ],
  dateAdded: 0,
});

function seedStorage(): (
  args: readonly [string, string],
) => Promise<void> {
  return async ([password, tree]: readonly [string, string]) => {
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
      encoder.encode(tree),
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
  };
}

async function unlockManager(page: Page, password: string): Promise<void> {
  await expect(page.getByTestId('login-screen')).toBeVisible({
    timeout: 30_000,
  });
  const input = page.getByPlaceholder('Password');
  await input.click();
  await input.pressSequentially(password, { delay: 50 });
  await page.getByRole('button', { name: /unlock/i }).click();
  await expect(page.getByTestId('manager-sidebar')).toBeVisible({
    timeout: 60_000,
  });
}

function makeManagerTest(treeData: string) {
  return extensionTest.extend<{ managerPage: Page }>({
    managerPage: async ({ context, extensionId }, use) => {
      let sw = context.serviceWorkers()[0];
      if (!sw) sw = await context.waitForEvent('serviceworker');

      await sw.evaluate(
        seedStorage(),
        [SEED_PASSWORD, treeData] as const,
      );

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/manager.html`);
      await unlockManager(page, SEED_PASSWORD);
      await use(page);
      await page.close();
    },
  });
}

const managerTest = makeManagerTest(POPULATED_TREE);

extensionTest.describe('Manager auth routing (MANAGER-001)', () => {
  extensionTest.setTimeout(120_000);

  extensionTest('first-time user sees setup screen', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/manager.html`);
    await expect(page.getByTestId('setup-screen')).toBeVisible({ timeout: 10_000 });
    await page.close();
  });

  extensionTest('existing user sees login screen', async ({
    context,
    extensionId,
  }) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker');

    await sw.evaluate(
      seedStorage(),
      [SEED_PASSWORD, POPULATED_TREE] as const,
    );

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/manager.html`);
    await expect(page.getByTestId('login-screen')).toBeVisible({ timeout: 30_000 });
    await page.close();
  });
});

managerTest.describe('Manager layout (MANAGER-001)', () => {
  managerTest.setTimeout(120_000);

  managerTest('shows sidebar and main panel after unlock', async ({ managerPage }) => {
    await expect(managerPage.getByTestId('manager-sidebar')).toBeVisible();
    await expect(managerPage.getByTestId('manager-main')).toBeVisible();
  });

  managerTest('shows bookmark titles in main panel', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    await expect(main.getByText('GitHub', { exact: true })).toBeVisible();
  });

  managerTest('sidebar folder click filters main panel', async ({ managerPage }) => {
    const sidebar = managerPage.getByTestId('manager-sidebar');
    await sidebar.getByText('Work', { exact: true }).click();

    const main = managerPage.getByTestId('manager-main');
    await expect(main.getByText('Jira', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  managerTest('lock button returns to login screen', async ({ managerPage }) => {
    await managerPage.getByLabel('Lock').click();
    await expect(managerPage.getByTestId('login-screen')).toBeVisible({ timeout: 10_000 });
  });
});

managerTest.describe('Manager search (MANAGER-002)', () => {
  managerTest.setTimeout(120_000);

  managerTest('search input is visible in toolbar', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    await expect(main.getByPlaceholder('Search bookmarks...')).toBeVisible();
  });

  managerTest('search filters bookmarks by title', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    await main.getByPlaceholder('Search bookmarks...').fill('GitHub');
    await expect(main.getByText('GitHub', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(main.getByText('Jira', { exact: true })).not.toBeVisible();
  });

  managerTest('search filters bookmarks by URL', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    await main.getByPlaceholder('Search bookmarks...').fill('jira.example');
    await expect(main.getByText('Jira', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  managerTest('clearing search restores folder view', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    const searchInput = main.getByPlaceholder('Search bookmarks...');
    await searchInput.fill('GitHub');
    await expect(main.getByText('GitHub', { exact: true })).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('');
    await expect(main.getByText('GitHub', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  managerTest('search excludes folders from results', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    await main.getByPlaceholder('Search bookmarks...').fill('Work');
    await expect(main.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
  });
});
