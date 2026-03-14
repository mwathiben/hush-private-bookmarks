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

async function unlockPopup(page: Page, password: string): Promise<void> {
  await expect(page.getByTestId('login-screen')).toBeVisible({
    timeout: 30_000,
  });
  const input = page.getByPlaceholder('Password');
  await input.click();
  await input.pressSequentially(password, { delay: 50 });
  await page.getByRole('button', { name: /unlock/i }).click();
  await expect(page.getByTestId('tree-screen')).toBeVisible({
    timeout: 60_000,
  });
}

const emptyTreeTest = extensionTest.extend<{ treePage: Page }>({
  treePage: async ({ context, extensionId }, use) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker');

    await sw.evaluate(
      seedStorage(),
      [SEED_PASSWORD, EMPTY_TREE] as const,
    );

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await unlockPopup(page, SEED_PASSWORD);
    await use(page);
    await page.close();
  },
});

const populatedTreeTest = extensionTest.extend<{ treePage: Page }>({
  treePage: async ({ context, extensionId }, use) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent('serviceworker');

    await sw.evaluate(
      seedStorage(),
      [SEED_PASSWORD, POPULATED_TREE] as const,
    );

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await unlockPopup(page, SEED_PASSWORD);
    await use(page);
    await page.close();
  },
});

emptyTreeTest.describe('Popup bookmarks — empty tree (BOOKMARK-001)', () => {
  emptyTreeTest.setTimeout(120_000);

  emptyTreeTest('shows empty state for new user', async ({ treePage }) => {
    await expect(treePage.getByText('No bookmarks yet')).toBeVisible();
  });

  emptyTreeTest(
    'shows disabled add bookmark button',
    async ({ treePage }) => {
      const addButtons = treePage.getByRole('button', {
        name: /add bookmark/i,
      });
      const count = await addButtons.count();
      for (let i = 0; i < count; i++) {
        await expect(addButtons.nth(i)).toBeDisabled();
      }
    },
  );
});

populatedTreeTest.describe(
  'Popup bookmarks — populated tree (BOOKMARK-001)',
  () => {
    populatedTreeTest.setTimeout(120_000);

    populatedTreeTest(
      'renders bookmark titles from tree data',
      async ({ treePage }) => {
        await expect(
          treePage.getByRole('button', { name: 'GitHub' }),
        ).toBeVisible();
      },
    );

    populatedTreeTest(
      'renders folder names from tree data',
      async ({ treePage }) => {
        await expect(treePage.getByText('Work')).toBeVisible();
      },
    );

    populatedTreeTest(
      'shows toolbar with Bookmarks heading',
      async ({ treePage }) => {
        await expect(treePage.getByText('Bookmarks')).toBeVisible();
      },
    );
  },
);
