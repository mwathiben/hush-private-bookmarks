/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest';
import type { Bookmark, BookmarkNode, BookmarkTree, Folder } from '@/lib/types';
import {
  collectAllUrls,
  countBookmarks,
  createEmptyTree,
  flattenTree,
} from '@/lib/data-model';

const BOOKMARK_A: Bookmark = {
  type: 'bookmark',
  id: 'bm-a',
  title: 'Alpha',
  url: 'https://alpha.com',
  dateAdded: 1000,
};

const BOOKMARK_B: Bookmark = {
  type: 'bookmark',
  id: 'bm-b',
  title: 'Bravo',
  url: 'https://bravo.com',
  dateAdded: 2000,
};

const BOOKMARK_C: Bookmark = {
  type: 'bookmark',
  id: 'bm-c',
  title: 'Charlie',
  url: 'https://charlie.com',
  dateAdded: 3000,
};

const BOOKMARK_D: Bookmark = {
  type: 'bookmark',
  id: 'bm-d',
  title: 'Delta',
  url: 'https://delta.com',
  dateAdded: 4000,
};

const BOOKMARK_E: Bookmark = {
  type: 'bookmark',
  id: 'bm-e',
  title: 'Echo',
  url: 'https://echo.com',
  dateAdded: 5000,
};

const SUB_FOLDER: Folder = {
  type: 'folder',
  id: 'f-sub',
  name: 'SubFolder',
  children: [BOOKMARK_C, BOOKMARK_D],
  dateAdded: 500,
};

const TOP_FOLDER: Folder = {
  type: 'folder',
  id: 'f-top',
  name: 'TopFolder',
  children: [BOOKMARK_A, SUB_FOLDER, BOOKMARK_E],
  dateAdded: 100,
};

const POPULATED_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [TOP_FOLDER, BOOKMARK_B],
  dateAdded: 0,
};

describe('DATAMODEL-004: collectAllUrls', () => {
  it('returns all bookmark URLs in tree', () => {
    // #given — tree with 5 bookmarks across nested folders
    // #when
    const urls = collectAllUrls(POPULATED_TREE);
    // #then
    expect(urls).toHaveLength(5);
    expect(urls).toContain('https://alpha.com');
    expect(urls).toContain('https://bravo.com');
    expect(urls).toContain('https://charlie.com');
    expect(urls).toContain('https://delta.com');
    expect(urls).toContain('https://echo.com');
  });

  it('returns empty array for empty tree', () => {
    // #given
    const emptyTree = createEmptyTree();
    // #when
    const urls = collectAllUrls(emptyTree);
    // #then
    expect(urls).toEqual([]);
  });

  it('does not include folder names (only bookmark URLs)', () => {
    // #given — tree with 2 folders and 1 bookmark
    const tree: BookmarkTree = {
      type: 'folder',
      id: 'root',
      name: 'Root',
      children: [
        {
          type: 'folder',
          id: 'f-1',
          name: 'Folder1',
          children: [{ type: 'bookmark', id: 'bm-only', title: 'Only', url: 'https://only.com', dateAdded: 1 }],
          dateAdded: 0,
        },
        { type: 'folder', id: 'f-2', name: 'Folder2', children: [], dateAdded: 0 },
      ],
      dateAdded: 0,
    };
    // #when
    const urls = collectAllUrls(tree);
    // #then
    expect(urls).toEqual(['https://only.com']);
    expect(urls).not.toContain('Root');
    expect(urls).not.toContain('Folder1');
    expect(urls).not.toContain('Folder2');
  });
});

describe('DATAMODEL-004: countBookmarks', () => {
  it('returns correct counts (root NOT counted)', () => {
    // #given — POPULATED_TREE has 5 bookmarks + 2 user-created folders (TOP_FOLDER, SUB_FOLDER)
    // Root is excluded from count
    // #when
    const counts = countBookmarks(POPULATED_TREE);
    // #then
    expect(counts).toEqual({ bookmarks: 5, folders: 2 });
  });

  it('returns zeros for empty tree', () => {
    // #given
    const emptyTree = createEmptyTree();
    // #when
    const counts = countBookmarks(emptyTree);
    // #then
    expect(counts).toEqual({ bookmarks: 0, folders: 0 });
  });
});

describe('DATAMODEL-004: flattenTree', () => {
  it('returns flat array of all nodes including root', () => {
    // #given — POPULATED_TREE: root + TOP_FOLDER(bm-a, SUB_FOLDER(bm-c, bm-d), bm-e) + bm-b
    // Total: 1 root + 2 folders + 5 bookmarks = 8 nodes
    // #when
    const flat = flattenTree(POPULATED_TREE);
    // #then
    expect(flat).toHaveLength(8);
    const types = flat.map((n: BookmarkNode) => n.type);
    expect(types.filter((t) => t === 'folder')).toHaveLength(3);
    expect(types.filter((t) => t === 'bookmark')).toHaveLength(5);
  });

  it('preserves node references (same objects)', () => {
    // #given
    // #when
    const flat = flattenTree(POPULATED_TREE);
    // #then — first child in flat array should be the same reference as tree.children[0]
    expect(flat[0]).toBe(POPULATED_TREE);
    expect(flat[1]).toBe(TOP_FOLDER);
    expect(flat[2]).toBe(BOOKMARK_A);
    const lastBookmark = flat[flat.length - 1];
    expect(lastBookmark).toBe(BOOKMARK_B);
  });
});
