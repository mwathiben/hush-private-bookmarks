/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { BookmarkNode, BookmarkTree, Result } from '@/lib/types';
import type { ImportStats } from '@/lib/bookmark-import';
import { ImportError, InvalidPasswordError } from '@/lib/errors';
import { generateId } from '@/lib/data-model';

interface HushBookmark {
  readonly url: string;
  readonly text: string;
  readonly created: string;
}

interface HushFolder {
  readonly id: string;
  readonly title: string;
  readonly bookmarks: readonly HushBookmark[];
}

interface HushExportData {
  readonly key?: string;
  readonly folders?: readonly HushFolder[];
  readonly bookmarks?: readonly HushBookmark[];
}

type HushImportResult = Result<
  { tree: BookmarkTree; stats: ImportStats },
  ImportError | InvalidPasswordError
>;

function isHushExportData(data: unknown): data is HushExportData {
  if (data === null || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if ('folders' in data && Array.isArray(record['folders'])) return true;
  if ('bookmarks' in data && Array.isArray(record['bookmarks'])) return true;
  return false;
}

export async function decryptHushBlob(
  blob: string,
  password: string,
): Promise<HushExportData> {
  let plaintext: string;
  try {
    const sjcl = await import('sjcl');
    plaintext = sjcl.decrypt(password, blob);
  } catch (error: unknown) {
    const message = String(error);
    if (message.includes('CORRUPT')) {
      throw new InvalidPasswordError('Incorrect Hush password', { cause: error });
    }
    throw new ImportError('Failed to decrypt Hush export', { source: 'hush', format: 'sjcl' }, { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new ImportError('Hush export contains invalid data', { source: 'hush', format: 'json' });
  }

  if (!isHushExportData(parsed)) {
    throw new ImportError('Unrecognized Hush export format', { source: 'hush', format: 'unknown' });
  }

  const { key: _key, ...safe } = parsed;
  return safe;
}

function mapBookmarks(bookmarks: readonly HushBookmark[]): BookmarkNode[] {
  const nodes: BookmarkNode[] = [];
  for (const b of bookmarks) {
    if (typeof b.url !== 'string' || b.url === '') continue;
    const ts = Date.parse(b.created);
    nodes.push({
      type: 'bookmark',
      id: generateId(),
      title: b.text || 'Untitled',
      url: b.url,
      dateAdded: Number.isInteger(ts) && ts > 0 ? ts : Date.now(),
    });
  }
  return nodes;
}

export function mapHushToTree(data: HushExportData): BookmarkNode[] {
  if (data.folders) {
    return data.folders
      .filter((f) => f.title !== 'Trash')
      .map((f): BookmarkNode => ({
        type: 'folder',
        id: generateId(),
        name: f.title || 'Unnamed Folder',
        children: mapBookmarks(f.bookmarks),
        dateAdded: Date.now(),
      }));
  }

  if (data.bookmarks) {
    return [{
      type: 'folder',
      id: generateId(),
      name: 'Hush Bookmarks',
      children: mapBookmarks(data.bookmarks),
      dateAdded: Date.now(),
    }];
  }

  return [];
}

function countImportedNodes(
  nodes: readonly BookmarkNode[],
): { bookmarks: number; folders: number } {
  let bookmarks = 0;
  let folders = 0;
  for (const node of nodes) {
    if (node.type === 'bookmark') {
      bookmarks += 1;
    } else {
      folders += 1;
      const sub = countImportedNodes(node.children);
      bookmarks += sub.bookmarks;
      folders += sub.folders;
    }
  }
  return { bookmarks, folders };
}

export async function importHushData(
  blob: string,
  password: string,
): Promise<HushImportResult> {
  let data: HushExportData;
  try {
    data = await decryptHushBlob(blob, password);
  } catch (error: unknown) {
    if (error instanceof InvalidPasswordError) {
      return { success: false, error };
    }
    if (error instanceof ImportError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new ImportError('Unexpected Hush import failure', { source: 'hush' }, { cause: error }),
    };
  }

  const children = mapHushToTree(data);
  const counts = countImportedNodes(children);

  return {
    success: true,
    data: {
      tree: {
        type: 'folder',
        id: generateId(),
        name: 'Hush Import',
        children,
        dateAdded: Date.now(),
      },
      stats: {
        bookmarksImported: counts.bookmarks,
        foldersImported: counts.folders,
        errors: [],
      },
    },
  };
}
