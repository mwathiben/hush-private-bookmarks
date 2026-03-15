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
import type { DataModelErrorContext } from '@/lib/errors';
import { DataModelError } from '@/lib/errors';

export const MAX_TREE_DEPTH = 100;

function fail(
  message: string,
  kind: DataModelErrorContext['kind'],
  path?: readonly number[],
): Result<never, DataModelError> {
  return { success: false, error: new DataModelError(message, { kind, path }) };
}

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
  if (path.length > MAX_TREE_DEPTH) return fail('Path exceeds maximum tree depth', 'invalid_path', path);
  let current: BookmarkNode = tree;
  for (let i = 0; i < path.length; i++) {
    const index = path[i]!;
    if (!Number.isInteger(index) || index < 0) return fail(`Invalid path index at depth ${i}`, 'invalid_path', path);
    if (!isFolder(current)) return fail(`Expected folder at depth ${i}, found bookmark`, 'type_mismatch', path);
    if (index >= current.children.length) return fail(`Index out of bounds at depth ${i}`, 'path_not_found', path);
    current = current.children[index]!;
  }
  return { success: true, data: current };
}

export const getItemByPath: typeof walkPath = walkPath;

export function getFolderByPath(tree: BookmarkTree, path: readonly number[]): Result<Folder, DataModelError> {
  const result = walkPath(tree, path);
  if (!result.success) return result;
  if (!isFolder(result.data)) return fail('Path does not point to a folder', 'type_mismatch', path);
  return { success: true, data: result.data };
}

function searchChildren(
  children: readonly BookmarkNode[], id: string, depth = 0,
): readonly number[] | undefined {
  if (depth > MAX_TREE_DEPTH) return undefined;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.id === id) {
      return [i];
    }
    if (isFolder(child)) {
      const found = searchChildren(child.children, id, depth + 1);
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
    if (index < 0) return fail(`Invalid path index at depth ${i}`, 'invalid_path', parentPath);
    if (!isFolder(current)) return fail(`Expected folder at depth ${i}`, 'type_mismatch', parentPath);
    if (index >= current.children.length) return fail(`Index out of bounds at depth ${i}`, 'path_not_found', parentPath);

    ancestors.push({ folder: current, childIndex: index });
    current = current.children[index]!;
  }

  if (!isFolder(current)) return fail('Target is not a folder', 'type_mismatch', parentPath);
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
  if (path.length === 0) return fail('Cannot remove root', 'invalid_path', path);

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

  if (!isBookmark(targetResult.data)) return fail('Target is not a bookmark', 'type_mismatch', path);

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

  if (!isFolder(targetResult.data)) return fail('Target is not a folder', 'type_mismatch', path);

  const parentPath = path.slice(0, -1);
  const childIndex = path[path.length - 1]!;

  return withReplacedChildren(tree, parentPath, (children) =>
    children.map((c, i) => (i === childIndex ? { ...c, name: newName } : c)),
  );
}

function isDescendantOrSelf(
  ancestor: readonly number[],
  path: readonly number[],
): boolean {
  if (path.length < ancestor.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== path[i]) return false;
  }
  return true;
}

export function moveItem(
  tree: BookmarkTree,
  fromPath: readonly number[],
  toPath: readonly number[],
  toIndex: number,
): Result<BookmarkTree, DataModelError> {
  if (fromPath.length === 0) return fail('Cannot move root', 'invalid_path', fromPath);
  if (isDescendantOrSelf(fromPath, toPath)) return fail('Cannot move into own subtree', 'cycle_detected', fromPath);
  const sourceResult = walkPath(tree, fromPath);
  if (!sourceResult.success) return sourceResult;
  const sourceItem = sourceResult.data;
  const destResult = walkPath(tree, toPath);
  if (!destResult.success) return destResult;
  if (!isFolder(destResult.data)) return fail('Destination is not a folder', 'type_mismatch', toPath);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex > destResult.data.children.length) return fail('toIndex out of bounds', 'invalid_path', toPath);
  const fromParent = fromPath.slice(0, -1);
  const fromIndex = fromPath[fromPath.length - 1]!;
  if (fromParent.length === toPath.length && fromParent.every((v, i) => v === toPath[i])) {
    const adjusted = fromIndex < toIndex ? toIndex - 1 : toIndex;
    return withReplacedChildren(tree, toPath, (children) => {
      const without = children.filter((_, i) => i !== fromIndex);
      return [...without.slice(0, adjusted), sourceItem, ...without.slice(adjusted)];
    });
  }
  const removeResult = withReplacedChildren(tree, fromParent, (children) =>
    children.filter((_, i) => i !== fromIndex),
  );
  if (!removeResult.success) return removeResult;
  let adjustedToPath: readonly number[] = toPath;
  if (toPath.length > fromParent.length && isDescendantOrSelf(fromParent, toPath)
    && fromIndex < toPath[fromParent.length]!) {
    const adj = [...toPath];
    adj[fromParent.length] = toPath[fromParent.length]! - 1;
    adjustedToPath = adj;
  }
  return withReplacedChildren(removeResult.data, adjustedToPath, (children) =>
    [...children.slice(0, toIndex), sourceItem, ...children.slice(toIndex)],
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

  return fail('Item not found in tree', 'path_not_found');
}
function walkNodes(folder: Folder, visit: (node: BookmarkNode) => void, depth = 0): void {
  if (depth > MAX_TREE_DEPTH) return;
  for (const c of folder.children) { visit(c); if (isFolder(c)) walkNodes(c, visit, depth + 1); }
}

export function flattenTree(tree: BookmarkTree): BookmarkNode[] {
  const nodes: BookmarkNode[] = [tree];
  walkNodes(tree, (n) => nodes.push(n));
  return nodes;
}
export function collectAllUrls(tree: BookmarkTree): string[] {
  return flattenTree(tree).filter(isBookmark).map((n) => n.url);
}
export function countBookmarks(tree: BookmarkTree): { bookmarks: number; folders: number } {
  const nodes = flattenTree(tree).slice(1);
  return { bookmarks: nodes.filter(isBookmark).length, folders: nodes.filter(isFolder).length };
}

function normalizeNode(node: BookmarkNode, depth = 0): BookmarkNode {
  if (depth > MAX_TREE_DEPTH) return node;
  const id = typeof node.id === 'string' && node.id !== '' ? node.id : generateId();
  if (isFolder(node)) return { ...node, id, children: node.children.map((c) => normalizeNode(c, depth + 1)) };
  return { ...node, id };
}
export function normalizeTree(tree: BookmarkTree): BookmarkTree {
  const id = typeof tree.id === 'string' && tree.id !== '' ? tree.id : generateId();
  return { ...tree, id, children: tree.children.map((c) => normalizeNode(c, 0)) };
}
