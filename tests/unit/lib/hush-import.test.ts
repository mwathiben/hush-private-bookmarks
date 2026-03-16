/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect } from 'vitest';
import sjcl from 'sjcl';
import { ImportError, InvalidPasswordError } from '@/lib/errors';
import { decryptHushBlob, mapHushToTree, importHushData } from '@/lib/hush-import';

const HUSH_PASSWORD = 'test-hush-password-2026';

const HUSH_DATA = {
  key: 'ignored-sensitive-key-field',
  folders: [
    {
      id: 'folder-home',
      title: 'Home',
      bookmarks: [
        { url: 'https://example.com', text: 'Example Site', created: '2025-01-15T10:30:00.000Z' },
        { url: 'https://github.com', text: 'GitHub', created: '2025-06-20T14:00:00.000Z' },
      ],
    },
    {
      id: 'folder-trash',
      title: 'Trash',
      bookmarks: [
        { url: 'https://deleted.example.com', text: 'Deleted Page', created: '2025-03-01T00:00:00.000Z' },
      ],
    },
    {
      id: 'folder-work',
      title: 'Work',
      bookmarks: [],
    },
  ],
};

const VALID_BLOB = sjcl.encrypt(HUSH_PASSWORD, JSON.stringify(HUSH_DATA));

const PRE_1_0_DATA = {
  bookmarks: [
    { url: 'https://old-site.example.com', text: 'Old Bookmark', created: '2024-01-01T00:00:00.000Z' },
  ],
};

describe('decryptHushBlob', () => {
  it('decrypts valid SJCL blob with correct password', async () => {
    const result = await decryptHushBlob(VALID_BLOB, HUSH_PASSWORD);
    expect(result).toBeDefined();
    expect(Array.isArray(result.folders)).toBe(true);
    expect(result.folders).toHaveLength(3);
  });

  it('throws InvalidPasswordError for wrong password', async () => {
    await expect(decryptHushBlob(VALID_BLOB, 'wrong-password'))
      .rejects.toThrow(InvalidPasswordError);
  });

  it('throws ImportError for malformed blob', async () => {
    await expect(decryptHushBlob('not-valid-sjcl-json', HUSH_PASSWORD))
      .rejects.toThrow(ImportError);

    try {
      await decryptHushBlob('not-valid-sjcl-json', HUSH_PASSWORD);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ImportError);
      expect((error as ImportError).context.source).toBe('hush');
    }
  });
});

describe('mapHushToTree', () => {
  it('maps folders and bookmarks to BookmarkNode[]', () => {
    const nodes = mapHushToTree(HUSH_DATA);
    expect(nodes).toHaveLength(2);

    const home = nodes.find((n) => n.type === 'folder' && n.name === 'Home');
    expect(home).toBeDefined();
    expect(home!.type).toBe('folder');
    if (home!.type === 'folder') {
      expect(home!.children).toHaveLength(2);
    }

    const work = nodes.find((n) => n.type === 'folder' && n.name === 'Work');
    expect(work).toBeDefined();
  });

  it('filters out Trash folder', () => {
    const nodes = mapHushToTree(HUSH_DATA);
    const trash = nodes.find((n) => n.type === 'folder' && n.name === 'Trash');
    expect(trash).toBeUndefined();
  });

  it('handles empty folders gracefully', () => {
    const nodes = mapHushToTree(HUSH_DATA);
    const work = nodes.find((n) => n.type === 'folder' && n.name === 'Work');
    expect(work).toBeDefined();
    expect(work!.type).toBe('folder');
    if (work!.type === 'folder') {
      expect(work!.children).toHaveLength(0);
    }
  });

  it('maps Hush bookmark fields (text→title, url→url, created→dateAdded)', () => {
    const nodes = mapHushToTree(HUSH_DATA);
    const home = nodes.find((n) => n.type === 'folder' && n.name === 'Home');
    expect(home).toBeDefined();
    if (home!.type === 'folder') {
      const firstBookmark = home!.children[0];
      expect(firstBookmark).toBeDefined();
      expect(firstBookmark!.type).toBe('bookmark');
      if (firstBookmark!.type === 'bookmark') {
        expect(firstBookmark!.title).toBe('Example Site');
        expect(firstBookmark!.url).toBe('https://example.com');
        const expectedTimestamp = Date.parse('2025-01-15T10:30:00.000Z');
        expect(firstBookmark!.dateAdded).toBe(expectedTimestamp);
        expect(Number.isInteger(firstBookmark!.dateAdded)).toBe(true);
      }
    }
  });

  it('handles pre-1.0 exports without folders array', () => {
    const nodes = mapHushToTree(PRE_1_0_DATA);
    expect(nodes).toHaveLength(1);
    const folder = nodes[0];
    expect(folder).toBeDefined();
    expect(folder!.type).toBe('folder');
    if (folder!.type === 'folder') {
      expect(folder!.children).toHaveLength(1);
      const bookmark = folder!.children[0];
      expect(bookmark).toBeDefined();
      if (bookmark!.type === 'bookmark') {
        expect(bookmark!.title).toBe('Old Bookmark');
        expect(bookmark!.url).toBe('https://old-site.example.com');
      }
    }
  });
});

describe('importHushData', () => {
  it('wraps import in Hush Import folder and returns Result with stats', async () => {
    const result = await importHushData(VALID_BLOB, HUSH_PASSWORD);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tree.type).toBe('folder');
      expect(result.data.tree.name).toBe('Hush Import');
      expect(result.data.tree.children.length).toBeGreaterThan(0);
    }
  });

  it('returns Result with ImportStats (folder/bookmark counts)', async () => {
    const result = await importHushData(VALID_BLOB, HUSH_PASSWORD);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats.foldersImported).toBe(2);
      expect(result.data.stats.bookmarksImported).toBe(2);
      expect(Array.isArray(result.data.stats.errors)).toBe(true);
    }
  });

  it('returns error Result for wrong password (InvalidPasswordError)', async () => {
    const result = await importHushData(VALID_BLOB, 'wrong-password');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvalidPasswordError);
    }
  });
});
