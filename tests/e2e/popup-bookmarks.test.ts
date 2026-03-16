import { expect } from './fixtures/extension';
import { POPULATED_TREE, EMPTY_TREE, makeTreeTest } from './fixtures/seed-storage';

const emptyTreeTest = makeTreeTest(EMPTY_TREE);
const populatedTreeTest = makeTreeTest(POPULATED_TREE);
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

