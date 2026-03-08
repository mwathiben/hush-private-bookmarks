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
import type { Bookmark, BookmarkTree, Folder } from '@/lib/types';
import { DataModelError } from '@/lib/errors';
import {
  createEmptyTree,
  findItemPath,
  generateId,
  getItemByPath,
  isBookmark,
  isFolder,
  MAX_TREE_DEPTH,
} from '@/lib/data-model';

const MOCK_BOOKMARK: Bookmark = {
  type: 'bookmark',
  id: 'bm-1',
  title: 'Example',
  url: 'https://example.com',
  dateAdded: 1000,
};

const MOCK_FOLDER: Folder = {
  type: 'folder',
  id: 'f-1',
  name: 'Folder One',
  children: [
    { type: 'bookmark', id: 'bm-nested', title: 'Nested', url: 'https://nested.com', dateAdded: 2000 },
    { type: 'bookmark', id: 'bm-second', title: 'Second', url: 'https://second.com', dateAdded: 3000 },
  ],
  dateAdded: 1000,
};

const POPULATED_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [MOCK_FOLDER, MOCK_BOOKMARK],
  dateAdded: 0,
};

describe('DATAMODEL-001: Core reads', () => {
  describe('createEmptyTree', () => {
    it('returns a Folder with empty children', () => {
      // #given — no input needed

      // #when
      const tree = createEmptyTree();

      // #then
      expect(tree.type).toBe('folder');
      expect(tree.name).toBe('Root');
      expect(tree.children).toEqual([]);
      expect(tree.id).toBeTruthy();
      expect(typeof tree.id).toBe('string');
    });

    it('result is a valid BookmarkTree with all Folder fields', () => {
      // #when
      const tree = createEmptyTree();

      // #then
      expect(tree).toHaveProperty('type');
      expect(tree).toHaveProperty('id');
      expect(tree).toHaveProperty('name');
      expect(tree).toHaveProperty('children');
      expect(tree).toHaveProperty('dateAdded');
      expect(typeof tree.dateAdded).toBe('number');
      expect(tree.dateAdded).toBeGreaterThan(0);
    });
  });

  describe('getItemByPath', () => {
    it('returns root Folder for empty path []', () => {
      // #when
      const result = getItemByPath(POPULATED_TREE, []);

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(POPULATED_TREE);
      }
    });

    it('returns first child for path [0]', () => {
      // #when
      const result = getItemByPath(POPULATED_TREE, [0]);

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(POPULATED_TREE.children[0]);
      }
    });

    it('returns nested item for path [0, 1]', () => {
      // #when
      const result = getItemByPath(POPULATED_TREE, [0, 1]);

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(MOCK_FOLDER.children[1]);
      }
    });

    it('returns path_not_found for out-of-bounds index', () => {
      // #when
      const result = getItemByPath(POPULATED_TREE, [99]);

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('path_not_found');
      }
    });

    it('returns type_mismatch when path tries to descend into a Bookmark', () => {
      // #given — POPULATED_TREE.children[1] is MOCK_BOOKMARK (not a Folder)

      // #when
      const result = getItemByPath(POPULATED_TREE, [1, 0]);

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('type_mismatch');
      }
    });

    it('returns invalid_path for negative index', () => {
      // #when
      const result = getItemByPath(POPULATED_TREE, [-1]);

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('invalid_path');
      }
    });
  });

  describe('findItemPath', () => {
    it('returns empty path when searching for root id', () => {
      // #when
      const result = findItemPath(POPULATED_TREE, 'root');

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('finds item by id and returns its path', () => {
      // #when
      const result = findItemPath(POPULATED_TREE, 'bm-nested');

      // #then
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([0, 0]);
      }
    });

    it('returns path_not_found for non-existent id', () => {
      // #when
      const result = findItemPath(POPULATED_TREE, 'nonexistent');

      // #then
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DataModelError);
        expect(result.error.context.kind).toBe('path_not_found');
      }
    });

    it('returns path_not_found for items beyond MAX_TREE_DEPTH', () => {
      // #given — build tree deeper than MAX_TREE_DEPTH
      type MutableFolder = { type: 'folder'; id: string; name: string; children: MutableFolder[]; dateAdded: number };
      const root: MutableFolder = { type: 'folder', id: 'root', name: 'Root', children: [], dateAdded: 0 };
      let current = root;
      for (let i = 0; i < MAX_TREE_DEPTH + 5; i++) {
        const child: MutableFolder = { type: 'folder', id: `f-${i}`, name: `F${i}`, children: [], dateAdded: 0 };
        current.children = [child];
        current = child;
      }
      current.children = [{ type: 'folder', id: 'deep-target', name: 'Deep', children: [], dateAdded: 0 }];

      // #when
      const result = findItemPath(root as BookmarkTree, 'deep-target');

      // #then — item beyond depth limit is unreachable
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.context.kind).toBe('path_not_found');
    });
  });

  describe('type guards', () => {
    it('isBookmark returns true for Bookmark nodes and false for Folder nodes', () => {
      expect(isBookmark(MOCK_BOOKMARK)).toBe(true);
      expect(isBookmark(MOCK_FOLDER)).toBe(false);
    });

    it('isFolder returns true for Folder nodes and false for Bookmark nodes', () => {
      expect(isFolder(MOCK_FOLDER)).toBe(true);
      expect(isFolder(MOCK_BOOKMARK)).toBe(false);
    });
  });

  describe('generateId', () => {
    it('returns non-empty unique strings matching UUID format', () => {
      // #given
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const ids = new Set<string>();

      // #when
      for (let i = 0; i < 10; i++) {
        ids.add(generateId());
      }

      // #then
      expect(ids.size).toBe(10);
      for (const id of ids) {
        expect(id).toMatch(uuidRegex);
      }
    });
  });
});
