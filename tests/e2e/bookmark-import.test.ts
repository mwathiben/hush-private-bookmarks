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

test.describe('IMPORT-002: HTML bookmark parsing E2E', () => {
  test('HTML parsing works via DOMParser in real browser context', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — parse Netscape HTML in real Chromium DOMParser
    const result = await page.evaluate(() => {
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1609459200">Dev</H3>
    <DL><p>
        <DT><A HREF="https://example.com" ADD_DATE="1609459200">Example</A>
        <DT><A HREF="https://github.com" ADD_DATE="1609459201">GitHub</A>
    </DL><p>
    <DT><A HREF="https://google.com" ADD_DATE="1609459202">Google</A>
</DL><p>`;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rootDl = doc.querySelector('dl');
      if (!rootDl) return { found: false, bookmarks: 0, folders: 0 };

      let bookmarks = 0;
      let folders = 0;
      const dts = rootDl.querySelectorAll('dt');
      for (const dt of dts) {
        if (dt.querySelector(':scope > a')) bookmarks++;
        if (dt.querySelector(':scope > h3')) folders++;
      }

      const firstAnchor = rootDl.querySelector('a');
      const addDate = firstAnchor?.getAttribute('add_date');

      return { found: true, bookmarks, folders, addDate };
    });

    // #then — DOMParser in real Chromium produces expected DOM structure
    expect(result.found).toBe(true);
    expect(result.bookmarks).toBe(3);
    expect(result.folders).toBe(1);
    expect(result.addDate).toBe('1609459200');
    await page.close();
  });

  test('HTML parsing produces correct folder hierarchy in real browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of walkDl logic to verify DOM structure in real Chromium
    const result = await page.evaluate(() => {
      const html = `<DL><p>
        <DT><H3 ADD_DATE="1609459200">Folder</H3>
        <DL><p>
          <DT><A HREF="https://example.com" ADD_DATE="1609459200">Example</A>
        </DL><p>
        <DT><A HREF="https://google.com" ADD_DATE="1609459201">Google</A>
      </DL><p>`;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rootDl = doc.querySelector('dl');
      if (!rootDl) return { found: false, topLevel: 0, folderChildren: 0 };

      let topLevel = 0;
      let folderChildren = 0;
      for (const child of rootDl.children) {
        if (child.tagName !== 'DT') continue;
        topLevel++;
        const h3 = child.querySelector(':scope > h3');
        if (h3) {
          const subDl = child.querySelector(':scope > dl');
          if (subDl) {
            for (const sub of subDl.children) {
              if (sub.tagName === 'DT') folderChildren++;
            }
          }
        }
      }
      return { found: true, topLevel, folderChildren };
    });

    // #then — hierarchy preserved: 2 top-level items, 1 child in folder
    expect(result.found).toBe(true);
    expect(result.topLevel).toBe(2);
    expect(result.folderChildren).toBe(1);
    await page.close();
  });

  test('special characters survive DOMParser in real browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — entities and Unicode through real Chromium DOMParser
    const result = await page.evaluate(() => {
      const html = `<DL><p>
        <DT><A HREF="https://example.com/search?q=hello&amp;world" ADD_DATE="1000">Rock &amp; Roll ♪</A>
      </DL><p>`;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const anchor = doc.querySelector('a');
      return {
        title: anchor?.textContent ?? '',
        url: anchor?.getAttribute('href') ?? '',
      };
    });

    // #then — entities decoded, Unicode preserved
    expect(result.title).toBe('Rock & Roll ♪');
    expect(result.url).toBe('https://example.com/search?q=hello&world');
    await page.close();
  });

  test('large HTML (100KB+) parses without timeout in real browser', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — parse a large HTML in real Chromium DOMParser
    const result = await page.evaluate(() => {
      const lines = ['<DL><p>'];
      for (let i = 0; i < 2000; i++) {
        lines.push(`<DT><A HREF="https://example.com/${i}" ADD_DATE="1609459200">Bookmark ${i}</A>`);
      }
      lines.push('</DL><p>');
      const html = lines.join('\n');

      const start = performance.now();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const elapsed = performance.now() - start;

      const rootDl = doc.querySelector('dl');
      const bookmarkCount = rootDl ? rootDl.querySelectorAll(':scope > dt > a').length : 0;
      return { elapsed, bookmarkCount };
    });

    // #then
    expect(result.elapsed).toBeLessThan(1000);
    expect(result.bookmarkCount).toBe(2000);
    await page.close();
  });
});
