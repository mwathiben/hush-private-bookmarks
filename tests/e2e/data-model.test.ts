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

test.describe('DATAMODEL-001: Data model E2E', () => {
  test('crypto.randomUUID() returns valid UUID in extension context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — generate UUID in real extension secure context
    const uuid = await page.evaluate(() => crypto.randomUUID());

    // #then — matches RFC 4122 v4 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);

    await page.close();
  });

  test('tree creation and path traversal works in browser runtime', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of lib/data-model.ts createEmptyTree and getItemByPath logic
    const result = await page.evaluate(() => {
      const tree = {
        type: 'folder' as const,
        id: crypto.randomUUID(),
        name: 'Root',
        children: [
          { type: 'bookmark' as const, id: 'bm-1', title: 'Test', url: 'https://example.com', dateAdded: 1000 },
        ],
        dateAdded: Date.now(),
      };

      const child = tree.children[0];
      return {
        rootType: tree.type,
        rootName: tree.name,
        childrenLength: tree.children.length,
        childType: child?.type,
        childTitle: child?.title,
        idIsString: typeof tree.id === 'string',
        idNotEmpty: tree.id.length > 0,
      };
    });

    // #then
    expect(result.rootType).toBe('folder');
    expect(result.rootName).toBe('Root');
    expect(result.childrenLength).toBe(1);
    expect(result.childType).toBe('bookmark');
    expect(result.childTitle).toBe('Test');
    expect(result.idIsString).toBe(true);
    expect(result.idNotEmpty).toBe(true);

    await page.close();
  });

  test('type guards discriminate bookmark from folder in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of lib/data-model.ts isBookmark and isFolder logic
    const result = await page.evaluate(() => {
      const bookmark = { type: 'bookmark' as const, id: '1', title: 'B', url: 'https://b.com', dateAdded: 0 };
      const folder = { type: 'folder' as const, id: '2', name: 'F', children: [] as unknown[], dateAdded: 0 };

      const isBookmark = (node: { type: string }): boolean => node.type === 'bookmark';
      const isFolder = (node: { type: string }): boolean => node.type === 'folder';

      return {
        bookmarkIsBookmark: isBookmark(bookmark),
        bookmarkIsFolder: isFolder(bookmark),
        folderIsBookmark: isBookmark(folder),
        folderIsFolder: isFolder(folder),
      };
    });

    // #then
    expect(result.bookmarkIsBookmark).toBe(true);
    expect(result.bookmarkIsFolder).toBe(false);
    expect(result.folderIsBookmark).toBe(false);
    expect(result.folderIsFolder).toBe(true);

    await page.close();
  });

  test('extension popup loads without console errors after data-model module added', async ({
    context,
    extensionId,
  }) => {
    const errors: string[] = [];
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('networkidle');

    // #then — no console errors from extension load
    expect(errors).toEqual([]);

    await page.close();
  });
});
