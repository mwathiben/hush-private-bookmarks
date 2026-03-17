import { browser } from 'wxt/browser';
import type { SyncConfig, EncryptedBlob } from '@/lib/sync-types';
import type {
  BackgroundResponse,
  SyncUploadMessage,
} from '@/lib/background-types';
import { SyncError } from '@/lib/errors';
import { uploadBlob, downloadBlob, getSyncStatus } from '@/lib/sync-client';

const STORAGE_KEY = 'hush_sync_config';

const NOT_CONFIGURED: BackgroundResponse = {
  success: false,
  error: 'Sync not configured',
  code: 'SYNC_NOT_CONFIGURED',
};

function isSyncConfig(value: unknown): value is SyncConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.backendUrl !== 'string' || !obj.backendUrl.trim()) return false;
  if (typeof obj.authToken !== 'string' || !obj.authToken) return false;
  if (typeof obj.syncIntervalMs !== 'number') return false;
  if (!Number.isFinite(obj.syncIntervalMs) || obj.syncIntervalMs <= 0) return false;
  return true;
}

export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  return isSyncConfig(raw) ? raw : null;
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return globalThis.btoa(binary);
}

function mapError(err: unknown): BackgroundResponse {
  if (err instanceof SyncError) {
    return { success: false, error: err.message, code: err.context.code };
  }
  return { success: false, error: 'Sync operation failed' };
}

export async function handleSyncStatus(): Promise<BackgroundResponse> {
  const config = await loadSyncConfig();
  if (!config) return NOT_CONFIGURED;

  try {
    const status = await getSyncStatus(config);
    return { success: true, data: status };
  } catch (err: unknown) {
    return mapError(err);
  }
}

export async function handleSyncUpload(msg: SyncUploadMessage): Promise<BackgroundResponse> {
  const config = await loadSyncConfig();
  if (!config) return NOT_CONFIGURED;

  if (!Number.isFinite(msg.timestamp) || msg.timestamp <= 0) {
    return { success: false, error: 'Invalid timestamp', code: 'SYNC_INVALID_INPUT' };
  }

  const blob = base64ToUint8Array(msg.blob) as EncryptedBlob;
  const result = await uploadBlob(config, blob, msg.timestamp);

  if (!result.success) {
    return { success: false, error: result.error.message, code: result.error.context.code };
  }

  return { success: true, data: result.data };
}

export async function handleSyncDownload(): Promise<BackgroundResponse> {
  const config = await loadSyncConfig();
  if (!config) return NOT_CONFIGURED;

  try {
    const result = await downloadBlob(config);
    if (!result) return { success: true, data: null };

    const blob = uint8ArrayToBase64(result.blob);
    return { success: true, data: { blob, timestamp: result.timestamp } };
  } catch (err: unknown) {
    return mapError(err);
  }
}
