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
import { DataModelError } from '@/lib/errors';
import {
  addBookmark,
  addFolder,
  createEmptyTree,
  generateId,
  isBookmark,
  isFolder,
  removeItem,
  renameFolder,
  updateBookmark,
} from '@/lib/data-model';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj as Record<string, unknown>)) {
    deepFreeze(value);
  }
  return obj;
}

const MOCK_BOOKMARK: Bookmark = deepFreeze({
  type: 'bookmark',
  id: 'bm-1',
  title: 'Example',
  url: 'https://example.com',
  dateAdded: 1000,
});

const MOCK_FOLDER: Folder = deepFreeze({
  type: 'folder',
  id: 'f-1',
  name: 'Folder One',
  children: [
    { type: 'bookmark', id: 'bm-nested', title: 'Nested', url: 'https://nested.com', dateAdded: 2000 },
    { type: 'bookmark', id: 'bm-second', title: 'Second', url: 'https://second.com', dateAdded: 3000 },
  ],
  dateAdded: 1000,
});

const POPULATED_TREE: BookmarkTree = deepFreeze({
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [MOCK_FOLDER, MOCK_BOOKMARK],
  dateAdded: 0,
});

describe('DATAMODEL-002: Immutable writes', () => {
  describe('generateId', () => {
    it('returns 100 unique non-empty strings', () => {
      // #given
      const ids = new Set<string>();

      // #when
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }

      // #then
      expect(ids.size).toBe(100);
      for (const id of ids) {
        expect(id.length).toBeGreaterThan(0);
      }
    });
  });

  describe('addBookmark', () => {
    it('adds bookmark to root children', () => {
      // #given
      const tree = createEmptyTree();
      const input: Omit<Bookmark, 'id'> = {
        type: 'bookmark',
        title: 'New',
        url: 'https://new.com',
        dateAdded: 5000,
      };

      // #when
      const result = addBookmark(tree, [], input);

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.children).toHaveLength(1);
        const child = result.data.children[0]!;
        expect(isBookmark(child)).toBe(true);
        expect(child.id).toBeTruthy();
        expect((child as Bookmark).title).toBe('New');
        expect((child as Bookmark).url).toBe('https://new.com');
      }
    });

    it('adds bookmark to nested folder', () => {
      // #given
      const input: Omit<Bookmark, 'id'> = {
        type: 'bookmark',
        title: 'Deep',
        url: 'https://deep.com',
        dateAdded: 6000,
      };

      // #when
      const result = addBookmark(POPULATED_TREE, [0], input);

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        const folder = result.data.children[0]! as Folder;
        expect(folder.children).toHaveLength(3);
        const added = folder.children[2]!;
        expect((added as Bookmark).title).toBe('Deep');
      }
    });

    it('returns type_mismatch if parent path points to Bookmark', () => {
      // #given — POPULATED_TREE.children[1] is MOCK_BOOKMARK
      const input: Omit<Bookmark, 'id'> = {
        type: 'bookmark',
        title: 'X',
        url: 'https://x.com',
        dateAdded: 7000,
      };

      // #when
      const result = addBookmark(POPULATED_TREE, [1], input);

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('type_mismatch');
      }
    });

    it('does not mutate original tree', () => {
      // #given
      const frozen = deepFreeze({
        type: 'folder' as const,
        id: 'r',
        name: 'Root',
        children: [
          { type: 'bookmark' as const, id: 'b1', title: 'B1', url: 'https://b1.com', dateAdded: 0 },
        ] as readonly BookmarkNode[],
        dateAdded: 0,
      });
      const originalChildrenRef = frozen.children;
      const input: Omit<Bookmark, 'id'> = {
        type: 'bookmark',
        title: 'New',
        url: 'https://new.com',
        dateAdded: 1,
      };

      // #when
      const result = addBookmark(frozen, [], input);

      // #then
      expect(result.success).toBe(true);
      expect(frozen.children).toBe(originalChildrenRef);
      expect(frozen.children).toHaveLength(1);
    });
  });

  describe('addFolder', () => {
    it('adds folder with generated id and empty children', () => {
      // #given
      const tree = createEmptyTree();

      // #when
      const result = addFolder(tree, [], 'New Folder');

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.children).toHaveLength(1);
        const child = result.data.children[0]!;
        expect(isFolder(child)).toBe(true);
        const folder = child as Folder;
        expect(folder.name).toBe('New Folder');
        expect(folder.id).toBeTruthy();
        expect(folder.children).toEqual([]);
      }
    });
  });

  describe('removeItem', () => {
    it('removes item at path', () => {
      // #when
      const result = removeItem(POPULATED_TREE, [1]);

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.children).toHaveLength(1);
        expect(isFolder(result.data.children[0]!)).toBe(true);
      }
    });

    it('does not mutate original tree', () => {
      // #given
      const originalLength = POPULATED_TREE.children.length;

      // #when
      const result = removeItem(POPULATED_TREE, [1]);

      // #then
      expect(result.success).toBe(true);
      expect(POPULATED_TREE.children).toHaveLength(originalLength);
    });

    it('returns path_not_found for invalid path', () => {
      // #when
      const result = removeItem(POPULATED_TREE, [99]);

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('path_not_found');
      }
    });

    it('cannot remove root (empty path [])', () => {
      // #when
      const result = removeItem(POPULATED_TREE, []);

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('invalid_path');
      }
    });
  });

  describe('updateBookmark', () => {
    it('updates title and url at path', () => {
      // #when
      const result = updateBookmark(POPULATED_TREE, [1], { title: 'Updated', url: 'https://updated.com' });

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        const updated = result.data.children[1]! as Bookmark;
        expect(updated.title).toBe('Updated');
        expect(updated.url).toBe('https://updated.com');
        expect(updated.id).toBe('bm-1');
      }
    });

    it('returns type_mismatch if path points to Folder', () => {
      // #when
      const result = updateBookmark(POPULATED_TREE, [0], { title: 'Bad' });

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('type_mismatch');
      }
    });

    it('does not mutate original tree', () => {
      // #given
      const originalTitle = (POPULATED_TREE.children[1]! as Bookmark).title;

      // #when
      const result = updateBookmark(POPULATED_TREE, [1], { title: 'Changed' });

      // #then
      expect(result.success).toBe(true);
      expect((POPULATED_TREE.children[1]! as Bookmark).title).toBe(originalTitle);
    });
  });

  describe('renameFolder', () => {
    it('renames folder at path', () => {
      // #when
      const result = renameFolder(POPULATED_TREE, [0], 'Renamed');

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        const folder = result.data.children[0]! as Folder;
        expect(folder.name).toBe('Renamed');
        expect(folder.id).toBe('f-1');
      }
    });

    it('renames root when path is empty', () => {
      // #when
      const result = renameFolder(POPULATED_TREE, [], 'New Root');

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('New Root');
        expect(result.data.children).toHaveLength(POPULATED_TREE.children.length);
      }
    });

    it('returns type_mismatch if path points to Bookmark', () => {
      // #when
      const result = renameFolder(POPULATED_TREE, [1], 'Bad');

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('type_mismatch');
      }
    });
  });
});
