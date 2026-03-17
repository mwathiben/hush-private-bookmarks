import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  PlaintextBlob,
  EncryptedBlob,
  SyncableFeature,
  SyncConfig,
  SyncStatus,
  SyncResult,
  SyncConflict,
} from '@/lib/sync-types';
import { SyncError } from '@/lib/errors';

const ROOT = resolve(process.cwd());

describe('branded blob types', () => {
  it('PlaintextBlob is usable via cast and behaves as Uint8Array', () => {
    const blob = new Uint8Array([1, 2, 3]) as PlaintextBlob;
    expect(blob).toBeInstanceOf(Uint8Array);
    expect(blob.length).toBe(3);
    expect(blob.byteLength).toBe(3);
  });

  it('EncryptedBlob is usable via cast and behaves as Uint8Array', () => {
    const blob = new Uint8Array([4, 5, 6]) as EncryptedBlob;
    expect(blob).toBeInstanceOf(Uint8Array);
    expect(blob.length).toBe(3);
    expect(blob.byteLength).toBe(3);
  });
});

describe('SyncableFeature', () => {
  it('accepts a valid implementation with all required members', () => {
    const feature: SyncableFeature = {
      featureId: 'bookmarks',
      serialize: () => Promise.resolve(new Uint8Array(0) as PlaintextBlob),
      deserialize: () => Promise.resolve(),
      requiresServer: () => false,
    };
    expect(feature.featureId).toBe('bookmarks');
    expect(typeof feature.serialize).toBe('function');
    expect(typeof feature.deserialize).toBe('function');
    expect(feature.requiresServer()).toBe(false);
  });

  it('serialize returns Promise<PlaintextBlob>', async () => {
    const data = new Uint8Array([1, 2, 3]) as PlaintextBlob;
    const feature: SyncableFeature = {
      featureId: 'tags',
      serialize: () => Promise.resolve(data),
      deserialize: () => Promise.resolve(),
      requiresServer: () => true,
    };
    const result = await feature.serialize();
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('deserialize accepts PlaintextBlob and returns Promise<void>', async () => {
    let received: PlaintextBlob | null = null;
    const feature: SyncableFeature = {
      featureId: 'dashboard',
      serialize: () => Promise.resolve(new Uint8Array(0) as PlaintextBlob),
      deserialize: (data: PlaintextBlob) => {
        received = data;
        return Promise.resolve();
      },
      requiresServer: () => false,
    };
    const input = new Uint8Array([10, 20, 30]) as PlaintextBlob;
    await feature.deserialize(input);
    expect(received).toEqual(input);
  });
});

describe('SyncConfig', () => {
  it('accepts valid config with required fields', () => {
    const config: SyncConfig = {
      backendUrl: 'https://sync.hush.example.com',
      authToken: 'bearer-token-abc',
      syncIntervalMs: 30_000,
    };
    expect(config.backendUrl).toBe('https://sync.hush.example.com');
    expect(config.authToken).toBe('bearer-token-abc');
    expect(config.syncIntervalMs).toBe(30_000);
  });
});

describe('SyncStatus', () => {
  it('accepts all 5 states as discriminated union', () => {
    const states: SyncStatus[] = [
      { state: 'idle', lastSyncAt: Date.now() },
      { state: 'syncing', lastSyncAt: Date.now() },
      { state: 'error', lastSyncAt: Date.now(), error: 'NETWORK_ERROR' },
      { state: 'offline', lastSyncAt: null },
      { state: 'not_configured' },
    ];
    expect(states).toHaveLength(5);
  });

  it('supports exhaustive switch on state field', () => {
    function describeStatus(status: SyncStatus): string {
      switch (status.state) {
        case 'idle':
          return 'idle';
        case 'syncing':
          return 'syncing';
        case 'error':
          return 'error';
        case 'offline':
          return 'offline';
        case 'not_configured':
          return 'not configured';
      }
    }
    const s: SyncStatus = { state: 'idle', lastSyncAt: Date.now() };
    expect(describeStatus(s)).toBe('idle');
  });

  it.each(['AUTH_FAILED', 'CONFLICT', 'NETWORK_ERROR', 'SERVER_ERROR', 'TIMEOUT'] as const)(
    'error state accepts %s code',
    (code) => {
      const status: SyncStatus = { state: 'error', lastSyncAt: null, error: code };
      expect(status.error).toBe(code);
    },
  );

  it('idle state requires lastSyncAt as number (not null)', () => {
    const status: SyncStatus = { state: 'idle', lastSyncAt: 1710000000 };
    expect(status.lastSyncAt).toBe(1710000000);
  });

  it('not_configured state has no lastSyncAt field', () => {
    const status: SyncStatus = { state: 'not_configured' };
    expect(status.state).toBe('not_configured');
    expect('lastSyncAt' in status).toBe(false);
  });

  it('syncing state accepts lastSyncAt: null for first-ever sync', () => {
    const status: SyncStatus = { state: 'syncing', lastSyncAt: null };
    expect(status.state).toBe('syncing');
    expect(status.lastSyncAt).toBeNull();
  });
});

describe('SyncResult', () => {
  it('success narrows to timestamp and bytesTransferred', () => {
    const result: SyncResult = {
      success: true,
      data: { timestamp: 1710000000, bytesTransferred: 1024 },
    };
    if (result.success) {
      expect(result.data.timestamp).toBe(1710000000);
      expect(result.data.bytesTransferred).toBe(1024);
    }
  });

  it('failure narrows to SyncError', () => {
    const err = new SyncError('network down', { code: 'NETWORK_ERROR' });
    const result: SyncResult = { success: false, error: err };
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SyncError);
      expect(result.error.context.code).toBe('NETWORK_ERROR');
    }
  });
});

describe('SyncConflict', () => {
  it('accepts featureId + encrypted blobs with timestamps', () => {
    const conflict: SyncConflict = {
      featureId: 'bookmarks',
      local: new Uint8Array([1, 2, 3]) as EncryptedBlob,
      remote: new Uint8Array([4, 5, 6]) as EncryptedBlob,
      localTimestamp: 1710000000,
      remoteTimestamp: 1710000001,
    };
    expect(conflict.featureId).toBe('bookmarks');
    expect(conflict.local).toEqual(new Uint8Array([1, 2, 3]));
    expect(conflict.remote).toEqual(new Uint8Array([4, 5, 6]));
    expect(conflict.remoteTimestamp).toBeGreaterThan(conflict.localTimestamp);
  });
});

describe('lib/sync-types.ts module purity', () => {
  const content = readFileSync(resolve(ROOT, 'lib/sync-types.ts'), 'utf-8');

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

  it('has zero runtime code (types-only)', () => {
    expect(content).not.toMatch(/^(?:export\s+)?(?:const|let|var|function|class)\s/m);
  });

  it('uses only import type statements', () => {
    const importLines = content.split('\n').filter((line) => /^\s*import\s/.test(line));
    for (const line of importLines) {
      expect(line).toMatch(/import\s+type\s/);
    }
  });
});
