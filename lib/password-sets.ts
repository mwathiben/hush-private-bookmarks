/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { browser } from 'wxt/browser';

import type { PasswordSetInfo, PasswordSetManifest, Result } from '@/lib/types';
import type { StorageErrorContext } from '@/lib/errors';
import { DecryptionError, InvalidPasswordError, StorageError } from '@/lib/errors';
import { encrypt, decrypt } from '@/lib/crypto';
import { generateId } from '@/lib/data-model';
import { STORAGE_KEY, validateEncryptedStore } from '@/lib/storage';

export const MANIFEST_KEY = 'hush_manifest';
export const MANIFEST_VERSION = 1;

export function setStorageKey(id: string, isDefault: boolean): string {
  if (isDefault) return STORAGE_KEY;
  return `hush_set_${id}`;
}

function isValidSetInfo(data: unknown): boolean {
  if (data === null || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  const id = obj['id'];
  const name = obj['name'];
  const createdAt = obj['createdAt'];
  const lastAccessedAt = obj['lastAccessedAt'];
  const isDefault = obj['isDefault'];
  return (
    typeof id === 'string' && id !== '' &&
    typeof name === 'string' && name !== '' &&
    typeof createdAt === 'number' && Number.isInteger(createdAt) &&
    typeof lastAccessedAt === 'number' && Number.isInteger(lastAccessedAt) &&
    typeof isDefault === 'boolean'
  );
}

export function validateManifest(data: unknown): data is PasswordSetManifest {
  if (data === null || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  const version = obj['version'];
  const activeSetId = obj['activeSetId'];
  const sets = obj['sets'];
  if (typeof version !== 'number' || !Number.isInteger(version)) return false;
  if (typeof activeSetId !== 'string' || activeSetId === '') return false;
  if (!Array.isArray(sets)) return false;
  for (const set of sets) {
    if (!isValidSetInfo(set)) return false;
  }
  const hasActiveSet = sets.some(
    (s: Record<string, unknown>) => s['id'] === activeSetId,
  );
  return hasActiveSet;
}

function createDefaultManifest(): PasswordSetManifest {
  const now = Date.now();
  const id = generateId();
  const defaultSet: PasswordSetInfo = {
    id,
    name: 'Default',
    createdAt: now,
    lastAccessedAt: now,
    isDefault: true,
  };
  return { sets: [defaultSet], activeSetId: id, version: MANIFEST_VERSION };
}

function fail(
  message: string,
  context: StorageErrorContext,
  options?: ErrorOptions,
): Result<never, StorageError> {
  return {
    success: false,
    error: new StorageError(message, { key: MANIFEST_KEY, ...context }, options),
  };
}

async function saveManifest(
  manifest: PasswordSetManifest,
): Promise<Result<void, StorageError>> {
  try {
    await browser.storage.local.set({ [MANIFEST_KEY]: manifest });
    return { success: true, data: undefined };
  } catch {
    return fail('Failed to write manifest', { operation: 'write', reason: 'write_failed' },
      { cause: new Error('Storage write failed') });
  }
}

export async function loadManifest(): Promise<Result<PasswordSetManifest, StorageError>> {
  let raw: Record<string, unknown>;
  try {
    raw = await browser.storage.local.get(MANIFEST_KEY);
  } catch {
    return fail('Failed to read manifest', { operation: 'read', reason: 'read_failed' },
      { cause: new Error('Storage read failed') });
  }

  const stored = raw[MANIFEST_KEY];
  if (stored == null) {
    const manifest = createDefaultManifest();
    const saveResult = await saveManifest(manifest);
    if (!saveResult.success) return saveResult;
    return { success: true, data: manifest };
  }

  if (!validateManifest(stored)) {
    return fail('Manifest data is corrupted', { operation: 'read', reason: 'corrupted' });
  }

  return { success: true, data: stored };
}

function isNameValid(name: string): boolean {
  return name.trim() !== '';
}

export async function createSet(
  name: string,
): Promise<Result<PasswordSetInfo, StorageError>> {
  if (!isNameValid(name)) {
    return fail('Set name cannot be empty', { operation: 'write', reason: 'write_failed' });
  }

  const manifestResult = await loadManifest();
  if (!manifestResult.success) return manifestResult;

  const now = Date.now();
  const newSet: PasswordSetInfo = {
    id: generateId(),
    name,
    createdAt: now,
    lastAccessedAt: now,
    isDefault: false,
  };

  const updated: PasswordSetManifest = {
    ...manifestResult.data,
    sets: [...manifestResult.data.sets, newSet],
  };

  const saveResult = await saveManifest(updated);
  if (!saveResult.success) return saveResult;
  return { success: true, data: newSet };
}

export async function listSets(): Promise<Result<readonly PasswordSetInfo[], StorageError>> {
  const manifestResult = await loadManifest();
  if (!manifestResult.success) return manifestResult;
  return { success: true, data: manifestResult.data.sets };
}

export async function deleteSet(
  id: string,
): Promise<Result<void, StorageError>> {
  const manifestResult = await loadManifest();
  if (!manifestResult.success) return manifestResult;

  const target = manifestResult.data.sets.find(s => s.id === id);
  if (!target) {
    return fail('Set not found', { operation: 'read', reason: 'not_found' });
  }
  if (target.isDefault) {
    return fail('Cannot delete the default set', { operation: 'delete', reason: 'write_failed' });
  }

  const defaultSet = manifestResult.data.sets.find(s => s.isDefault);
  const newActiveSetId = manifestResult.data.activeSetId === id
    ? defaultSet!.id
    : manifestResult.data.activeSetId;

  const updated: PasswordSetManifest = {
    ...manifestResult.data,
    sets: manifestResult.data.sets.filter(s => s.id !== id),
    activeSetId: newActiveSetId,
  };

  const saveResult = await saveManifest(updated);
  if (!saveResult.success) return saveResult;

  const storageKey = setStorageKey(id, false);
  try {
    await browser.storage.local.remove(storageKey);
  } catch {
    return fail('Failed to remove set data', { key: storageKey, operation: 'delete', reason: 'write_failed' },
      { cause: new Error('Storage delete failed') });
  }

  return { success: true, data: undefined };
}

export async function renameSet(
  id: string,
  name: string,
): Promise<Result<void, StorageError>> {
  if (!isNameValid(name)) {
    return fail('Set name cannot be empty', { operation: 'write', reason: 'write_failed' });
  }

  const manifestResult = await loadManifest();
  if (!manifestResult.success) return manifestResult;

  const target = manifestResult.data.sets.find(s => s.id === id);
  if (!target) {
    return fail('Set not found', { operation: 'read', reason: 'not_found' });
  }

  const updated: PasswordSetManifest = {
    ...manifestResult.data,
    sets: manifestResult.data.sets.map(s =>
      s.id === id ? { ...s, name } : s,
    ),
  };

  return saveManifest(updated);
}

async function resolveStorageKey(id: string): Promise<Result<string, StorageError>> {
  const manifestResult = await loadManifest();
  if (!manifestResult.success) return manifestResult;
  const set = manifestResult.data.sets.find(s => s.id === id);
  if (!set) return fail('Set not found', { operation: 'read', reason: 'not_found' });
  return { success: true, data: setStorageKey(set.id, set.isDefault) };
}

export async function saveSetData(
  id: string,
  plaintext: string,
  password: string,
): Promise<Result<void, StorageError>> {
  const keyResult = await resolveStorageKey(id);
  if (!keyResult.success) return keyResult;
  try {
    const store = await encrypt(plaintext, password);
    await browser.storage.local.set({ [keyResult.data]: store });
    return { success: true, data: undefined };
  } catch (error: unknown) {
    return fail('Failed to save set data',
      { key: keyResult.data, operation: 'write', reason: 'write_failed' },
      { cause: error instanceof Error ? error : undefined });
  }
}

export async function loadSetData(
  id: string,
  password: string,
): Promise<Result<string, StorageError | InvalidPasswordError>> {
  const keyResult = await resolveStorageKey(id);
  if (!keyResult.success) return keyResult;
  const key = keyResult.data;

  let raw: Record<string, unknown>;
  try {
    raw = await browser.storage.local.get(key);
  } catch {
    return fail('Failed to read set data',
      { key, operation: 'read', reason: 'read_failed' });
  }

  const stored = raw[key];
  if (stored == null) {
    return fail('No data for set', { key, operation: 'read', reason: 'not_found' });
  }
  if (!validateEncryptedStore(stored)) {
    return fail('Set data is corrupted', { key, operation: 'read', reason: 'corrupted' });
  }

  try {
    const plaintext = await decrypt(stored, password);
    return { success: true, data: plaintext };
  } catch (error: unknown) {
    if (error instanceof InvalidPasswordError) {
      return { success: false, error };
    }
    const reason = error instanceof DecryptionError ? 'corrupted' as const : 'read_failed' as const;
    return fail('Decryption failed', { key, operation: 'read', reason });
  }
}

export async function hasSetData(
  id: string,
): Promise<Result<boolean, StorageError>> {
  const keyResult = await resolveStorageKey(id);
  if (!keyResult.success) return keyResult;
  try {
    const raw = await browser.storage.local.get(keyResult.data);
    return { success: true, data: raw[keyResult.data] != null };
  } catch {
    return fail('Failed to check set data',
      { key: keyResult.data, operation: 'read', reason: 'read_failed' });
  }
}
