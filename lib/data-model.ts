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
