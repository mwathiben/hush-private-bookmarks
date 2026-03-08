/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { test, expect } from './fixtures/extension';
import { convertChromeBookmarks } from '@/lib/bookmark-import';
import type { ChromeBookmarkTreeNode } from '@/lib/bookmark-import';

test.describe('IMPORT-001: Chrome bookmark conversion E2E', () => {
  test('Chrome bookmark conversion produces correct tree structure', async () => {
    const chromeTree: ChromeBookmarkTreeNode[] = [{
      id: '0',
      title: '',
      children: [{
        id: '1', title: 'Bookmarks Bar', parentId: '0',
        children: [
          { id: '10', title: 'Google', url: 'https://google.com', parentId: '1', dateAdded: 1000 },
          { id: '20', title: 'Dev', parentId: '1', dateAdded: 2000, children: [
            { id: '21', title: 'MDN', url: 'https://developer.mozilla.org', parentId: '20', dateAdded: 3000 },
          ]},
        ],
      }],
    }];

    const result = convertChromeBookmarks(chromeTree);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { tree } = result.data;
    const bm = tree.children[0];
    expect(bm?.type).toBe('bookmark');
    if (bm?.type === 'bookmark') {
      expect(bm.title).toBe('Google');
      expect(bm.url).toBe('https://google.com');
    }

    const folder = tree.children[1];
    expect(folder?.type).toBe('folder');
    if (folder?.type === 'folder') {
      expect(folder.name).toBe('Dev');
      expect(folder.children).toHaveLength(1);
      expect(folder.children[0]?.type).toBe('bookmark');
    }
  });

  test('root container skipping works correctly', async () => {
    const chromeTree: ChromeBookmarkTreeNode[] = [{
      id: '0',
      title: '',
      children: [
        { id: '1', title: 'Bookmarks Bar', parentId: '0', children: [
          { id: '10', title: 'Google', url: 'https://google.com', parentId: '1', dateAdded: 1000 },
        ]},
        { id: '2', title: 'Other', parentId: '0', children: [
          { id: '20', title: 'GitHub', url: 'https://github.com', parentId: '2', dateAdded: 2000 },
        ]},
        { id: '3', title: 'Mobile', parentId: '0', children: [] },
      ],
    }];

    const result = convertChromeBookmarks(chromeTree);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { tree } = result.data;
    const titles: string[] = [];
    const folderNames: string[] = [];
    for (const child of tree.children) {
      if (child.type === 'bookmark') titles.push(child.title);
      if (child.type === 'folder') folderNames.push(child.name);
    }

    expect(titles).toEqual(['Google', 'GitHub']);
    expect(folderNames).not.toContain('Bookmarks Bar');
    expect(folderNames).not.toContain('Other');
    expect(folderNames).not.toContain('Mobile');
  });

  test('ID generation via crypto.randomUUID() works for imported items', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — generate IDs for 10 items in extension secure context
    const result = await page.evaluate(() => {
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        ids.push(crypto.randomUUID());
      }
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return {
        count: ids.length,
        allValid: ids.every((id) => uuidRe.test(id)),
        allUnique: new Set(ids).size === ids.length,
      };
    });

    // #then
    expect(result.count).toBe(10);
    expect(result.allValid).toBe(true);
    expect(result.allUnique).toBe(true);
    await page.close();
  });

  test('large tree (1000 bookmarks) conversion completes under 100ms', async () => {
    const folders: ChromeBookmarkTreeNode[] = [];
    for (let f = 0; f < 10; f++) {
      const bookmarks: ChromeBookmarkTreeNode[] = [];
      for (let b = 0; b < 100; b++) {
        bookmarks.push({
          id: `bm-${f}-${b}`,
          title: `BM ${f}-${b}`,
          url: `https://example.com/${f}/${b}`,
          dateAdded: Date.now(),
        });
      }
      folders.push({
        id: `f-${f}`,
        title: `Folder ${f}`,
        children: bookmarks,
        dateAdded: Date.now(),
      });
    }

    const chromeTree: ChromeBookmarkTreeNode[] = [{
      id: '0',
      title: '',
      children: [{
        id: '1', title: 'Bookmarks Bar', parentId: '0',
        children: folders,
      }],
    }];

    const start = performance.now();
    const result = convertChromeBookmarks(chromeTree);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.stats.bookmarksImported).toBe(1000);
    expect(result.data.stats.foldersImported).toBe(10);
  });

  test('extension loads without console errors after bookmark-import module added', async ({
    context,
    extensionId,
  }) => {
    const errors: string[] = [];
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('networkidle');

    // #then
    expect(errors).toEqual([]);
    await page.close();
  });
});
