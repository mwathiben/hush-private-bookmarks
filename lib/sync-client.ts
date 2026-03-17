import type {
  EncryptedBlob,
  SyncConfig,
  SyncConflict,
  SyncResult,
  SyncStatus,
} from '@/lib/sync-types';
import { SyncError } from '@/lib/errors';

const DEFAULT_TIMEOUT_MS = 30_000;

function buildUrl(backendUrl: string, path: string): string {
  const base = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
  if (!base.startsWith('https://')) {
    throw new SyncError('HTTPS required', { code: 'NETWORK_ERROR' });
  }
  return `${base}${path}`;
}

function authHeaders(config: SyncConfig): Record<string, string> {
  return { Authorization: `Bearer ${config.authToken}` };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new SyncError('Request timed out', { code: 'TIMEOUT' }, { cause: error });
    }
    throw new SyncError('Network unavailable', { code: 'NETWORK_ERROR' }, { cause: error });
  }
}

function mapHttpError(status: number): SyncError {
  if (status === 401) return new SyncError('Authentication failed', { code: 'AUTH_FAILED' });
  if (status === 409) return new SyncError('Conflict detected', { code: 'CONFLICT' });
  return new SyncError('Server error', { code: 'SERVER_ERROR' });
}

export async function uploadBlob(
  config: SyncConfig,
  blob: EncryptedBlob,
  timestamp: number,
): Promise<SyncResult> {
  let url: string;
  try {
    url = buildUrl(config.backendUrl, '/sync/upload');
  } catch (err) {
    if (err instanceof SyncError) return { success: false, error: err };
    return { success: false, error: new SyncError('Unexpected error', { code: 'NETWORK_ERROR' }, { cause: err }) };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        ...authHeaders(config),
        'Content-Type': 'application/octet-stream',
        'X-Sync-Timestamp': String(timestamp),
      },
      body: blob,
    });
  } catch (err) {
    if (err instanceof SyncError) return { success: false, error: err };
    return { success: false, error: new SyncError('Unexpected error', { code: 'NETWORK_ERROR' }, { cause: err }) };
  }

  if (!response.ok) {
    return { success: false, error: mapHttpError(response.status) };
  }

  try {
    const data = (await response.json()) as { timestamp: number; bytesTransferred: number };
    return { success: true, data: { timestamp: data.timestamp, bytesTransferred: data.bytesTransferred } };
  } catch (cause) {
    return { success: false, error: new SyncError('Invalid response', { code: 'SERVER_ERROR' }, { cause }) };
  }
}

export async function downloadBlob(
  config: SyncConfig,
): Promise<{ blob: EncryptedBlob; timestamp: number } | null> {
  const url = buildUrl(config.backendUrl, '/sync/download');

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: authHeaders(config),
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw mapHttpError(response.status);
  }

  const buf = await response.arrayBuffer();
  const blob = new Uint8Array(buf) as EncryptedBlob;

  const tsHeader = response.headers.get('X-Sync-Timestamp');
  const timestamp = Number(tsHeader);
  if (!tsHeader || !Number.isFinite(timestamp)) {
    throw new SyncError('Missing or invalid timestamp header', { code: 'SERVER_ERROR' });
  }

  return { blob, timestamp };
}

export function resolveConflict(conflict: SyncConflict): EncryptedBlob {
  return conflict.localTimestamp >= conflict.remoteTimestamp
    ? conflict.local
    : conflict.remote;
}

export async function getSyncStatus(
  config: SyncConfig,
  lastSyncAt?: number,
): Promise<SyncStatus> {
  if (!config.backendUrl.trim()) {
    return { state: 'not_configured' };
  }

  let url: string;
  try {
    url = buildUrl(config.backendUrl, '/sync/status');
  } catch {
    return { state: 'error', lastSyncAt: lastSyncAt ?? null, error: 'NETWORK_ERROR' };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: authHeaders(config),
    });
  } catch (err) {
    if (err instanceof SyncError && err.context.code === 'TIMEOUT') {
      return { state: 'error', lastSyncAt: lastSyncAt ?? null, error: 'TIMEOUT' };
    }
    if (err instanceof SyncError && err.context.code === 'NETWORK_ERROR') {
      if (err.cause instanceof TypeError) {
        return { state: 'offline', lastSyncAt: lastSyncAt ?? null };
      }
      return { state: 'error', lastSyncAt: lastSyncAt ?? null, error: 'NETWORK_ERROR' };
    }
    if (err instanceof SyncError && err.context.code) {
      return { state: 'error', lastSyncAt: lastSyncAt ?? null, error: err.context.code };
    }
    return { state: 'offline', lastSyncAt: lastSyncAt ?? null };
  }

  if (response.status === 401) {
    return { state: 'error', lastSyncAt: lastSyncAt ?? null, error: 'AUTH_FAILED' };
  }

  if (!response.ok) {
    return { state: 'error', lastSyncAt: lastSyncAt ?? null, error: 'SERVER_ERROR' };
  }

  return { state: 'idle', lastSyncAt: lastSyncAt ?? Date.now() };
}
