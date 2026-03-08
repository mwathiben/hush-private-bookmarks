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

import type { BookmarkNode, BookmarkTree, Result } from '@/lib/types';
import { ImportError } from '@/lib/errors';
import { generateId, MAX_TREE_DEPTH } from '@/lib/data-model';

export interface ChromeBookmarkTreeNode {
  readonly id: string;
  readonly title: string;
  readonly url?: string;
  readonly children?: readonly ChromeBookmarkTreeNode[];
  readonly dateAdded?: number;
  readonly parentId?: string;
  readonly folderType?: string;
}

export interface ImportStats {
  readonly bookmarksImported: number;
  readonly foldersImported: number;
  readonly errors: readonly string[];
}

const ROOT_FOLDER_TYPES = new Set(['bookmarks-bar', 'other', 'mobile']);

function isRootContainer(node: ChromeBookmarkTreeNode): boolean {
  return (node.folderType !== undefined && ROOT_FOLDER_TYPES.has(node.folderType)) || node.parentId === '0';
}

function convertNode(node: ChromeBookmarkTreeNode, depth: number, errors: string[]): BookmarkNode {
  const dateAdded = node.dateAdded ?? Date.now();

  if (typeof node.url === 'string' && node.url !== '') {
    return {
      type: 'bookmark',
      id: generateId(),
      title: node.title || 'Untitled',
      url: node.url,
      dateAdded,
    };
  }

  let children: BookmarkNode[];
  if (depth >= MAX_TREE_DEPTH) {
    const skipped = (node.children ?? []).length;
    if (skipped > 0) {
      errors.push(`Folder "${node.title || 'Unnamed Folder'}" at depth ${depth}: ${skipped} children truncated`);
    }
    children = [];
  } else {
    children = (node.children ?? []).map((c) => convertNode(c, depth + 1, errors));
  }

  return {
    type: 'folder',
    id: generateId(),
    name: node.title || 'Unnamed Folder',
    children,
    dateAdded,
  };
}

function countNodes(node: BookmarkNode): { bookmarks: number; folders: number } {
  if (node.type === 'bookmark') return { bookmarks: 1, folders: 0 };
  let bookmarks = 0;
  let folders = 1;
  for (const child of node.children) {
    const c = countNodes(child);
    bookmarks += c.bookmarks;
    folders += c.folders;
  }
  return { bookmarks, folders };
}

export function convertChromeBookmarks(
  nodes: ChromeBookmarkTreeNode[],
): Result<{ tree: BookmarkTree; stats: ImportStats }, ImportError> {
  if (!Array.isArray(nodes)) {
    return {
      success: false,
      error: new ImportError('Invalid input: expected array of bookmark nodes', {
        source: 'chrome',
        format: 'chrome-api',
      }),
    };
  }

  const importErrors: string[] = [];
  const flattenedChildren: BookmarkNode[] = [];
  for (const root of nodes) {
    const containers = root.children ?? [root];
    for (const container of containers) {
      if (isRootContainer(container)) {
        for (const child of container.children ?? []) {
          flattenedChildren.push(convertNode(child, 0, importErrors));
        }
      } else {
        flattenedChildren.push(convertNode(container, 0, importErrors));
      }
    }
  }

  let bookmarks = 0;
  let folders = 0;
  for (const child of flattenedChildren) {
    const c = countNodes(child);
    bookmarks += c.bookmarks;
    folders += c.folders;
  }

  const tree: BookmarkTree = {
    type: 'folder',
    id: generateId(),
    name: 'Imported',
    children: flattenedChildren,
    dateAdded: Date.now(),
  };

  return {
    success: true,
    data: {
      tree,
      stats: { bookmarksImported: bookmarks, foldersImported: folders, errors: importErrors },
    },
  };
}
