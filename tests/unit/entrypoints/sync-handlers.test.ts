// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fakeBrowser } from 'wxt/testing';
import { SyncError } from '@/lib/errors';
import type { SyncConfig } from '@/lib/sync-types';

vi.mock('@/lib/sync-client', () => ({
  uploadBlob: vi.fn(),
  downloadBlob: vi.fn(),
  getSyncStatus: vi.fn(),
}));

import {
  handleSyncStatus,
  handleSyncDownload,
  handleSyncUpload,
  loadSyncConfig,
} from '@/entrypoints/background/sync-handlers';

import { uploadBlob, downloadBlob, getSyncStatus } from '@/lib/sync-client';

const mockUploadBlob = vi.mocked(uploadBlob);
const mockDownloadBlob = vi.mocked(downloadBlob);
const mockGetSyncStatus = vi.mocked(getSyncStatus);

const STORAGE_KEY = 'hush_sync_config';

const VALID_CONFIG: SyncConfig = {
  backendUrl: 'https://api.example.com',
  authToken: 'tok_abc123',
  syncIntervalMs: 60_000,
};

beforeEach(async () => {
  vi.resetAllMocks();
  await fakeBrowser.storage.local.clear();
});

describe('sync-handlers: not-configured path', () => {
  it('handleSyncStatus returns SYNC_NOT_CONFIGURED when no config', async () => {
    // #when
    const result = await handleSyncStatus();

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Sync not configured',
      code: 'SYNC_NOT_CONFIGURED',
    });
  });

  it('handleSyncUpload returns SYNC_NOT_CONFIGURED when no config', async () => {
    // #when
    const result = await handleSyncUpload({ type: 'SYNC_UPLOAD', blob: 'abc', timestamp: 1 });

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Sync not configured',
      code: 'SYNC_NOT_CONFIGURED',
    });
    expect(mockUploadBlob).not.toHaveBeenCalled();
  });

  it('handleSyncDownload returns SYNC_NOT_CONFIGURED when no config', async () => {
    // #when
    const result = await handleSyncDownload();

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Sync not configured',
      code: 'SYNC_NOT_CONFIGURED',
    });
    expect(mockDownloadBlob).not.toHaveBeenCalled();
  });
});

describe('sync-handlers: loadSyncConfig validation', () => {
  it('returns null for missing storage key', async () => {
    // #given — storage is empty (cleared in beforeEach)

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toBeNull();
  });

  it('returns null for non-object value (string)', async () => {
    // #given
    await fakeBrowser.storage.local.set({ [STORAGE_KEY]: 'not-an-object' });

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toBeNull();
  });

  it('returns null for null value', async () => {
    // #given
    await fakeBrowser.storage.local.set({ [STORAGE_KEY]: null });

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toBeNull();
  });

  it('returns null for object missing required fields', async () => {
    // #given
    await fakeBrowser.storage.local.set({
      [STORAGE_KEY]: { backendUrl: 'https://api.example.com' },
    });

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toBeNull();
  });

  it('returns null for object with wrong field types', async () => {
    // #given
    await fakeBrowser.storage.local.set({
      [STORAGE_KEY]: {
        backendUrl: 'https://api.example.com',
        authToken: 'tok_abc',
        syncIntervalMs: NaN,
      },
    });

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toBeNull();
  });

  it('returns null for empty string authToken', async () => {
    // #given
    await fakeBrowser.storage.local.set({
      [STORAGE_KEY]: {
        backendUrl: 'https://api.example.com',
        authToken: '',
        syncIntervalMs: 60_000,
      },
    });

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toBeNull();
  });

  it('returns null for syncIntervalMs of zero', async () => {
    // #given
    await fakeBrowser.storage.local.set({
      [STORAGE_KEY]: {
        backendUrl: 'https://api.example.com',
        authToken: 'tok_abc',
        syncIntervalMs: 0,
      },
    });

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toBeNull();
  });

  it('returns null for negative syncIntervalMs', async () => {
    // #given
    await fakeBrowser.storage.local.set({
      [STORAGE_KEY]: {
        backendUrl: 'https://api.example.com',
        authToken: 'tok_abc',
        syncIntervalMs: -1,
      },
    });

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toBeNull();
  });

  it('returns valid SyncConfig for correct data', async () => {
    // #given
    await fakeBrowser.storage.local.set({ [STORAGE_KEY]: VALID_CONFIG });

    // #when
    const result = await loadSyncConfig();

    // #then
    expect(result).toEqual(VALID_CONFIG);
  });
});

describe('sync-handlers: configured path', () => {
  beforeEach(async () => {
    await fakeBrowser.storage.local.set({ [STORAGE_KEY]: VALID_CONFIG });
  });

  it('handleSyncStatus calls getSyncStatus and returns status data', async () => {
    // #given
    mockGetSyncStatus.mockResolvedValue({ state: 'idle', lastSyncAt: 1000 });

    // #when
    const result = await handleSyncStatus();

    // #then
    expect(mockGetSyncStatus).toHaveBeenCalledWith(VALID_CONFIG);
    expect(result).toEqual({
      success: true,
      data: { state: 'idle', lastSyncAt: 1000 },
    });
  });

  it('handleSyncStatus returns error on getSyncStatus failure', async () => {
    // #given
    mockGetSyncStatus.mockRejectedValue(
      new SyncError('Network unavailable', { code: 'NETWORK_ERROR' }),
    );

    // #when
    const result = await handleSyncStatus();

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Network unavailable',
      code: 'NETWORK_ERROR',
    });
  });

  it('handleSyncUpload validates timestamp — rejects NaN', async () => {
    // #when
    const result = await handleSyncUpload({ type: 'SYNC_UPLOAD', blob: 'abc', timestamp: NaN });

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Invalid timestamp',
      code: 'SYNC_INVALID_INPUT',
    });
    expect(mockUploadBlob).not.toHaveBeenCalled();
  });

  it('handleSyncUpload validates timestamp — rejects negative', async () => {
    // #when
    const result = await handleSyncUpload({ type: 'SYNC_UPLOAD', blob: 'abc', timestamp: -1 });

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Invalid timestamp',
      code: 'SYNC_INVALID_INPUT',
    });
  });

  it('handleSyncUpload validates timestamp — rejects Infinity', async () => {
    // #when
    const result = await handleSyncUpload({
      type: 'SYNC_UPLOAD',
      blob: 'abc',
      timestamp: Infinity,
    });

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Invalid timestamp',
      code: 'SYNC_INVALID_INPUT',
    });
  });

  it('handleSyncUpload calls uploadBlob and returns success', async () => {
    // #given
    mockUploadBlob.mockResolvedValue({
      success: true,
      data: { timestamp: 1000, bytesTransferred: 42 },
    });

    // #when
    const result = await handleSyncUpload({ type: 'SYNC_UPLOAD', blob: 'AQID', timestamp: 1000 });

    // #then
    expect(mockUploadBlob).toHaveBeenCalledWith(
      VALID_CONFIG,
      expect.any(Uint8Array),
      1000,
    );
    expect(result).toEqual({
      success: true,
      data: { timestamp: 1000, bytesTransferred: 42 },
    });
  });

  it('handleSyncUpload returns error on uploadBlob failure', async () => {
    // #given
    mockUploadBlob.mockResolvedValue({
      success: false,
      error: new SyncError('Network unavailable', { code: 'NETWORK_ERROR' }),
    });

    // #when
    const result = await handleSyncUpload({ type: 'SYNC_UPLOAD', blob: 'AQID', timestamp: 1000 });

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Network unavailable',
      code: 'NETWORK_ERROR',
    });
  });

  it('handleSyncDownload calls downloadBlob and returns blob as base64', async () => {
    // #given
    const fakeBlob = new Uint8Array([1, 2, 3]);
    mockDownloadBlob.mockResolvedValue({ blob: fakeBlob as never, timestamp: 2000 });

    // #when
    const result = await handleSyncDownload();

    // #then
    expect(mockDownloadBlob).toHaveBeenCalledWith(VALID_CONFIG);
    expect(result).toEqual({
      success: true,
      data: { blob: 'AQID', timestamp: 2000 },
    });
  });

  it('handleSyncDownload returns null data when downloadBlob returns null', async () => {
    // #given
    mockDownloadBlob.mockResolvedValue(null);

    // #when
    const result = await handleSyncDownload();

    // #then
    expect(result).toEqual({
      success: true,
      data: null,
    });
  });

  it('handleSyncDownload returns error on downloadBlob failure', async () => {
    // #given
    mockDownloadBlob.mockRejectedValue(
      new SyncError('Authentication failed', { code: 'AUTH_FAILED' }),
    );

    // #when
    const result = await handleSyncDownload();

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED',
    });
  });

  it('handleSyncStatus handles non-SyncError gracefully', async () => {
    // #given
    mockGetSyncStatus.mockRejectedValue(new Error('unexpected'));

    // #when
    const result = await handleSyncStatus();

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Sync operation failed',
    });
  });

  it('handleSyncDownload handles non-SyncError gracefully', async () => {
    // #given
    mockDownloadBlob.mockRejectedValue(new Error('unexpected'));

    // #when
    const result = await handleSyncDownload();

    // #then
    expect(result).toEqual({
      success: false,
      error: 'Sync operation failed',
    });
  });
});

describe('sync-handlers: module purity', () => {
  const ROOT = resolve(__dirname, '..', '..', '..');
  const content = readFileSync(
    resolve(ROOT, 'entrypoints', 'background', 'sync-handlers.ts'),
    'utf-8',
  );

  it('has zero crypto imports', () => {
    expect(content).not.toMatch(/from\s+['"]@\/lib\/crypto['"]/);
    expect(content).not.toContain('crypto.subtle');
  });

  it('uses browser from wxt/browser', () => {
    expect(content).toMatch(/from\s+['"]wxt\/browser['"]/);
    expect(content).not.toContain('chrome.');
  });

  it('has zero React/DOM imports', () => {
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toContain('document.');
    expect(content).not.toContain('window.');
  });

  it('has zero console.log', () => {
    expect(content).not.toContain('console.log');
  });
});
