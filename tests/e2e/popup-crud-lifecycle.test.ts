import { expect } from './fixtures/extension';
import { EMPTY_TREE, makeTreeTest } from './fixtures/seed-storage';

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

const emptyTreeTest = makeTreeTest(EMPTY_TREE);
const twoFolderTest = makeTreeTest(TWO_FOLDER_TREE);

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
          await treePage.getByRole('button', { name: 'Actions', exact: true }).click();
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
