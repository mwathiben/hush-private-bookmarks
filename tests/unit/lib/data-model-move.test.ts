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
import { moveItem } from '@/lib/data-model';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj as Record<string, unknown>)) {
    deepFreeze(value);
  }
  return obj;
}

const FOLDER_B: Folder = {
  type: 'folder',
  id: 'f-b',
  name: 'Folder B',
  children: [
    { type: 'bookmark', id: 'bm-deep', title: 'Deep', url: 'https://deep.com', dateAdded: 400 },
  ],
  dateAdded: 200,
};

const FOLDER_A: Folder = {
  type: 'folder',
  id: 'f-a',
  name: 'Folder A',
  children: [
    FOLDER_B,
    { type: 'bookmark', id: 'bm-a1', title: 'A1', url: 'https://a1.com', dateAdded: 300 },
  ],
  dateAdded: 100,
};

const FOLDER_C: Folder = {
  type: 'folder',
  id: 'f-c',
  name: 'Folder C',
  children: [],
  dateAdded: 100,
};

const BM_ROOT: Bookmark = {
  type: 'bookmark',
  id: 'bm-root',
  title: 'Root BM',
  url: 'https://root.com',
  dateAdded: 500,
};

const MOVE_TREE: BookmarkTree = deepFreeze({
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [FOLDER_A, FOLDER_C, BM_ROOT],
  dateAdded: 0,
});

describe('DATAMODEL-003: moveItem with cycle detection', () => {
  it('moves bookmark from one folder to another', () => {
    // #given — bm-a1 is at [0, 1], Folder C is at [1]

    // #when
    const result = moveItem(MOVE_TREE, [0, 1], [1], 0);

    // #then
    expect(result.success).toBe(true);
    if (result.success) {
      const folderA = result.data.children[0]! as Folder;
      expect(folderA.children).toHaveLength(1);
      expect(folderA.children[0]!.id).toBe('f-b');

      const folderC = result.data.children[1]! as Folder;
      expect(folderC.children).toHaveLength(1);
      expect(folderC.children[0]!.id).toBe('bm-a1');
    }
  });

  it('reorders within same folder', () => {
    // #given — root children: [Folder A, Folder C, BM_ROOT]

    // #when — move Folder A (index 0) to index 2 within root
    const result = moveItem(MOVE_TREE, [0], [], 2);

    // #then — root children should be: [Folder C, Folder A, BM_ROOT]
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children).toHaveLength(3);
      expect(result.data.children[0]!.id).toBe('f-c');
      expect(result.data.children[1]!.id).toBe('f-a');
      expect(result.data.children[2]!.id).toBe('bm-root');
    }
  });

  it('returns cycle_detected when moving folder into itself', () => {
    // #given — Folder A is at [0]

    // #when — try to move Folder A into itself
    const result = moveItem(MOVE_TREE, [0], [0], 0);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DataModelError);
      expect(result.error.context.kind).toBe('cycle_detected');
    }
  });

  it('returns cycle_detected when moving folder into own descendant', () => {
    // #given — Folder A is at [0], Folder B is at [0, 0] (inside A)

    // #when — try to move Folder A into Folder B
    const result = moveItem(MOVE_TREE, [0], [0, 0], 0);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DataModelError);
      expect(result.error.context.kind).toBe('cycle_detected');
    }
  });

  it('does not mutate original tree', () => {
    // #given
    const originalChildren = MOVE_TREE.children;
    const originalLength = MOVE_TREE.children.length;

    // #when
    const result = moveItem(MOVE_TREE, [0, 1], [1], 0);

    // #then
    expect(result.success).toBe(true);
    expect(MOVE_TREE.children).toBe(originalChildren);
    expect(MOVE_TREE.children).toHaveLength(originalLength);
  });

  it('returns path_not_found for invalid source path', () => {
    // #when
    const result = moveItem(MOVE_TREE, [99], [1], 0);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DataModelError);
      expect(result.error.context.kind).toBe('path_not_found');
    }
  });

  it('returns path_not_found for invalid destination path', () => {
    // #when
    const result = moveItem(MOVE_TREE, [2], [99], 0);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DataModelError);
      expect(result.error.context.kind).toBe('path_not_found');
    }
  });

  it('adjusts destination path when removal shifts sibling indices', () => {
    // #given — Folder A at [0], Folder C at [1]; move Folder A INTO Folder C
    // After removing [0] from root, Folder C shifts from index 1 to 0

    // #when
    const result = moveItem(MOVE_TREE, [0], [1], 0);

    // #then
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children).toHaveLength(2);
      expect(result.data.children[0]!.id).toBe('f-c');
      const folderC = result.data.children[0]! as Folder;
      expect(folderC.children).toHaveLength(1);
      expect(folderC.children[0]!.id).toBe('f-a');
      expect(result.data.children[1]!.id).toBe('bm-root');
    }
  });

  it('returns type_mismatch when destination is a bookmark', () => {
    // #given — BM_ROOT is at [2], which is a bookmark (not a folder)

    // #when
    const result = moveItem(MOVE_TREE, [0], [2], 0);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DataModelError);
      expect(result.error.context.kind).toBe('type_mismatch');
    }
  });

  it('returns invalid_path when toIndex is out of bounds', () => {
    // #when — Folder C at [1] has 0 children, toIndex 5 is out of bounds
    const result = moveItem(MOVE_TREE, [2], [1], 5);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DataModelError);
      expect(result.error.context.kind).toBe('invalid_path');
    }
  });

  it('cannot move root (empty path [])', () => {
    // #when
    const result = moveItem(MOVE_TREE, [], [1], 0);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(DataModelError);
      expect(result.error.context.kind).toBe('invalid_path');
    }
  });
});
