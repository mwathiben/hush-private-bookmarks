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

const TWO_FOLDER_TREE = JSON.stringify({
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
      children: [],
      dateAdded: 0,
    },
    {
      type: 'folder',
      id: 'f2',
      name: 'Personal',
      children: [],
      dateAdded: 0,
    },
  ],
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

function makeTreeTest(treeData: string) {
  return extensionTest.extend<{ treePage: Page }>({
    treePage: async ({ context, extensionId }, use) => {
      let sw = context.serviceWorkers()[0];
      if (!sw) sw = await context.waitForEvent('serviceworker');

      await sw.evaluate(
        seedStorage(),
        [SEED_PASSWORD, treeData] as const,
      );

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await unlockPopup(page, SEED_PASSWORD);
      await use(page);
      await page.close();
    },
  });
}

const emptyTreeTest = makeTreeTest(EMPTY_TREE);
const populatedTreeTest = makeTreeTest(POPULATED_TREE);
const twoFolderTest = makeTreeTest(TWO_FOLDER_TREE);

emptyTreeTest.describe('Popup bookmarks — empty tree (BOOKMARK-001)', () => {
  emptyTreeTest.setTimeout(120_000);

  emptyTreeTest('shows empty state for new user', async ({ treePage }) => {
    await expect(treePage.getByText('No bookmarks yet')).toBeVisible();
  });

  emptyTreeTest(
    'shows enabled toolbar add buttons',
    async ({ treePage }) => {
      await expect(
        treePage.getByLabel('Add bookmark'),
      ).toBeEnabled();
      await expect(
        treePage.getByLabel('Add folder'),
      ).toBeEnabled();
    },
  );

  emptyTreeTest(
    'shows enabled add bookmark button in empty state',
    async ({ treePage }) => {
      const buttons = treePage.getByRole('button', { name: /add bookmark/i });
      const count = await buttons.count();
      expect(count).toBe(2);
      for (let i = 0; i < count; i++) {
        await expect(buttons.nth(i)).toBeEnabled();
      }
    },
  );
});

emptyTreeTest.describe('Popup bookmarks — add bookmark dialog (BOOKMARK-002)', () => {
  emptyTreeTest.setTimeout(120_000);

  emptyTreeTest(
    'toolbar Add Bookmark opens dialog',
    async ({ treePage }) => {
      await treePage.getByLabel('Add bookmark').click();
      await expect(treePage.getByRole('dialog')).toBeVisible();
      await expect(treePage.getByLabel('Title')).toBeVisible();
      await expect(treePage.getByLabel('URL')).toBeVisible();
    },
  );

  emptyTreeTest(
    'empty state Add Bookmark opens dialog',
    async ({ treePage }) => {
      await treePage.getByRole('button', { name: 'Add Bookmark', exact: true }).click();
      await expect(treePage.getByRole('dialog')).toBeVisible();
      await expect(treePage.getByLabel('Title')).toBeVisible();
    },
  );

  emptyTreeTest(
    'adds bookmark to empty tree',
    async ({ treePage }) => {
      await treePage.getByLabel('Add bookmark').click();
      await treePage.getByLabel('Title').fill('Example');
      await treePage.getByLabel('URL').fill('https://example.com');
      await treePage.getByRole('dialog').getByRole('button', { name: /add bookmark/i }).click();

      await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
      await expect(treePage.getByRole('button', { name: 'Example' })).toBeVisible();
      await expect(treePage.getByText('No bookmarks yet')).not.toBeVisible();
    },
  );

  emptyTreeTest(
    'validates URL — invalid URL shows error',
    async ({ treePage }) => {
      await treePage.getByLabel('Add bookmark').click();
      await treePage.getByLabel('Title').fill('Bad Site');
      await treePage.getByLabel('URL').fill('not-a-url');
      await treePage.getByRole('dialog').getByRole('button', { name: /add bookmark/i }).click();

      await expect(treePage.getByRole('alert')).toBeVisible();
      await expect(treePage.getByRole('dialog')).toBeVisible();
    },
  );
});

populatedTreeTest.describe('Popup bookmarks — add folder dialog (BOOKMARK-002)', () => {
  populatedTreeTest.setTimeout(120_000);

  populatedTreeTest(
    'Add Folder button opens dialog and creates folder',
    async ({ treePage }) => {
      await treePage.getByRole('button', { name: 'Add folder' }).click();
      await expect(treePage.getByRole('dialog')).toBeVisible();
      await treePage.getByLabel('Name').fill('Research');
      await treePage.getByRole('button', { name: /add folder/i }).click();

      await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
      await expect(treePage.getByText('Research')).toBeVisible();
    },
  );

  populatedTreeTest(
    'dialog cancel closes without changes',
    async ({ treePage }) => {
      await treePage.getByRole('button', { name: 'Add folder' }).click();
      await expect(treePage.getByRole('dialog')).toBeVisible();
      await treePage.getByLabel('Name').fill('Temp');
      await treePage.keyboard.press('Escape');

      await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
      await expect(treePage.getByRole('button', { name: 'GitHub' })).toBeVisible();
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

populatedTreeTest.describe(
  'Popup bookmarks — context actions (BOOKMARK-003)',
  () => {
    populatedTreeTest.setTimeout(120_000);

    populatedTreeTest(
      'delete bookmark via context menu',
      async ({ treePage }) => {
        await treePage.getByLabel('Actions').first().click();
        await treePage.getByText('Delete').click();
        await expect(treePage.getByText(/Delete "GitHub"/)).toBeVisible({ timeout: 10_000 });
        await treePage.getByRole('button', { name: 'Delete' }).click();
        await expect(treePage.getByRole('button', { name: 'GitHub' })).not.toBeVisible({ timeout: 10_000 });
      },
    );

    populatedTreeTest(
      'cancel delete keeps bookmark',
      async ({ treePage }) => {
        await treePage.getByLabel('Actions').first().click();
        await treePage.getByText('Delete').click();
        await expect(treePage.getByText(/Delete "GitHub"/)).toBeVisible({ timeout: 10_000 });
        await treePage.getByRole('button', { name: /cancel/i }).click();
        await expect(treePage.getByRole('button', { name: 'GitHub' })).toBeVisible();
      },
    );

    populatedTreeTest(
      'edit bookmark via context menu',
      async ({ treePage }) => {
        await treePage.getByLabel('Actions').first().click();
        await treePage.getByText('Edit').click();
        await expect(treePage.getByLabel('Title')).toHaveValue('GitHub', { timeout: 10_000 });
        await treePage.getByLabel('Title').fill('GitHub Updated');
        await treePage.getByRole('button', { name: /save changes/i }).click();
        await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
        await expect(treePage.getByRole('button', { name: 'GitHub Updated' })).toBeVisible();
      },
    );

    populatedTreeTest(
      'rename folder via context menu',
      async ({ treePage }) => {
        await treePage.getByLabel('Folder actions').first().click();
        await treePage.getByText('Rename').click();
        await expect(treePage.getByRole('textbox', { name: 'Name' })).toHaveValue('Work', { timeout: 10_000 });
        await treePage.getByRole('textbox', { name: 'Name' }).fill('Personal');
        await treePage.getByRole('button', { name: /save changes/i }).click();
        await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
        await expect(treePage.getByText('Personal')).toBeVisible();
      },
    );

    populatedTreeTest(
      'move bookmark to folder via context menu',
      async ({ treePage }) => {
        await populatedTreeTest.step('initiate move via context menu', async () => {
          await treePage.getByLabel('Actions').first().click();
          await treePage.getByText('Move to...').click();
          await expect(treePage.getByText('Move to folder')).toBeVisible({ timeout: 10_000 });
          await treePage.getByRole('button', { name: /work/i }).click();
          await expect(treePage.getByText('Move to folder')).not.toBeVisible({ timeout: 10_000 });
        });

        await populatedTreeTest.step('verify bookmark removed from root', async () => {
          await expect(treePage.getByRole('button', { name: 'GitHub' })).not.toBeVisible();
        });

        await populatedTreeTest.step('verify bookmark in destination folder', async () => {
          await treePage.getByText('Work').click();
          await expect(treePage.getByRole('button', { name: 'GitHub' })).toBeVisible({ timeout: 10_000 });
        });
      },
    );

    populatedTreeTest(
      'delete folder via context menu',
      async ({ treePage }) => {
        await populatedTreeTest.step('verify folder contents visible before delete', async () => {
          await treePage.getByText('Work').click();
          await expect(treePage.getByRole('button', { name: 'Jira' })).toBeVisible({ timeout: 10_000 });
        });

        await populatedTreeTest.step('open folder context menu and delete', async () => {
          await treePage.getByLabel('Folder actions').first().click();
          await treePage.getByText('Delete').click();
          await expect(treePage.getByText(/Delete "Work"/)).toBeVisible({ timeout: 10_000 });
          await treePage.getByRole('button', { name: 'Delete' }).click();
        });

        await populatedTreeTest.step('verify folder and contents removed', async () => {
          await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
          await expect(treePage.getByText('Work')).not.toBeVisible({ timeout: 10_000 });
          await expect(treePage.getByRole('button', { name: 'Jira' })).not.toBeVisible();
        });
      },
    );
  },
);

emptyTreeTest.describe(
  'Popup bookmarks — CRUD lifecycle (BOOKMARK-004)',
  () => {
    emptyTreeTest.setTimeout(120_000);

    emptyTreeTest(
      'full bookmark lifecycle: add → edit → delete → empty state',
      async ({ treePage }) => {
        await emptyTreeTest.step('add bookmark via toolbar', async () => {
          await treePage.getByLabel('Add bookmark').click();
          await treePage.getByLabel('Title').fill('Test Site');
          await treePage.getByLabel('URL').fill('https://test.com');
          await treePage.getByRole('dialog').getByRole('button', { name: /add bookmark/i }).click();
          await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
          await expect(treePage.getByRole('button', { name: 'Test Site' })).toBeVisible();
          await expect(treePage.getByText('No bookmarks yet')).not.toBeVisible();
        });

        await emptyTreeTest.step('edit bookmark via context menu', async () => {
          await treePage.getByLabel('Actions').first().click();
          await treePage.getByText('Edit').click();
          await expect(treePage.getByLabel('Title')).toHaveValue('Test Site', { timeout: 10_000 });
          await treePage.getByLabel('Title').fill('Updated Site');
          await treePage.getByRole('button', { name: /save changes/i }).click();
          await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
          await expect(treePage.getByRole('button', { name: 'Updated Site' })).toBeVisible();
        });

        await emptyTreeTest.step('delete bookmark via context menu', async () => {
          await treePage.getByLabel('Actions').first().click();
          await treePage.getByText('Delete').click();
          await expect(treePage.getByText(/Delete "Updated Site"/)).toBeVisible({ timeout: 10_000 });
          await treePage.getByRole('button', { name: 'Delete' }).click();
          await expect(treePage.getByRole('button', { name: 'Updated Site' })).not.toBeVisible({ timeout: 10_000 });
          await expect(treePage.getByText('No bookmarks yet')).toBeVisible();
        });
      },
    );

    emptyTreeTest(
      'folder lifecycle: create folder and add bookmark to root',
      async ({ treePage }) => {
        await emptyTreeTest.step('create folder', async () => {
          await treePage.getByRole('button', { name: 'Add folder' }).click();
          await expect(treePage.getByRole('dialog')).toBeVisible();
          await treePage.getByLabel('Name').fill('Research');
          await treePage.getByRole('button', { name: /add folder/i }).click();
          await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
          await expect(treePage.getByText('Research')).toBeVisible();
        });

        await emptyTreeTest.step('add bookmark via toolbar', async () => {
          await treePage.getByLabel('Add bookmark').click();
          await treePage.getByLabel('Title').fill('Example');
          await treePage.getByLabel('URL').fill('https://example.com');
          await treePage.getByRole('dialog').getByRole('button', { name: /add bookmark/i }).click();
          await expect(treePage.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
          await expect(treePage.getByRole('button', { name: 'Example' })).toBeVisible();
        });

        await emptyTreeTest.step('verify empty state is gone', async () => {
          await expect(treePage.getByText('No bookmarks yet')).not.toBeVisible();
        });
      },
    );
  },
);

twoFolderTest.describe(
  'Popup bookmarks — move between folders (BOOKMARK-004)',
  () => {
    twoFolderTest.setTimeout(120_000);

    twoFolderTest(
      'move bookmark to Work, then move again to Personal',
      async ({ treePage }) => {
        await twoFolderTest.step('move GitHub from root to Work', async () => {
          await treePage.getByLabel('Actions').first().click();
          await treePage.getByText('Move to...').click();
          await expect(treePage.getByText('Move to folder')).toBeVisible({ timeout: 10_000 });
          await treePage.getByRole('button', { name: /work/i }).click();
          await expect(treePage.getByText('Move to folder')).not.toBeVisible({ timeout: 10_000 });
        });

        await twoFolderTest.step('expand Work and verify GitHub inside', async () => {
          await expect(treePage.getByRole('button', { name: 'GitHub' })).not.toBeVisible();
          await treePage.getByText('Work').click();
          await expect(treePage.getByRole('button', { name: 'GitHub' })).toBeVisible({ timeout: 10_000 });
        });

        await twoFolderTest.step('move GitHub from Work to Personal', async () => {
          await treePage.getByLabel('Actions', { exact: true }).click();
          await treePage.getByText('Move to...').click();
          await expect(treePage.getByText('Move to folder')).toBeVisible({ timeout: 10_000 });
          await treePage.getByRole('button', { name: /personal/i }).click();
          await expect(treePage.getByText('Move to folder')).not.toBeVisible({ timeout: 10_000 });
        });

        await twoFolderTest.step('collapse Work and expand Personal', async () => {
          await treePage.getByText('Work').click();
          await treePage.getByText('Personal').click();
        });

        await twoFolderTest.step('verify GitHub in Personal folder', async () => {
          await expect(treePage.getByRole('button', { name: 'GitHub' })).toBeVisible({ timeout: 10_000 });
        });
      },
    );
  },
);
