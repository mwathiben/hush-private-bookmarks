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
  return isDefault ? STORAGE_KEY : `hush_set_${id}`;
}

function isValidSetInfo(data: unknown): boolean {
  if (data === null || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' && o['id'] !== '' &&
    typeof o['name'] === 'string' && o['name'] !== '' &&
    typeof o['createdAt'] === 'number' && Number.isInteger(o['createdAt']) &&
    typeof o['lastAccessedAt'] === 'number' && Number.isInteger(o['lastAccessedAt']) &&
    typeof o['isDefault'] === 'boolean'
  );
}

export function validateManifest(data: unknown): data is PasswordSetManifest {
  if (data === null || typeof data !== 'object') return false;
  const o = data as Record<string, unknown>;
  if (typeof o['version'] !== 'number' || !Number.isInteger(o['version'])) return false;
  if (typeof o['activeSetId'] !== 'string' || o['activeSetId'] === '') return false;
  if (!Array.isArray(o['sets']) || !o['sets'].every(isValidSetInfo)) return false;
  return o['sets'].some((s: Record<string, unknown>) => s['id'] === o['activeSetId']);
}

function createDefaultManifest(): PasswordSetManifest {
  const now = Date.now();
  const id = generateId();
  return {
    sets: [{ id, name: 'Default', createdAt: now, lastAccessedAt: now, isDefault: true }],
    activeSetId: id, version: MANIFEST_VERSION,
  };
}

function fail(
  message: string, context: StorageErrorContext, options?: ErrorOptions,
): Result<never, StorageError> {
  return { success: false, error: new StorageError(message, { key: MANIFEST_KEY, ...context }, options) };
}

async function saveManifest(manifest: PasswordSetManifest): Promise<Result<void, StorageError>> {
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

async function findSet(
  id: string,
): Promise<Result<{ manifest: PasswordSetManifest; set: PasswordSetInfo }, StorageError>> {
  const r = await loadManifest();
  if (!r.success) return r;
  const set = r.data.sets.find(s => s.id === id);
  if (!set) return fail('Set not found', { operation: 'read', reason: 'not_found' });
  return { success: true, data: { manifest: r.data, set } };
}

export async function createSet(name: string): Promise<Result<PasswordSetInfo, StorageError>> {
  if (name.trim() === '') {
    return fail('Set name cannot be empty', { operation: 'write', reason: 'write_failed' });
  }
  const r = await loadManifest();
  if (!r.success) return r;
  const now = Date.now();
  const newSet: PasswordSetInfo = {
    id: generateId(), name, createdAt: now, lastAccessedAt: now, isDefault: false,
  };
  const saveResult = await saveManifest({ ...r.data, sets: [...r.data.sets, newSet] });
  if (!saveResult.success) return saveResult;
  return { success: true, data: newSet };
}

export async function listSets(): Promise<Result<readonly PasswordSetInfo[], StorageError>> {
  const r = await loadManifest();
  if (!r.success) return r;
  return { success: true, data: r.data.sets };
}

export async function deleteSet(id: string): Promise<Result<void, StorageError>> {
  const r = await findSet(id);
  if (!r.success) return r;
  const { manifest, set } = r.data;
  if (set.isDefault) {
    return fail('Cannot delete the default set', { operation: 'delete', reason: 'write_failed' });
  }
  const defaultSet = manifest.sets.find(s => s.isDefault);
  const activeSetId = manifest.activeSetId === id ? defaultSet!.id : manifest.activeSetId;
  const saveResult = await saveManifest({
    ...manifest, sets: manifest.sets.filter(s => s.id !== id), activeSetId,
  });
  if (!saveResult.success) return saveResult;
  const key = setStorageKey(id, false);
  try {
    await browser.storage.local.remove(key);
  } catch {
    return fail('Failed to remove set data', { key, operation: 'delete', reason: 'write_failed' },
      { cause: new Error('Storage delete failed') });
  }
  return { success: true, data: undefined };
}

export async function renameSet(id: string, name: string): Promise<Result<void, StorageError>> {
  if (name.trim() === '') {
    return fail('Set name cannot be empty', { operation: 'write', reason: 'write_failed' });
  }
  const r = await findSet(id);
  if (!r.success) return r;
  return saveManifest({
    ...r.data.manifest, sets: r.data.manifest.sets.map(s => s.id === id ? { ...s, name } : s),
  });
}

export async function getActiveSetId(): Promise<Result<string, StorageError>> {
  const r = await loadManifest();
  if (!r.success) return r;
  return { success: true, data: r.data.activeSetId };
}

export async function setActiveSetId(id: string): Promise<Result<void, StorageError>> {
  const r = await findSet(id);
  if (!r.success) return r;
  return saveManifest({ ...r.data.manifest, activeSetId: id });
}

async function resolveStorageKey(id: string): Promise<Result<string, StorageError>> {
  const r = await findSet(id);
  if (!r.success) return r;
  return { success: true, data: setStorageKey(r.data.set.id, r.data.set.isDefault) };
}

export async function saveSetData(
  id: string, plaintext: string, password: string,
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
  id: string, password: string,
): Promise<Result<string, StorageError | InvalidPasswordError>> {
  const keyResult = await resolveStorageKey(id);
  if (!keyResult.success) return keyResult;
  const key = keyResult.data;
  let raw: Record<string, unknown>;
  try {
    raw = await browser.storage.local.get(key);
  } catch {
    return fail('Failed to read set data', { key, operation: 'read', reason: 'read_failed' });
  }
  const stored = raw[key];
  if (stored == null) return fail('No data for set', { key, operation: 'read', reason: 'not_found' });
  if (!validateEncryptedStore(stored)) {
    return fail('Set data is corrupted', { key, operation: 'read', reason: 'corrupted' });
  }
  try {
    const plaintext = await decrypt(stored, password);
    const freshManifest = await loadManifest();
    if (freshManifest.success) {
      const sets = freshManifest.data.sets.map(s =>
        s.id === id ? { ...s, lastAccessedAt: Date.now() } : s,
      );
      void await saveManifest({ ...freshManifest.data, sets });
    }
    return { success: true, data: plaintext };
  } catch (error: unknown) {
    if (error instanceof InvalidPasswordError) return { success: false, error };
    const reason = error instanceof DecryptionError ? 'corrupted' as const : 'read_failed' as const;
    return fail('Decryption failed', { key, operation: 'read', reason },
      { cause: error instanceof Error ? error : undefined });
  }
}

export async function hasSetData(id: string): Promise<Result<boolean, StorageError>> {
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
