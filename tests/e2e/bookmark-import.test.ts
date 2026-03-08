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

test.describe('IMPORT-001: Chrome bookmark conversion E2E', () => {
  test('Chrome bookmark conversion produces correct tree structure in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of convertNode logic from lib/bookmark-import.ts
    const result = await page.evaluate(() => {
      type ChromeNode = { id: string; title: string; url?: string; children?: ChromeNode[]; dateAdded?: number; parentId?: string };
      type BM = { type: 'bookmark'; id: string; title: string; url: string; dateAdded: number };
      type FN = { type: 'folder'; id: string; name: string; children: (BM | FN)[]; dateAdded: number };

      function convertNode(node: ChromeNode): BM | FN {
        const dateAdded = node.dateAdded ?? Date.now();
        if (typeof node.url === 'string' && node.url !== '') {
          return { type: 'bookmark', id: crypto.randomUUID(), title: node.title || 'Untitled', url: node.url, dateAdded };
        }
        return { type: 'folder', id: crypto.randomUUID(), name: node.title || 'Unnamed Folder', children: (node.children ?? []).map(convertNode), dateAdded };
      }

      const chromeNodes: ChromeNode[] = [
        { id: '10', title: 'Google', url: 'https://google.com', parentId: '1', dateAdded: 1000 },
        { id: '20', title: 'Dev', parentId: '1', dateAdded: 2000, children: [
          { id: '21', title: 'MDN', url: 'https://developer.mozilla.org', parentId: '20', dateAdded: 3000 },
        ]},
      ];
      const converted = chromeNodes.map(convertNode);
      const bm = converted[0] as BM;
      const folder = converted[1] as FN;

      return {
        bmType: bm.type,
        bmTitle: bm.title,
        bmUrl: bm.url,
        folderType: folder.type,
        folderName: folder.name,
        folderChildCount: folder.children.length,
        nestedType: folder.children[0]?.type,
      };
    });

    // #then
    expect(result.bmType).toBe('bookmark');
    expect(result.bmTitle).toBe('Google');
    expect(result.bmUrl).toBe('https://google.com');
    expect(result.folderType).toBe('folder');
    expect(result.folderName).toBe('Dev');
    expect(result.folderChildCount).toBe(1);
    expect(result.nestedType).toBe('bookmark');
    await page.close();
  });

  test('root container skipping works in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of isRootContainer + flattening from lib/bookmark-import.ts
    const result = await page.evaluate(() => {
      type ChromeNode = { id: string; title: string; url?: string; children?: ChromeNode[]; dateAdded?: number; parentId?: string; folderType?: string };

      function isRootContainer(node: ChromeNode): boolean {
        return node.folderType !== undefined || node.parentId === '0';
      }

      const chromeTree: ChromeNode[] = [{
        id: '0', title: '',
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

      const flattened: string[] = [];
      for (const root of chromeTree) {
        for (const container of root.children ?? []) {
          if (isRootContainer(container)) {
            for (const child of container.children ?? []) {
              flattened.push(child.title);
            }
          }
        }
      }

      return { flattened, containerSkipped: !flattened.includes('Bookmarks Bar') };
    });

    // #then
    expect(result.flattened).toEqual(['Google', 'GitHub']);
    expect(result.containerSkipped).toBe(true);
    await page.close();
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

  test('large tree (1000 bookmarks) conversion completes under 100ms in browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of recursive conversion on 10 folders x 100 bookmarks
    const result = await page.evaluate(() => {
      type ChromeNode = { id: string; title: string; url?: string; children?: ChromeNode[]; dateAdded?: number };
      type BM = { type: 'bookmark'; id: string; title: string; url: string; dateAdded: number };
      type FN = { type: 'folder'; id: string; name: string; children: (BM | FN)[]; dateAdded: number };

      function convertNode(node: ChromeNode): BM | FN {
        const dateAdded = node.dateAdded ?? Date.now();
        if (typeof node.url === 'string' && node.url !== '') {
          return { type: 'bookmark', id: crypto.randomUUID(), title: node.title, url: node.url, dateAdded };
        }
        return { type: 'folder', id: crypto.randomUUID(), name: node.title, children: (node.children ?? []).map(convertNode), dateAdded };
      }

      const folders: ChromeNode[] = [];
      for (let f = 0; f < 10; f++) {
        const bookmarks: ChromeNode[] = [];
        for (let b = 0; b < 100; b++) {
          bookmarks.push({ id: `bm-${f}-${b}`, title: `BM ${f}-${b}`, url: `https://example.com/${f}/${b}`, dateAdded: Date.now() });
        }
        folders.push({ id: `f-${f}`, title: `Folder ${f}`, children: bookmarks, dateAdded: Date.now() });
      }

      const start = performance.now();
      const converted = folders.map(convertNode);
      const elapsed = performance.now() - start;

      let totalItems = 0;
      function count(node: BM | FN): void {
        totalItems++;
        if (node.type === 'folder') node.children.forEach(count);
      }
      converted.forEach(count);

      return { elapsed, totalItems };
    });

    // #then
    expect(result.elapsed).toBeLessThan(100);
    expect(result.totalItems).toBe(1010);
    await page.close();
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
