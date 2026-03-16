import { test as extensionTest, expect } from './fixtures/extension';
import { seedStorage, SEED_PASSWORD, POPULATED_TREE } from './fixtures/seed-storage';
import type { Page } from '@playwright/test';

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
    const jira = main.getByText('Jira', { exact: true });
    await expect(jira).not.toBeVisible({ timeout: 5_000 });
  });

  managerTest('search filters bookmarks by URL', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    await main.getByPlaceholder('Search bookmarks...').fill('jira.example');
    await expect(main.getByText('Jira', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  managerTest('clearing search restores folder view', async ({ managerPage }) => {
    const sidebar = managerPage.getByTestId('manager-sidebar');
    const main = managerPage.getByTestId('manager-main');
    const searchInput = main.getByPlaceholder('Search bookmarks...');
    const workFolder = main.getByText('Work', { exact: true });

    await sidebar.getByText('Work', { exact: true }).click();
    await expect(main.getByText('Jira', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(main.getByText('GitHub', { exact: true })).not.toBeVisible({ timeout: 5_000 });

    await searchInput.fill('GitHub');
    await expect(main.getByText('GitHub', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(main.getByText('Jira', { exact: true })).not.toBeVisible({ timeout: 5_000 });

    await searchInput.fill('');
    await expect(workFolder).toBeVisible({ timeout: 5_000 });
  });

  managerTest('search excludes folders from results', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    await main.getByPlaceholder('Search bookmarks...').fill('Work');
    await expect(main.getByTestId('search-empty')).toBeVisible({ timeout: 5_000 });
  });
});

managerTest.describe('Manager settings (MANAGER-003)', () => {
  managerTest.setTimeout(120_000);

  managerTest('settings button navigates to settings screen', async ({ managerPage }) => {
    const sidebar = managerPage.getByTestId('manager-sidebar');
    await sidebar.getByLabel('Settings').click();
    await expect(managerPage.getByTestId('settings-screen')).toBeVisible({ timeout: 10_000 });
  });

  managerTest('settings back button returns to tree view', async ({ managerPage }) => {
    const sidebar = managerPage.getByTestId('manager-sidebar');
    await sidebar.getByLabel('Settings').click();
    await expect(managerPage.getByTestId('settings-screen')).toBeVisible({ timeout: 10_000 });

    await managerPage.getByLabel('Back').click();
    await expect(managerPage.getByTestId('manager-sidebar')).toBeVisible({ timeout: 10_000 });
    await expect(managerPage.getByTestId('manager-main')).toBeVisible();
  });
});

extensionTest.describe('Popup Open Manager (MANAGER-003)', () => {
  extensionTest.setTimeout(120_000);

  extensionTest('open manager button opens manager in new tab', async ({ context, extensionId }) => {
    // #given — seed storage
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await sw.evaluate(seedStorage(), [SEED_PASSWORD, POPULATED_TREE] as const);

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(popupPage.getByTestId('login-screen')).toBeVisible({ timeout: 30_000 });
    const input = popupPage.getByPlaceholder('Password');
    await input.click();
    await input.pressSequentially(SEED_PASSWORD, { delay: 50 });
    await popupPage.getByRole('button', { name: /unlock/i }).click();
    await expect(popupPage.getByTestId('tree-screen')).toBeVisible({ timeout: 60_000 });

    // #when — click Open Manager and detect new tab
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      popupPage.getByLabel('Open Manager').click(),
    ]);

    // #then — verify manager page opened
    await newPage.waitForURL('**/manager.html', { timeout: 10_000 });
    expect(newPage.url()).toContain('manager.html');

    await newPage.close();
    await popupPage.close();
  });
});

managerTest.describe('Manager full flow (MANAGER-003)', () => {
  managerTest.setTimeout(120_000);

  managerTest('tree → search → settings → back', async ({ managerPage }) => {
    const main = managerPage.getByTestId('manager-main');
    const sidebar = managerPage.getByTestId('manager-sidebar');

    // Tree: verify content
    await expect(main.getByText('GitHub', { exact: true })).toBeVisible();

    // Search
    await main.getByPlaceholder('Search bookmarks...').fill('Jira');
    await expect(main.getByText('Jira', { exact: true })).toBeVisible({ timeout: 5_000 });
    await main.getByPlaceholder('Search bookmarks...').fill('');

    // Sidebar folder navigation
    await sidebar.getByText('Work', { exact: true }).click();
    await expect(main.getByText('Jira', { exact: true })).toBeVisible({ timeout: 5_000 });

    // Navigate to settings
    await sidebar.getByLabel('Settings').click();
    await expect(managerPage.getByTestId('settings-screen')).toBeVisible({ timeout: 10_000 });

    // Return to tree
    await managerPage.getByLabel('Back').click();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('GitHub', { exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
