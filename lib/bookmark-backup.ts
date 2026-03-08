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

import type { BookmarkTree, EncryptedStore, Result } from '@/lib/types';
import { ImportError, InvalidPasswordError } from '@/lib/errors';
import { encrypt, decrypt } from '@/lib/crypto';
import { MAX_TREE_DEPTH } from '@/lib/data-model';

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

function isValidNode(data: unknown, depth: number): boolean {
  if (depth > MAX_TREE_DEPTH) return false;
  if (data === null || typeof data !== 'object') return false;
  if (!('type' in data) || !('id' in data) || !('dateAdded' in data)) return false;
  if (typeof data.id !== 'string' || data.id === '') return false;
  if (typeof data.dateAdded !== 'number' || !Number.isFinite(data.dateAdded) || data.dateAdded < 0) return false;

  if (data.type === 'bookmark') {
    return 'title' in data && typeof data.title === 'string' && data.title !== '' &&
      'url' in data && typeof data.url === 'string' && data.url !== '';
  }

  if (data.type === 'folder') {
    if (!('name' in data) || typeof data.name !== 'string' || data.name === '') return false;
    if (!('children' in data) || !Array.isArray(data.children)) return false;
    return data.children.every((child: unknown) => isValidNode(child, depth + 1));
  }

  return false;
}

function isValidBookmarkTree(data: unknown): data is BookmarkTree {
  if (data === null || typeof data !== 'object') return false;
  if (!('type' in data) || data.type !== 'folder') return false;
  return isValidNode(data, 0);
}

type BackupResult = Result<BookmarkTree, ImportError | InvalidPasswordError>;

function backupFail(message: string, options?: ErrorOptions): BackupResult {
  return { success: false, error: new ImportError(message, { source: 'backup', format: 'hush-backup' }, options) };
}

export async function exportEncryptedBackup(
  tree: BookmarkTree,
  password: string,
): Promise<string> {
  const store = await encrypt(JSON.stringify(tree), password);
  return JSON.stringify({ version: BACKUP_VERSION, store });
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
    return backupFail('Backup decryption failed', { cause: error });
  }

  let tree: unknown;
  try {
    tree = JSON.parse(plaintext);
  } catch {
    return backupFail('Invalid backup: corrupted data');
  }

  if (!isValidBookmarkTree(tree)) {
    return backupFail('Invalid backup: corrupted data');
  }

  return { success: true, data: tree };
}
