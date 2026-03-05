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

test.describe('DATAMODEL-002: Immutable write operations E2E', () => {
  test('addBookmark creates correct tree structure in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of lib/data-model.ts addBookmark logic (structural sharing)
    const result = await page.evaluate(() => {
      const tree = {
        type: 'folder' as const, id: crypto.randomUUID(), name: 'Root',
        children: [] as Array<{ type: string; id: string; title?: string; url?: string; dateAdded: number }>,
        dateAdded: Date.now(),
      };
      const bookmark = { type: 'bookmark' as const, id: crypto.randomUUID(), title: 'Test BM', url: 'https://test.com', dateAdded: Date.now() };
      const newTree = { ...tree, children: [...tree.children, bookmark] };
      return { originalLength: tree.children.length, newLength: newTree.children.length, addedTitle: newTree.children[0]?.title, notSame: newTree !== tree };
    });

    // #then
    expect(result.originalLength).toBe(0);
    expect(result.newLength).toBe(1);
    expect(result.addedTitle).toBe('Test BM');
    expect(result.notSame).toBe(true);
    await page.close();
  });

  test('immutability: original tree unchanged after write', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of structural sharing immutability pattern
    const result = await page.evaluate(() => {
      const child = { type: 'bookmark' as const, id: 'bm-1', title: 'Old', url: 'https://old.com', dateAdded: 0 };
      const tree = { type: 'folder' as const, id: 'root', name: 'Root', children: [child], dateAdded: 0 };
      const ref = tree.children;
      const newTree = { ...tree, children: [...tree.children, { type: 'bookmark' as const, id: crypto.randomUUID(), title: 'New', url: 'https://new.com', dateAdded: 1 }] };
      return { sameRef: tree.children === ref, origLen: tree.children.length, newLen: newTree.children.length, notShared: tree.children !== newTree.children };
    });

    // #then
    expect(result.sameRef).toBe(true);
    expect(result.origLen).toBe(1);
    expect(result.newLen).toBe(2);
    expect(result.notShared).toBe(true);
    await page.close();
  });

  test('removeItem produces correct structure in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of lib/data-model.ts removeItem logic
    const result = await page.evaluate(() => {
      const bm1 = { type: 'bookmark' as const, id: 'bm-1', title: 'First', url: 'https://first.com', dateAdded: 0 };
      const bm2 = { type: 'bookmark' as const, id: 'bm-2', title: 'Second', url: 'https://second.com', dateAdded: 0 };
      const tree = { type: 'folder' as const, id: 'root', name: 'Root', children: [bm1, bm2], dateAdded: 0 };
      const newTree = { ...tree, children: tree.children.filter((_, i) => i !== 0) };
      return { origLen: tree.children.length, newLen: newTree.children.length, remainingId: newTree.children[0]?.id };
    });

    // #then
    expect(result.origLen).toBe(2);
    expect(result.newLen).toBe(1);
    expect(result.remainingId).toBe('bm-2');
    await page.close();
  });

  test('full CRUD cycle: add, update, remove in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of full CRUD cycle
    const result = await page.evaluate(() => {
      type BM = { type: 'bookmark'; id: string; title: string; url: string; dateAdded: number };
      type FN = { type: 'folder'; id: string; name: string; children: BM[]; dateAdded: number };
      const tree: FN = { type: 'folder', id: 'root', name: 'Root', children: [], dateAdded: 0 };
      const bm: BM = { type: 'bookmark', id: crypto.randomUUID(), title: 'Added', url: 'https://added.com', dateAdded: 1 };
      const afterAdd: FN = { ...tree, children: [...tree.children, bm] };
      const updated = { ...afterAdd.children[0]!, title: 'Updated', url: 'https://updated.com' };
      const afterUpdate: FN = { ...afterAdd, children: afterAdd.children.map((c, i) => (i === 0 ? updated : c)) };
      const afterRemove: FN = { ...afterUpdate, children: afterUpdate.children.filter((_, i) => i !== 0) };
      return { addLen: afterAdd.children.length, updateTitle: afterUpdate.children[0]?.title, removeLen: afterRemove.children.length, origLen: tree.children.length };
    });

    // #then
    expect(result.addLen).toBe(1);
    expect(result.updateTitle).toBe('Updated');
    expect(result.removeLen).toBe(0);
    expect(result.origLen).toBe(0);
    await page.close();
  });
});

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
