/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * Derived from Holy Private Bookmarks (GPL-3.0)
 * Copyright (C) 2026 OSV-IT-Studio
 * Source: https://github.com/OSV-IT-Studio/holy-private-bookmarks
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Bookmark, BookmarkNode, BookmarkTree, Folder, Result } from '@/lib/types';
import { DataModelError } from '@/lib/errors';

export function isBookmark(node: BookmarkNode): node is Bookmark {
  return node.type === 'bookmark';
}

export function isFolder(node: BookmarkNode): node is Folder {
  return node.type === 'folder';
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function createEmptyTree(): BookmarkTree {
  return {
    type: 'folder',
    id: generateId(),
    name: 'Root',
    children: [],
    dateAdded: Date.now(),
  };
}

function walkPath(
  tree: BookmarkTree,
  path: readonly number[],
): Result<BookmarkNode, DataModelError> {
  if (path.length === 0) {
    return { success: true, data: tree };
  }

  let current: BookmarkNode = tree;

  for (let i = 0; i < path.length; i++) {
    const index = path[i]!;

    if (index < 0) {
      return {
        success: false,
        error: new DataModelError(
          `Invalid path index ${index} at depth ${i}`,
          { kind: 'invalid_path', path },
        ),
      };
    }

    if (!isFolder(current)) {
      return {
        success: false,
        error: new DataModelError(
          `Expected folder at depth ${i}, found bookmark`,
          { kind: 'type_mismatch', path },
        ),
      };
    }

    if (index >= current.children.length) {
      return {
        success: false,
        error: new DataModelError(
          `Index ${index} out of bounds at depth ${i} (${current.children.length} children)`,
          { kind: 'path_not_found', path },
        ),
      };
    }

    current = current.children[index]!;
  }

  return { success: true, data: current };
}

export function getItemByPath(
  tree: BookmarkTree,
  path: readonly number[],
): Result<BookmarkNode, DataModelError> {
  return walkPath(tree, path);
}

function searchChildren(
  children: readonly BookmarkNode[],
  id: string,
): readonly number[] | undefined {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.id === id) {
      return [i];
    }
    if (isFolder(child)) {
      const found = searchChildren(child.children, id);
      if (found !== undefined) {
        return [i, ...found];
      }
    }
  }
  return undefined;
}

function withReplacedChildren(
  tree: BookmarkTree,
  parentPath: readonly number[],
  replacer: (children: readonly BookmarkNode[]) => readonly BookmarkNode[],
): Result<BookmarkTree, DataModelError> {
  if (parentPath.length === 0) {
    return { success: true, data: { ...tree, children: replacer(tree.children) } };
  }

  const ancestors: Array<{ folder: Folder; childIndex: number }> = [];
  let current: BookmarkNode = tree;

  for (let i = 0; i < parentPath.length; i++) {
    const index = parentPath[i]!;

    if (index < 0) {
      return {
        success: false,
        error: new DataModelError(`Invalid path index at depth ${i}`, { kind: 'invalid_path', path: parentPath }),
      };
    }

    if (!isFolder(current)) {
      return {
        success: false,
        error: new DataModelError(`Expected folder at depth ${i}`, { kind: 'type_mismatch', path: parentPath }),
      };
    }

    if (index >= current.children.length) {
      return {
        success: false,
        error: new DataModelError(`Index out of bounds at depth ${i}`, { kind: 'path_not_found', path: parentPath }),
      };
    }

    ancestors.push({ folder: current, childIndex: index });
    current = current.children[index]!;
  }

  if (!isFolder(current)) {
    return {
      success: false,
      error: new DataModelError('Target is not a folder', { kind: 'type_mismatch', path: parentPath }),
    };
  }

  let rebuilt: Folder = { ...current, children: replacer(current.children) };

  for (let i = ancestors.length - 1; i >= 0; i--) {
    const { folder, childIndex } = ancestors[i]!;
    const newChildren: BookmarkNode[] = [...folder.children];
    newChildren[childIndex] = rebuilt;
    rebuilt = { ...folder, children: newChildren };
  }

  return { success: true, data: rebuilt };
}

export function addBookmark(
  tree: BookmarkTree,
  parentPath: readonly number[],
  bookmark: Omit<Bookmark, 'id'>,
): Result<BookmarkTree, DataModelError> {
  const fullBookmark: Bookmark = { ...bookmark, id: generateId() };
  return withReplacedChildren(tree, parentPath, (children) => [...children, fullBookmark]);
}

export function addFolder(
  tree: BookmarkTree,
  parentPath: readonly number[],
  name: string,
): Result<BookmarkTree, DataModelError> {
  const newFolder: Folder = {
    type: 'folder',
    id: generateId(),
    name,
    children: [],
    dateAdded: Date.now(),
  };
  return withReplacedChildren(tree, parentPath, (children) => [...children, newFolder]);
}

export function removeItem(
  tree: BookmarkTree,
  path: readonly number[],
): Result<BookmarkTree, DataModelError> {
  if (path.length === 0) {
    return {
      success: false,
      error: new DataModelError('Cannot remove root', { kind: 'invalid_path', path }),
    };
  }

  const targetResult = walkPath(tree, path);
  if (!targetResult.success) return targetResult;

  const parentPath = path.slice(0, -1);
  const childIndex = path[path.length - 1]!;

  return withReplacedChildren(tree, parentPath, (children) =>
    children.filter((_, i) => i !== childIndex),
  );
}

export function updateBookmark(
  tree: BookmarkTree,
  path: readonly number[],
  updates: Partial<Pick<Bookmark, 'title' | 'url'>>,
): Result<BookmarkTree, DataModelError> {
  const targetResult = walkPath(tree, path);
  if (!targetResult.success) return targetResult;

  if (!isBookmark(targetResult.data)) {
    return {
      success: false,
      error: new DataModelError('Target is not a bookmark', { kind: 'type_mismatch', path }),
    };
  }

  const parentPath = path.slice(0, -1);
  const childIndex = path[path.length - 1]!;

  return withReplacedChildren(tree, parentPath, (children) =>
    children.map((c, i) => (i === childIndex ? { ...c, ...updates } : c)),
  );
}

export function renameFolder(
  tree: BookmarkTree,
  path: readonly number[],
  newName: string,
): Result<BookmarkTree, DataModelError> {
  if (path.length === 0) {
    return { success: true, data: { ...tree, name: newName } };
  }

  const targetResult = walkPath(tree, path);
  if (!targetResult.success) return targetResult;

  if (!isFolder(targetResult.data)) {
    return {
      success: false,
      error: new DataModelError('Target is not a folder', { kind: 'type_mismatch', path }),
    };
  }

  const parentPath = path.slice(0, -1);
  const childIndex = path[path.length - 1]!;

  return withReplacedChildren(tree, parentPath, (children) =>
    children.map((c, i) => (i === childIndex ? { ...c, name: newName } : c)),
  );
}

export function findItemPath(
  tree: BookmarkTree,
  id: string,
): Result<readonly number[], DataModelError> {
  if (tree.id === id) {
    return { success: true, data: [] };
  }

  const path = searchChildren(tree.children, id);
  if (path !== undefined) {
    return { success: true, data: path };
  }

  return {
    success: false,
    error: new DataModelError(
      'Item not found in tree',
      { kind: 'path_not_found' },
    ),
  };
}
