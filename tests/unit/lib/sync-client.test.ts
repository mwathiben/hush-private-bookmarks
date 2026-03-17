import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EncryptedBlob, SyncConfig, SyncConflict } from '@/lib/sync-types';
import { SyncError } from '@/lib/errors';
import {
  uploadBlob,
  downloadBlob,
  resolveConflict,
  getSyncStatus,
} from '@/lib/sync-client';

const ROOT = resolve(process.cwd());

function makeConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
  return {
    backendUrl: 'https://sync.hush.example.com',
    authToken: 'test-bearer-token',
    syncIntervalMs: 30_000,
    ...overrides,
  };
}

function makeBlob(bytes: number[] = [1, 2, 3]): EncryptedBlob {
  return new Uint8Array(bytes) as EncryptedBlob;
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadBlob', () => {
  it('sends POST with Bearer auth, octet-stream, and X-Sync-Timestamp headers', async () => {
    // #given
    const config = makeConfig();
    const blob = makeBlob();
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ timestamp: 1710000000, bytesTransferred: 3 }), { status: 200 }),
    );

    // #when
    await uploadBlob(config, blob, 1710000000);

    // #then
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sync.hush.example.com/sync/upload');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-bearer-token');
    expect(headers.get('Content-Type')).toBe('application/octet-stream');
    expect(headers.get('X-Sync-Timestamp')).toBe('1710000000');
  });

  it('sends raw blob bytes as request body', async () => {
    // #given
    const blob = makeBlob([10, 20, 30]);
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ timestamp: 1, bytesTransferred: 3 }), { status: 200 }),
    );

    // #when
    await uploadBlob(makeConfig(), blob, 1);

    // #then
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(blob);
  });

  it('returns success with timestamp and bytesTransferred on 200', async () => {
    // #given
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ timestamp: 1710000000, bytesTransferred: 1024 }), { status: 200 }),
    );

    // #when
    const result = await uploadBlob(makeConfig(), makeBlob(), 1710000000);

    // #then
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timestamp).toBe(1710000000);
      expect(result.data.bytesTransferred).toBe(1024);
    }
  });

  it('returns error NETWORK_ERROR when fetch throws TypeError', async () => {
    // #given
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

    // #when
    const result = await uploadBlob(makeConfig(), makeBlob(), 1);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SyncError);
      expect(result.error.context.code).toBe('NETWORK_ERROR');
    }
  });

  it('returns error SERVER_ERROR when JSON parsing fails on 200', async () => {
    // #given
    fetchSpy.mockResolvedValue(new Response('not-json', { status: 200 }));

    // #when
    const result = await uploadBlob(makeConfig(), makeBlob(), 1);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SyncError);
      expect(result.error.context.code).toBe('SERVER_ERROR');
    }
  });

  it.each([
    [401, 'AUTH_FAILED'],
    [409, 'CONFLICT'],
    [500, 'SERVER_ERROR'],
    [502, 'SERVER_ERROR'],
  ] as const)('returns error %s on HTTP %i', async (status, expectedCode) => {
    // #given
    fetchSpy.mockResolvedValue(new Response('', { status }));

    // #when
    const result = await uploadBlob(makeConfig(), makeBlob(), 1);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SyncError);
      expect(result.error.context.code).toBe(expectedCode);
    }
  });

  it('returns error TIMEOUT when fetch throws TimeoutError', async () => {
    // #given — jsdom may not preserve DOMException.name; use Error with name override
    const err = new Error('Signal timed out');
    err.name = 'TimeoutError';
    fetchSpy.mockRejectedValue(err);

    // #when
    const result = await uploadBlob(makeConfig(), makeBlob(), 1);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.context.code).toBe('TIMEOUT');
    }
  });

  it('strips trailing slash from backendUrl', async () => {
    // #given
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ timestamp: 1, bytesTransferred: 0 }), { status: 200 }),
    );

    // #when
    await uploadBlob(makeConfig({ backendUrl: 'https://api.example.com/' }), makeBlob(), 1);

    // #then
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe('https://api.example.com/sync/upload');
  });
});

describe('downloadBlob', () => {
  it('sends GET with Bearer auth', async () => {
    // #given
    const config = makeConfig();
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'X-Sync-Timestamp': '1710000000' },
      }),
    );

    // #when
    await downloadBlob(config);

    // #then
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sync.hush.example.com/sync/download');
    expect(init.method).toBe('GET');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-bearer-token');
  });

  it('returns blob and timestamp on 200', async () => {
    // #given
    const body = new Uint8Array([10, 20, 30]);
    fetchSpy.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'X-Sync-Timestamp': '1710000001' },
      }),
    );

    // #when
    const result = await downloadBlob(makeConfig());

    // #then
    expect(result).not.toBeNull();
    expect(result!.timestamp).toBe(1710000001);
    expect(new Uint8Array(result!.blob)).toEqual(new Uint8Array([10, 20, 30]));
  });

  it('returns null on 404', async () => {
    // #given
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }));

    // #when
    const result = await downloadBlob(makeConfig());

    // #then
    expect(result).toBeNull();
  });

  it('throws SyncError AUTH_FAILED on 401', async () => {
    // #given
    fetchSpy.mockResolvedValue(new Response('', { status: 401 }));

    // #when / #then
    await expect(downloadBlob(makeConfig())).rejects.toThrow(SyncError);
    try {
      await downloadBlob(makeConfig());
    } catch (err) {
      expect(err).toBeInstanceOf(SyncError);
      expect((err as SyncError).context.code).toBe('AUTH_FAILED');
    }
  });

  it('throws SyncError SERVER_ERROR on 500', async () => {
    // #given
    fetchSpy.mockResolvedValue(new Response('', { status: 500 }));

    // #when / #then
    await expect(downloadBlob(makeConfig())).rejects.toThrow(SyncError);
  });

  it('throws SyncError NETWORK_ERROR when fetch throws TypeError', async () => {
    // #given
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

    // #when / #then
    await expect(downloadBlob(makeConfig())).rejects.toThrow(SyncError);
    try {
      await downloadBlob(makeConfig());
    } catch (err) {
      expect((err as SyncError).context.code).toBe('NETWORK_ERROR');
    }
  });

  it('throws SyncError SERVER_ERROR when X-Sync-Timestamp header is missing', async () => {
    // #given
    fetchSpy.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));

    // #when / #then
    let caught: SyncError | undefined;
    try {
      await downloadBlob(makeConfig());
    } catch (err) {
      caught = err as SyncError;
    }
    expect(caught).toBeInstanceOf(SyncError);
    expect(caught!.context.code).toBe('SERVER_ERROR');
  });

  it('throws SyncError SERVER_ERROR when X-Sync-Timestamp is NaN', async () => {
    // #given
    fetchSpy.mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { 'X-Sync-Timestamp': 'not-a-number' },
      }),
    );

    // #when / #then
    let caught: SyncError | undefined;
    try {
      await downloadBlob(makeConfig());
    } catch (err) {
      caught = err as SyncError;
    }
    expect(caught).toBeInstanceOf(SyncError);
    expect(caught!.context.code).toBe('SERVER_ERROR');
  });
});

describe('resolveConflict', () => {
  it('returns remote when remoteTimestamp > localTimestamp', () => {
    // #given
    const local = makeBlob([1, 2, 3]);
    const remote = makeBlob([4, 5, 6]);
    const conflict: SyncConflict = {
      featureId: 'bookmarks',
      local,
      remote,
      localTimestamp: 1710000000,
      remoteTimestamp: 1710000001,
    };

    // #when
    const result = resolveConflict(conflict);

    // #then
    expect(result).toBe(remote);
  });

  it('returns local when localTimestamp > remoteTimestamp', () => {
    // #given
    const local = makeBlob([1, 2, 3]);
    const remote = makeBlob([4, 5, 6]);
    const conflict: SyncConflict = {
      featureId: 'bookmarks',
      local,
      remote,
      localTimestamp: 1710000001,
      remoteTimestamp: 1710000000,
    };

    // #when
    const result = resolveConflict(conflict);

    // #then
    expect(result).toBe(local);
  });

  it('returns local when timestamps are equal (local wins ties)', () => {
    // #given
    const local = makeBlob([1, 2, 3]);
    const remote = makeBlob([4, 5, 6]);
    const conflict: SyncConflict = {
      featureId: 'bookmarks',
      local,
      remote,
      localTimestamp: 1710000000,
      remoteTimestamp: 1710000000,
    };

    // #when
    const result = resolveConflict(conflict);

    // #then
    expect(result).toBe(local);
  });
});

describe('getSyncStatus', () => {
  it('returns not_configured when backendUrl is empty string', async () => {
    // #given
    const config = makeConfig({ backendUrl: '' });

    // #when
    const status = await getSyncStatus(config);

    // #then
    expect(status.state).toBe('not_configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns not_configured when backendUrl is whitespace only', async () => {
    // #given
    const config = makeConfig({ backendUrl: '   ' });

    // #when
    const status = await getSyncStatus(config);

    // #then
    expect(status.state).toBe('not_configured');
  });

  it('returns idle on 200 health check', async () => {
    // #given
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );

    // #when
    const status = await getSyncStatus(makeConfig(), 1710000000);

    // #then
    expect(status.state).toBe('idle');
    if (status.state === 'idle') {
      expect(status.lastSyncAt).toBe(1710000000);
    }
  });

  it('returns offline when fetch throws TypeError (network error)', async () => {
    // #given
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

    // #when
    const status = await getSyncStatus(makeConfig());

    // #then
    expect(status.state).toBe('offline');
  });

  it('returns error with AUTH_FAILED on 401', async () => {
    // #given
    fetchSpy.mockResolvedValue(new Response('', { status: 401 }));

    // #when
    const status = await getSyncStatus(makeConfig());

    // #then
    expect(status.state).toBe('error');
    if (status.state === 'error') {
      expect(status.error).toBe('AUTH_FAILED');
    }
  });

  it('returns error with SERVER_ERROR on 500', async () => {
    // #given
    fetchSpy.mockResolvedValue(new Response('', { status: 500 }));

    // #when
    const status = await getSyncStatus(makeConfig());

    // #then
    expect(status.state).toBe('error');
    if (status.state === 'error') {
      expect(status.error).toBe('SERVER_ERROR');
    }
  });

  it('passes lastSyncAt through to idle state', async () => {
    // #given
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );

    // #when
    const status = await getSyncStatus(makeConfig(), 42);

    // #then
    if (status.state === 'idle') {
      expect(status.lastSyncAt).toBe(42);
    }
  });

  it('defaults lastSyncAt to Date.now() when not provided on 200', async () => {
    // #given
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );
    const before = Date.now();

    // #when
    const status = await getSyncStatus(makeConfig());

    // #then
    const after = Date.now();
    if (status.state === 'idle') {
      expect(status.lastSyncAt).toBeGreaterThanOrEqual(before);
      expect(status.lastSyncAt).toBeLessThanOrEqual(after);
    }
  });
});

describe('security constraints', () => {
  it('rejects non-HTTPS backendUrl', async () => {
    // #given
    const config = makeConfig({ backendUrl: 'http://insecure.example.com' });

    // #when
    const result = await uploadBlob(config, makeBlob(), 1);

    // #then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.context.code).toBe('NETWORK_ERROR');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('downloadBlob rejects non-HTTPS backendUrl', async () => {
    // #given
    const config = makeConfig({ backendUrl: 'http://insecure.example.com' });

    // #when / #then
    await expect(downloadBlob(config)).rejects.toThrow(SyncError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('lib/sync-client.ts module purity', () => {
  const content = readFileSync(resolve(ROOT, 'lib/sync-client.ts'), 'utf-8');

  it('has zero React/DOM imports', () => {
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(content).not.toContain('document.');
    expect(content).not.toContain('window.');
  });

  it('has zero browser.storage references', () => {
    expect(content).not.toContain('browser.storage');
    expect(content).not.toContain('chrome.storage');
  });

  it('has zero crypto imports (opaque blob transport)', () => {
    expect(content).not.toMatch(/from\s+['"].*crypto['"]/);
    expect(content).not.toContain('crypto.subtle');
    expect(content).not.toContain('crypto.getRandomValues');
  });

  it('is under 300 lines', () => {
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(300);
  });

  it('all exported functions have explicit return types', () => {
    const exportedFunctions = content.match(/^export\s+(async\s+)?function\s+\w+[^{]+/gm) ?? [];
    for (const fn of exportedFunctions) {
      expect(fn).toMatch(/\):\s*\S/);
    }
  });
});
