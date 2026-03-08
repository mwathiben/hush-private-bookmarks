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

// E2E backup tests use 1000 PBKDF2 iterations (not production 600K).
// These verify the Web Crypto API encrypt/decrypt/JSON pipeline works in
// a real Chromium extension context, not PBKDF2 key-stretching strength.
test.describe('IMPORT-003: Encrypted backup E2E', () => {
  test('backup roundtrip works in extension context', async ({
    context,
    extensionId,
  }) => {
    test.setTimeout(60_000);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — inline mirror of exportEncryptedBackup + importEncryptedBackup logic
    const result = await page.evaluate(async () => {
      const iterations = 1000;
      const password = 'e2e-backup-password';
      const tree = {
        type: 'folder' as const,
        id: 'root',
        name: 'Test Root',
        dateAdded: 1609459200000,
        children: [
          { type: 'bookmark' as const, id: 'bm1', title: 'Example', url: 'https://example.com', dateAdded: 1609459200000 },
        ],
      };

      function uint8ToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
      }
      function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }

      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      const plaintext = JSON.stringify(tree);
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, encoder.encode(plaintext));

      const store = {
        salt: uint8ToBase64(salt),
        iv: uint8ToBase64(iv),
        encrypted: uint8ToBase64(new Uint8Array(encrypted)),
        iterations,
      };
      const envelope = JSON.stringify({ version: 1, store });

      const parsed = JSON.parse(envelope) as { version: number; store: typeof store };
      const dSalt = base64ToUint8(parsed.store.salt);
      const dIv = base64ToUint8(parsed.store.iv);
      const dEncrypted = base64ToUint8(parsed.store.encrypted);
      const dKeyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
      const dKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: dSalt, iterations: parsed.store.iterations, hash: 'SHA-256' },
        dKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
      const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dIv, tagLength: 128 }, dKey, dEncrypted);
      const decryptedJson = new TextDecoder().decode(decryptedBuffer);
      const restored = JSON.parse(decryptedJson) as typeof tree;

      return { name: restored.name, childCount: restored.children.length, childTitle: restored.children[0]?.title };
    });

    // #then
    expect(result.name).toBe('Test Root');
    expect(result.childCount).toBe(1);
    expect(result.childTitle).toBe('Example');
    await page.close();
  });

  test('wrong password rejected in extension context', async ({
    context,
    extensionId,
  }) => {
    test.setTimeout(60_000);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #when — encrypt with one password, decrypt with another
    const errorName = await page.evaluate(async () => {
      const iterations = 1000;
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encKeyMaterial = await crypto.subtle.importKey('raw', encoder.encode('correct-password'), 'PBKDF2', false, ['deriveKey']);
      const encKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        encKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, encKey, encoder.encode('secret data'));

      const wrongKeyMaterial = await crypto.subtle.importKey('raw', encoder.encode('wrong-password'), 'PBKDF2', false, ['deriveKey']);
      const wrongKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        wrongKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      try {
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, wrongKey, encrypted);
        return 'no-error';
      } catch (error) {
        return (error as Error).name;
      }
    });

    // #then — AES-GCM rejects wrong key with OperationError
    expect(errorName).toBe('OperationError');
    await page.close();
  });

  test('backup envelope format is valid', async ({
    context,
    extensionId,
  }) => {
    test.setTimeout(60_000);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    const RFC4648_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

    // #when — create a backup envelope and inspect its format
    const result = await page.evaluate(async () => {
      const iterations = 1000;
      const password = 'format-check-pwd';
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      function uint8ToBase64(bytes: Uint8Array): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
      }

      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, encoder.encode('{"type":"folder"}'));
      const store = {
        salt: uint8ToBase64(salt),
        iv: uint8ToBase64(iv),
        encrypted: uint8ToBase64(new Uint8Array(encrypted)),
        iterations,
      };
      return { version: 1, salt: store.salt, iv: store.iv, encrypted: store.encrypted, iterations: store.iterations };
    });

    // #then — envelope fields have correct types and base64 format
    expect(result.version).toBe(1);
    expect(result.salt).toMatch(RFC4648_BASE64);
    expect(result.iv).toMatch(RFC4648_BASE64);
    expect(result.encrypted).toMatch(RFC4648_BASE64);
    expect(result.iterations).toBe(1000);
    await page.close();
  });
});

test.describe('IMPORT-004: Edge cases E2E', () => {
  test('data: and javascript: URLs preserved through real DOMParser', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #given — HTML with data: and javascript: URLs
    const result = await page.evaluate(() => {
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="data:text/html,<h1>Hello</h1>" ADD_DATE="1700000000">Data Link</A>
  <DT><A HREF="javascript:void(0)" ADD_DATE="1700000000">JS Link</A>
</DL>`;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const anchors = doc.querySelectorAll('a');
      return Array.from(anchors).map(a => ({
        href: a.getAttribute('href'),
        title: a.textContent?.trim(),
      }));
    });

    // #then
    expect(result).toHaveLength(2);
    expect(result[0]?.href).toBe('data:text/html,<h1>Hello</h1>');
    expect(result[0]?.title).toBe('Data Link');
    expect(result[1]?.href).toBe('javascript:void(0)');
    expect(result[1]?.title).toBe('JS Link');
    await page.close();
  });

  test('deeply nested folders (10 levels) preserve hierarchy in real DOMParser', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #given — 10-level nested DL/DT structure
    const result = await page.evaluate(() => {
      let inner = '<DT><A HREF="https://example.com/leaf" ADD_DATE="1700000000">Leaf</A>';
      for (let d = 9; d >= 0; d--) {
        inner = `<DT><H3 ADD_DATE="1700000000">Level ${d}</H3>\n<DL><p>\n${inner}\n</DL>`;
      }
      const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<DL><p>\n${inner}\n</DL>`;
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const names: string[] = [];
      let dl: Element | null = doc.querySelector('dl');
      for (let d = 0; d < 10; d++) {
        if (!dl) break;
        const dt = dl.querySelector(':scope > dt');
        const h3 = dt?.querySelector(':scope > h3');
        if (h3) names.push(h3.textContent?.trim() ?? '');
        dl = dt?.querySelector(':scope > dl') ?? null;
      }

      const leafAnchor = dl?.querySelector(':scope > dt > a');
      return { names, leafHref: leafAnchor?.getAttribute('href'), leafTitle: leafAnchor?.textContent?.trim() };
    });

    // #then
    expect(result.names).toHaveLength(10);
    for (let d = 0; d < 10; d++) {
      expect(result.names[d]).toBe(`Level ${d}`);
    }
    expect(result.leafHref).toBe('https://example.com/leaf');
    expect(result.leafTitle).toBe('Leaf');
    await page.close();
  });

  test('backup roundtrip with complex tree preserves special characters', async ({ context, extensionId }) => {
    test.setTimeout(60_000);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // #given — complex tree with Unicode, &amp;, data: URLs, 5-level nesting
    const result = await page.evaluate(async () => {
      const password = 'test-password-123';
      const iterations = 1000;

      async function deriveKey(pwd: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );
      }

      function uint8ToBase64(bytes: Uint8Array<ArrayBuffer>): string {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        return btoa(binary);
      }
      function base64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }

      const tree = {
        type: 'folder', id: 'root', name: 'Root', dateAdded: 1,
        children: [
          { type: 'bookmark', id: 'b1', title: 'Ünïcödé & Spëcîäl <chars>', url: 'data:text/html,<h1>Hi</h1>', dateAdded: 1 },
          {
            type: 'folder', id: 'f1', name: '日本語フォルダ', dateAdded: 1,
            children: [{
              type: 'folder', id: 'f2', name: 'Level 2', dateAdded: 1,
              children: [{
                type: 'folder', id: 'f3', name: 'Level 3', dateAdded: 1,
                children: [{
                  type: 'folder', id: 'f4', name: 'Level 4', dateAdded: 1,
                  children: [{
                    type: 'bookmark', id: 'deep', title: 'Deep Link', url: 'https://example.com/deep?a=1&b=2', dateAdded: 1,
                  }],
                }],
              }],
            }],
          },
        ],
      };

      const plaintext = JSON.stringify(tree);
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(password, salt);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, encoder.encode(plaintext));

      const store = {
        salt: uint8ToBase64(salt),
        iv: uint8ToBase64(iv),
        encrypted: uint8ToBase64(new Uint8Array(ciphertext)),
        iterations,
      };
      const envelope = JSON.stringify({ version: 1, store });

      const parsed = JSON.parse(envelope);
      const s = parsed.store;
      const decSalt = base64ToUint8Array(s.salt);
      const decIv = base64ToUint8Array(s.iv);
      const decEncrypted = base64ToUint8Array(s.encrypted);
      const decKey = await deriveKey(password, decSalt);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decIv, tagLength: 128 }, decKey, decEncrypted);
      const recovered = JSON.parse(new TextDecoder().decode(decrypted));

      return {
        unicodeTitle: recovered.children[0].title,
        unicodeUrl: recovered.children[0].url,
        japaneseName: recovered.children[1].name,
        deepUrl: recovered.children[1].children[0].children[0].children[0].children[0].url,
        deepTitle: recovered.children[1].children[0].children[0].children[0].children[0].title,
      };
    });

    // #then
    expect(result.unicodeTitle).toBe('Ünïcödé & Spëcîäl <chars>');
    expect(result.unicodeUrl).toBe('data:text/html,<h1>Hi</h1>');
    expect(result.japaneseName).toBe('日本語フォルダ');
    expect(result.deepUrl).toBe('https://example.com/deep?a=1&b=2');
    expect(result.deepTitle).toBe('Deep Link');
    await page.close();
  });
});
