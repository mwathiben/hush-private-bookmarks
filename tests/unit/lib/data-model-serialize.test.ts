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
import type { BookmarkTree } from '@/lib/types';
import {
  createEmptyTree,
  addBookmark,
  addFolder,
  isFolder,
  normalizeTree,
} from '@/lib/data-model';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj as Record<string, unknown>)) {
    deepFreeze(value);
  }
  return obj;
}

function buildPopulatedTree(): BookmarkTree {
  let tree = createEmptyTree();

  const folderResult = addFolder(tree, [], 'Research');
  if (!folderResult.success) throw new Error('addFolder failed');
  tree = folderResult.data;

  const bm1Result = addBookmark(tree, [0], {
    type: 'bookmark',
    title: 'TypeScript Docs',
    url: 'https://typescriptlang.org',
    dateAdded: 1000,
  });
  if (!bm1Result.success) throw new Error('addBookmark failed');
  tree = bm1Result.data;

  const bm2Result = addBookmark(tree, [], {
    type: 'bookmark',
    title: 'Example',
    url: 'https://example.com',
    dateAdded: 2000,
  });
  if (!bm2Result.success) throw new Error('addBookmark failed');
  tree = bm2Result.data;

  return tree;
}

describe('DATAMODEL-005: JSON serialization & normalizeTree', () => {
  describe('JSON roundtrip', () => {
    it('JSON.stringify produces valid JSON that JSON.parse recovers', () => {
      // #given
      const tree = buildPopulatedTree();

      // #when
      const json = JSON.stringify(tree);
      const parsed: unknown = JSON.parse(json);

      // #then
      expect(parsed).toEqual(tree);
    });

    it('serialized tree root is a Folder object with children array', () => {
      // #given
      const tree = buildPopulatedTree();

      // #when
      const parsed = JSON.parse(JSON.stringify(tree)) as Record<string, unknown>;

      // #then
      expect(parsed['type']).toBe('folder');
      expect(Array.isArray(parsed['children'])).toBe(true);
      expect(typeof parsed['name']).toBe('string');
      expect(typeof parsed['id']).toBe('string');
      expect(typeof parsed['dateAdded']).toBe('number');
    });

    it('serialized bookmarks have type, title, url, id, dateAdded', () => {
      // #given
      const tree = buildPopulatedTree();
      const parsed = JSON.parse(JSON.stringify(tree)) as Record<string, unknown>;
      const children = parsed['children'] as Array<Record<string, unknown>>;

      // #when — find first bookmark in children
      const folder = children[0] as Record<string, unknown>;
      const folderChildren = folder['children'] as Array<Record<string, unknown>>;
      const bookmark = folderChildren[0]!;

      // #then
      expect(bookmark['type']).toBe('bookmark');
      expect(typeof bookmark['title']).toBe('string');
      expect(typeof bookmark['url']).toBe('string');
      expect(typeof bookmark['id']).toBe('string');
      expect(typeof bookmark['dateAdded']).toBe('number');
    });

    it('serialized folders have type, name, children, id, dateAdded', () => {
      // #given
      const tree = buildPopulatedTree();
      const parsed = JSON.parse(JSON.stringify(tree)) as Record<string, unknown>;
      const children = parsed['children'] as Array<Record<string, unknown>>;

      // #when
      const folder = children[0]!;

      // #then
      expect(folder['type']).toBe('folder');
      expect(typeof folder['name']).toBe('string');
      expect(Array.isArray(folder['children'])).toBe(true);
      expect(typeof folder['id']).toBe('string');
      expect(typeof folder['dateAdded']).toBe('number');
    });
  });

  describe('normalizeTree', () => {
    it('assigns IDs to items missing id field', () => {
      // #given — legacy Holy PB data without id fields
      const legacyTree = {
        type: 'folder',
        name: 'Root',
        children: [
          { type: 'bookmark', title: 'Legacy BM', url: 'https://legacy.com', dateAdded: 1000 },
          {
            type: 'folder',
            name: 'Sub',
            children: [
              { type: 'bookmark', title: 'Nested', url: 'https://nested.com', dateAdded: 2000, id: '' },
            ],
            dateAdded: 3000,
          },
        ],
        dateAdded: 0,
      } as unknown as BookmarkTree;

      // #when
      const normalized = normalizeTree(legacyTree);

      // #then — all items should have non-empty string IDs
      expect(typeof normalized.id).toBe('string');
      expect(normalized.id.length).toBeGreaterThan(0);

      for (const child of normalized.children) {
        expect(typeof child.id).toBe('string');
        expect(child.id.length).toBeGreaterThan(0);
        if (isFolder(child)) {
          for (const grandchild of child.children) {
            expect(typeof grandchild.id).toBe('string');
            expect(grandchild.id.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('rejects non-string id values from malformed JSON', () => {
      // #given — deserialized JSON can contain null, numbers, booleans as id
      const malformedTree = {
        type: 'folder',
        name: 'Root',
        children: [
          { type: 'bookmark', title: 'Null ID', url: 'https://a.com', dateAdded: 0, id: null },
          { type: 'bookmark', title: 'Numeric ID', url: 'https://b.com', dateAdded: 0, id: 42 },
          { type: 'bookmark', title: 'Boolean ID', url: 'https://c.com', dateAdded: 0, id: false },
        ],
        dateAdded: 0,
        id: null,
      } as unknown as BookmarkTree;

      // #when
      const normalized = normalizeTree(malformedTree);

      // #then — all non-string IDs replaced with valid UUIDs
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(normalized.id).toMatch(uuidRe);
      for (const child of normalized.children) {
        expect(child.id).toMatch(uuidRe);
      }
    });

    it('preserves existing IDs', () => {
      // #given
      const tree = deepFreeze(buildPopulatedTree());
      const originalRootId = tree.id;
      const originalChildIds = tree.children.map((c) => c.id);

      // #when
      const normalized = normalizeTree(tree);

      // #then — all IDs unchanged
      expect(normalized.id).toBe(originalRootId);
      normalized.children.forEach((child, i) => {
        expect(child.id).toBe(originalChildIds[i]);
      });
    });

    it('handles deeply nested tree (10 levels)', () => {
      // #given — build 10-level nested structure without IDs
      let innermost: Record<string, unknown> = {
        type: 'bookmark',
        title: 'Deep',
        url: 'https://deep.com',
        dateAdded: 0,
      };

      for (let i = 9; i >= 0; i--) {
        innermost = {
          type: 'folder',
          name: `Level-${i}`,
          children: [innermost],
          dateAdded: 0,
        };
      }
      const deepTree = innermost as unknown as BookmarkTree;

      // #when
      const normalized = normalizeTree(deepTree);

      // #then — walk all levels, verify IDs assigned
      let current = normalized;
      for (let i = 0; i < 10; i++) {
        expect(typeof current.id).toBe('string');
        expect(current.id.length).toBeGreaterThan(0);
        expect(isFolder(current)).toBe(true);
        if (isFolder(current)) {
          const child = current.children[0]!;
          if (isFolder(child)) {
            current = child;
          } else {
            expect(typeof child.id).toBe('string');
            expect(child.id.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('performance', () => {
    it('1000-bookmark tree roundtrip completes in under 100ms', () => {
      // #given — generate tree with 1000 bookmarks in 10 folders
      const folders: Array<Record<string, unknown>> = [];
      for (let f = 0; f < 10; f++) {
        const bookmarks: Array<Record<string, unknown>> = [];
        for (let b = 0; b < 100; b++) {
          bookmarks.push({
            type: 'bookmark',
            title: `BM-${f}-${b}`,
            url: `https://example.com/${f}/${b}`,
            dateAdded: Date.now(),
          });
        }
        folders.push({
          type: 'folder',
          name: `Folder-${f}`,
          children: bookmarks,
          dateAdded: Date.now(),
        });
      }
      const largeTree = {
        type: 'folder',
        name: 'Root',
        children: folders,
        dateAdded: Date.now(),
      } as unknown as BookmarkTree;

      // #when — full pipeline: serialize, deserialize, normalize
      const start = performance.now();
      const json = JSON.stringify(largeTree);
      const parsed = JSON.parse(json) as BookmarkTree;
      const normalized = normalizeTree(parsed);
      const elapsed = performance.now() - start;

      // #then
      expect(elapsed).toBeLessThan(100);
      expect(isFolder(normalized)).toBe(true);
      expect(normalized.children.length).toBe(10);
      expect(typeof normalized.id).toBe('string');
      expect(normalized.id.length).toBeGreaterThan(0);
    });
  });
});
