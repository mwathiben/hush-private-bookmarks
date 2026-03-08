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

import type { BookmarkNode, BookmarkTree, EncryptedStore, Result } from '@/lib/types';
import { ImportError, InvalidPasswordError } from '@/lib/errors';
import { encrypt, decrypt } from '@/lib/crypto';
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

type ImportResult = Result<{ tree: BookmarkTree; stats: ImportStats }, ImportError>;

function importFail(message: string, source: string, format: string): ImportResult {
  return { success: false, error: new ImportError(message, { source, format }) };
}

function importSuccess(children: BookmarkNode[], errors: readonly string[]): ImportResult {
  let bookmarks = 0;
  let folders = 0;
  for (const child of children) {
    const c = countNodes(child);
    bookmarks += c.bookmarks;
    folders += c.folders;
  }
  return {
    success: true,
    data: {
      tree: { type: 'folder', id: generateId(), name: 'Imported', children, dateAdded: Date.now() },
      stats: { bookmarksImported: bookmarks, foldersImported: folders, errors },
    },
  };
}

const ROOT_FOLDER_TYPES = new Set(['bookmarks-bar', 'other', 'mobile']);

function isRootContainer(node: ChromeBookmarkTreeNode): boolean {
  return (node.folderType !== undefined && ROOT_FOLDER_TYPES.has(node.folderType)) || node.parentId === '0';
}

function convertNode(node: ChromeBookmarkTreeNode, depth: number, errors: string[]): BookmarkNode {
  const dateAdded = node.dateAdded ?? Date.now();

  if (typeof node.url === 'string' && node.url !== '') {
    return { type: 'bookmark', id: generateId(), title: node.title || 'Untitled', url: node.url, dateAdded };
  }

  let children: BookmarkNode[];
  if (depth >= MAX_TREE_DEPTH) {
    const skipped = (node.children ?? []).length;
    if (skipped > 0) {
      errors.push(`Folder at depth ${depth}: ${skipped} children truncated`);
    }
    children = [];
  } else {
    children = (node.children ?? []).map((c) => convertNode(c, depth + 1, errors));
  }

  return { type: 'folder', id: generateId(), name: node.title || 'Unnamed Folder', children, dateAdded };
}

function countNodes(node: BookmarkNode, depth: number = 0): { bookmarks: number; folders: number } {
  if (depth > MAX_TREE_DEPTH) return { bookmarks: 0, folders: 0 };
  if (node.type === 'bookmark') return { bookmarks: 1, folders: 0 };
  let bookmarks = 0;
  let folders = 1;
  for (const child of node.children) {
    const c = countNodes(child, depth + 1);
    bookmarks += c.bookmarks;
    folders += c.folders;
  }
  return { bookmarks, folders };
}

export function convertChromeBookmarks(nodes: ChromeBookmarkTreeNode[]): ImportResult {
  if (!Array.isArray(nodes)) {
    return importFail('Invalid input: expected array of bookmark nodes', 'chrome', 'chrome-api');
  }

  const errors: string[] = [];
  const flattenedChildren: BookmarkNode[] = [];
  for (const root of nodes) {
    const containers = root.children ?? [root];
    for (const container of containers) {
      if (isRootContainer(container)) {
        for (const child of container.children ?? []) {
          flattenedChildren.push(convertNode(child, 0, errors));
        }
      } else {
        flattenedChildren.push(convertNode(container, 0, errors));
      }
    }
  }

  return importSuccess(flattenedChildren, errors);
}

const MAX_HTML_SIZE = 5 * 1024 * 1024;
const SECONDS_THRESHOLD = 1e10;

function parseAddDate(raw: string | null): number {
  if (!raw) return Date.now();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return n > SECONDS_THRESHOLD ? n : n * 1000;
}

function walkDl(dl: Element, depth: number, errors: string[]): BookmarkNode[] {
  const nodes: BookmarkNode[] = [];
  for (let i = 0; i < dl.children.length; i++) {
    const dt = dl.children[i]!;
    if (dt.tagName !== 'DT') continue;

    const anchor = dt.querySelector(':scope > a');
    const href = anchor?.getAttribute('href');
    if (anchor && href) {
      nodes.push({
        type: 'bookmark',
        id: generateId(),
        title: anchor.textContent?.trim() || 'Untitled',
        url: href,
        dateAdded: parseAddDate(anchor.getAttribute('add_date')),
      });
      continue;
    }

    const heading = dt.querySelector(':scope > h3');
    if (heading) {
      const childDl = dt.querySelector(':scope > dl');
      let children: BookmarkNode[] = [];
      if (depth >= MAX_TREE_DEPTH) {
        const skipped = childDl ? childDl.querySelectorAll(':scope > dt').length : 0;
        if (skipped > 0) {
          errors.push(`Folder at depth ${depth}: ${skipped} children truncated`);
        }
      } else if (childDl) {
        children = walkDl(childDl, depth + 1, errors);
      }
      nodes.push({
        type: 'folder',
        id: generateId(),
        name: heading.textContent?.trim() || 'Unnamed Folder',
        children,
        dateAdded: parseAddDate(heading.getAttribute('add_date')),
      });
    }
  }
  return nodes;
}

export function parseHtmlBookmarks(html: string): ImportResult {
  if (typeof html !== 'string' || html.length === 0) {
    return importFail('Invalid input: expected non-empty HTML string', 'html', 'netscape-html');
  }
  if (html.length > MAX_HTML_SIZE) {
    return importFail('HTML file exceeds 5MB size limit', 'html', 'netscape-html');
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rootDl = doc.querySelector('dl');
  if (!rootDl) {
    return importFail('No bookmark structure found in HTML', 'html', 'netscape-html');
  }

  const errors: string[] = [];
  return importSuccess(walkDl(rootDl, 0, errors), errors);
}

export const BACKUP_VERSION = 1;

const MAX_BACKUP_SIZE = 50 * 1024 * 1024;

interface BackupEnvelope {
  readonly version: number;
  readonly store: EncryptedStore;
}

function isValidEnvelope(data: unknown): data is BackupEnvelope {
  if (data === null || typeof data !== 'object') return false;
  if (!('version' in data) || typeof data.version !== 'number') return false;
  if (!('store' in data) || data.store === null || typeof data.store !== 'object') return false;
  const s = data.store;
  return (
    'salt' in s && typeof s.salt === 'string' && s.salt !== '' &&
    'iv' in s && typeof s.iv === 'string' && s.iv !== '' &&
    'encrypted' in s && typeof s.encrypted === 'string' && s.encrypted !== '' &&
    'iterations' in s && typeof s.iterations === 'number' && Number.isFinite(s.iterations) && s.iterations > 0
  );
}

export async function exportEncryptedBackup(
  tree: BookmarkTree,
  password: string,
): Promise<string> {
  const store = await encrypt(JSON.stringify(tree), password);
  return JSON.stringify({ version: BACKUP_VERSION, store });
}

type BackupResult = Result<BookmarkTree, ImportError | InvalidPasswordError>;

function backupFail(message: string): BackupResult {
  return { success: false, error: new ImportError(message, { source: 'backup', format: 'hush-backup' }) };
}

export async function importEncryptedBackup(
  blob: string,
  password: string,
): Promise<BackupResult> {
  if (typeof blob !== 'string' || blob.length === 0) {
    return backupFail('Invalid backup: expected non-empty string');
  }
  if (blob.length > MAX_BACKUP_SIZE) {
    return backupFail('Backup file exceeds 50MB size limit');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    return backupFail('Invalid backup: not valid JSON');
  }

  if (!isValidEnvelope(parsed)) {
    return backupFail('Invalid backup format');
  }
  if (parsed.version !== BACKUP_VERSION) {
    return backupFail('Unsupported backup version');
  }

  let plaintext: string;
  try {
    plaintext = await decrypt(parsed.store, password);
  } catch (error: unknown) {
    if (error instanceof InvalidPasswordError) {
      return { success: false, error };
    }
    return backupFail('Backup decryption failed');
  }

  let tree: unknown;
  try {
    tree = JSON.parse(plaintext);
  } catch {
    return backupFail('Invalid backup: corrupted data');
  }

  if (tree === null || typeof tree !== 'object' || !('type' in tree) || tree.type !== 'folder') {
    return backupFail('Invalid backup: corrupted data');
  }

  return { success: true, data: tree as BookmarkTree };
}
