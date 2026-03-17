// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

import {
  enqueue,
  drain,
  getQueueSize,
  clearQueue,
  blobToBase64,
  _resetForTesting,
} from '@/entrypoints/background/sync-queue';
import type {
  EnqueueInput,
  UploadFn,
} from '@/entrypoints/background/sync-queue';
import type { SyncConfig, SyncResult, EncryptedBlob } from '@/lib/sync-types';
import { SyncError } from '@/lib/errors';

const STORAGE_KEY = 'hush_sync_queue';

function makeConfig(overrides?: Partial<SyncConfig>): SyncConfig {
  return {
    backendUrl: 'https://sync.example.com',
    authToken: 'test-token',
    syncIntervalMs: 60_000,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<EnqueueInput>): EnqueueInput {
  return {
    type: 'upload',
    blob: 'dGVzdA==',
    timestamp: 1_000_000,
    ...overrides,
  };
}

function makeSuccessUpload(): UploadFn {
  return vi.fn<UploadFn>().mockResolvedValue({
    success: true,
    data: { timestamp: Date.now(), bytesTransferred: 4 },
  });
}

function makeFailUpload(code: NonNullable<ConstructorParameters<typeof SyncError>[1]['code']>): UploadFn {
  return vi.fn<UploadFn>().mockResolvedValue({
    success: false,
    error: new SyncError('test error', { code }),
  });
}

describe('SYNC-003: Offline sync queue with retry', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    _resetForTesting();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- Slice 1: getQueueSize + clearQueue ---

  describe('getQueueSize', () => {
    it('returns 0 for empty queue', async () => {
      // #given — no items enqueued
      // #when
      const size = await getQueueSize();
      // #then
      expect(size).toBe(0);
    });

    it('returns correct count after enqueue', async () => {
      // #given
      await enqueue(makeInput());
      await enqueue(makeInput({ timestamp: 2_000_000 }));
      await enqueue(makeInput({ timestamp: 3_000_000 }));
      // #when
      const size = await getQueueSize();
      // #then
      expect(size).toBe(3);
    });
  });

  describe('clearQueue', () => {
    it('removes all items', async () => {
      // #given
      await enqueue(makeInput());
      await enqueue(makeInput({ timestamp: 2_000_000 }));
      // #when
      await clearQueue();
      // #then
      const size = await getQueueSize();
      expect(size).toBe(0);
    });
  });

  // --- Slice 2: enqueue ---

  describe('enqueue', () => {
    it('adds operation to persistent storage with correct fields', async () => {
      // #given
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      // #when
      await enqueue(makeInput());
      // #then
      const result = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = result[STORAGE_KEY] as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        type: 'upload',
        blob: 'dGVzdA==',
        timestamp: 1_000_000,
        retryCount: 0,
        nextRetryAt: 0,
      });
      expect(items[0]!.enqueuedAt).toBe(Date.now());
    });

    it('preserves existing items (FIFO append)', async () => {
      // #given
      await enqueue(makeInput({ timestamp: 1_000_000 }));
      // #when
      await enqueue(makeInput({ timestamp: 2_000_000 }));
      // #then
      const result = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = result[STORAGE_KEY] as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
      expect(items[0]!.timestamp).toBe(1_000_000);
      expect(items[1]!.timestamp).toBe(2_000_000);
    });

    it('sets retryCount=0, nextRetryAt=0, enqueuedAt=Date.now()', async () => {
      // #given
      vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
      const expectedEnqueuedAt = Date.now();
      // #when
      await enqueue(makeInput());
      // #then
      const result = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = result[STORAGE_KEY] as Array<Record<string, unknown>>;
      expect(items[0]!.retryCount).toBe(0);
      expect(items[0]!.nextRetryAt).toBe(0);
      expect(items[0]!.enqueuedAt).toBe(expectedEnqueuedAt);
    });

    it('drops oldest when exceeding MAX_QUEUE_DEPTH (51→50)', async () => {
      // #given — enqueue 51 items
      for (let i = 0; i < 51; i++) {
        await enqueue(makeInput({ timestamp: i }));
      }
      // #when
      const size = await getQueueSize();
      // #then
      expect(size).toBe(50);
      const result = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = result[STORAGE_KEY] as Array<Record<string, unknown>>;
      expect(items[0]!.timestamp).toBe(1);
      expect(items[49]!.timestamp).toBe(50);
    });

    it('returns new queue size', async () => {
      // #given — empty queue
      // #when
      const size1 = await enqueue(makeInput());
      const size2 = await enqueue(makeInput({ timestamp: 2_000_000 }));
      // #then
      expect(size1).toBe(1);
      expect(size2).toBe(2);
    });

    it('handles corrupted storage (non-array resets to single item)', async () => {
      // #given — corrupt storage with a non-array value
      await fakeBrowser.storage.local.set({ [STORAGE_KEY]: 'corrupted' });
      // #when
      await enqueue(makeInput());
      // #then
      const size = await getQueueSize();
      expect(size).toBe(1);
    });
  });

  // --- Slice 3: drain — success path ---

  describe('drain — success path', () => {
    it('processes items in FIFO order', async () => {
      // #given
      await enqueue(makeInput({ timestamp: 1_000_000 }));
      await enqueue(makeInput({ timestamp: 2_000_000 }));
      const upload = makeSuccessUpload();
      // #when
      await drain(makeConfig(), upload);
      // #then
      const calls = (upload as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0]![2]).toBe(1_000_000);
      expect(calls[1]![2]).toBe(2_000_000);
    });

    it('removes successful operations from queue', async () => {
      // #given
      await enqueue(makeInput());
      await enqueue(makeInput({ timestamp: 2_000_000 }));
      // #when
      await drain(makeConfig(), makeSuccessUpload());
      // #then
      const size = await getQueueSize();
      expect(size).toBe(0);
    });

    it('returns correct DrainResult counts', async () => {
      // #given
      await enqueue(makeInput());
      await enqueue(makeInput({ timestamp: 2_000_000 }));
      // #when
      const result = await drain(makeConfig(), makeSuccessUpload());
      // #then
      expect(result).toEqual({
        processed: 2,
        failed: 0,
        authFailed: 0,
        remaining: 0,
      });
    });
  });

  // --- Slice 4: drain — auth failure (non-retryable) ---

  describe('drain — auth failure', () => {
    it('removes AUTH_FAILED items without retrying', async () => {
      // #given
      await enqueue(makeInput());
      const upload = makeFailUpload('AUTH_FAILED');
      // #when
      const result = await drain(makeConfig(), upload);
      // #then
      expect(result.authFailed).toBe(1);
      expect(result.remaining).toBe(0);
      expect(upload).toHaveBeenCalledTimes(1);
    });

    it('continues processing after auth failure', async () => {
      // #given
      await enqueue(makeInput({ timestamp: 1_000_000 }));
      await enqueue(makeInput({ timestamp: 2_000_000 }));
      let callCount = 0;
      const upload = vi.fn<UploadFn>().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { success: false, error: new SyncError('auth', { code: 'AUTH_FAILED' }) };
        }
        return { success: true, data: { timestamp: Date.now(), bytesTransferred: 4 } };
      });
      // #when
      const result = await drain(makeConfig(), upload);
      // #then
      expect(result.authFailed).toBe(1);
      expect(result.processed).toBe(1);
      expect(result.remaining).toBe(0);
    });
  });

  // --- Slice 5: drain — retryable failure + backoff ---

  describe('drain — retryable failure + backoff', () => {
    it('increments retryCount on NETWORK_ERROR', async () => {
      // #given
      await enqueue(makeInput());
      // #when
      await drain(makeConfig(), makeFailUpload('NETWORK_ERROR'));
      // #then
      const result = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = result[STORAGE_KEY] as Array<Record<string, unknown>>;
      expect(items[0]!.retryCount).toBe(1);
    });

    it('sets nextRetryAt with jittered exponential backoff', async () => {
      // #given
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      await enqueue(makeInput());
      // #when
      await drain(makeConfig(), makeFailUpload('NETWORK_ERROR'));
      // #then
      const result = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = result[STORAGE_KEY] as Array<Record<string, unknown>>;
      const now = Date.now();
      const expectedDelay = Math.floor(0.5 * Math.min(300_000, 1_000 * 2 ** 1));
      expect(items[0]!.nextRetryAt).toBe(now + expectedDelay);
    });

    it('stops processing remaining items after retryable failure', async () => {
      // #given
      await enqueue(makeInput({ timestamp: 1_000_000 }));
      await enqueue(makeInput({ timestamp: 2_000_000 }));
      const upload = makeFailUpload('NETWORK_ERROR');
      // #when
      await drain(makeConfig(), upload);
      // #then — only first item attempted
      expect(upload).toHaveBeenCalledTimes(1);
      const size = await getQueueSize();
      expect(size).toBe(2);
    });

    it('caps backoff at BACKOFF_MAX_MS (300s)', async () => {
      // #given — item with high retryCount
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      vi.spyOn(Math, 'random').mockReturnValue(1);
      await enqueue(makeInput());
      // Simulate 9 prior retries by draining with NETWORK_ERROR repeatedly
      for (let i = 0; i < 9; i++) {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        await drain(makeConfig(), makeFailUpload('NETWORK_ERROR'));
        // Reset nextRetryAt to allow re-drain
        const r = await fakeBrowser.storage.local.get(STORAGE_KEY);
        const items = r[STORAGE_KEY] as Array<Record<string, unknown>>;
        items[0]!.nextRetryAt = 0;
        await fakeBrowser.storage.local.set({ [STORAGE_KEY]: items });
      }
      // #when — 10th retry with random=1
      vi.spyOn(Math, 'random').mockReturnValue(1);
      await drain(makeConfig(), makeFailUpload('NETWORK_ERROR'));
      // #then — item removed (retryCount >= MAX_RETRIES)
      const size = await getQueueSize();
      expect(size).toBe(0);
    });

    it('removes item after MAX_RETRIES (10) attempts', async () => {
      // #given
      await enqueue(makeInput());
      // #when — drain 10 times with retryable errors
      for (let i = 0; i < 10; i++) {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        await drain(makeConfig(), makeFailUpload('SERVER_ERROR'));
        const r = await fakeBrowser.storage.local.get(STORAGE_KEY);
        const items = r[STORAGE_KEY] as Array<Record<string, unknown>>;
        if (items.length > 0) {
          items[0]!.nextRetryAt = 0;
          await fakeBrowser.storage.local.set({ [STORAGE_KEY]: items });
        }
      }
      // #then
      await drain(makeConfig(), makeFailUpload('SERVER_ERROR'));
      const size = await getQueueSize();
      expect(size).toBe(0);
    });
  });

  // --- Slice 6: drain — backoff skip ---

  describe('drain — backoff skip', () => {
    it('skips items whose nextRetryAt is in the future', async () => {
      // #given
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      await enqueue(makeInput());
      // Set nextRetryAt to future
      const r = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = r[STORAGE_KEY] as Array<Record<string, unknown>>;
      items[0]!.nextRetryAt = Date.now() + 60_000;
      await fakeBrowser.storage.local.set({ [STORAGE_KEY]: items });
      const upload = makeSuccessUpload();
      // #when
      await drain(makeConfig(), upload);
      // #then
      expect(upload).not.toHaveBeenCalled();
      const size = await getQueueSize();
      expect(size).toBe(1);
    });

    it('processes items whose nextRetryAt has passed', async () => {
      // #given
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      await enqueue(makeInput());
      const r = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = r[STORAGE_KEY] as Array<Record<string, unknown>>;
      items[0]!.nextRetryAt = Date.now() - 1;
      await fakeBrowser.storage.local.set({ [STORAGE_KEY]: items });
      // #when
      const result = await drain(makeConfig(), makeSuccessUpload());
      // #then
      expect(result.processed).toBe(1);
    });
  });

  // --- Slice 7: drain — concurrency / mutex ---

  describe('drain — concurrency', () => {
    it('returns early with remaining=-1 if already draining', async () => {
      // #given
      await enqueue(makeInput());
      let resolveUpload!: (value: SyncResult) => void;
      const slowUpload = vi.fn<UploadFn>().mockImplementation(
        () => new Promise((resolve) => { resolveUpload = resolve; }),
      );
      // #when — start drain but don't await, then start another
      const first = drain(makeConfig(), slowUpload);
      await vi.advanceTimersByTimeAsync(0);
      const second = await drain(makeConfig(), makeSuccessUpload());
      // #then
      expect(second.remaining).toBe(-1);
      resolveUpload({ success: true, data: { timestamp: Date.now(), bytesTransferred: 4 } });
      await first;
    });
  });

  // --- Slice 8: drain — empty queue ---

  describe('drain — empty queue', () => {
    it('handles empty queue gracefully', async () => {
      // #given — no items
      // #when
      const result = await drain(makeConfig(), makeSuccessUpload());
      // #then
      expect(result).toEqual({
        processed: 0,
        failed: 0,
        authFailed: 0,
        remaining: 0,
      });
    });
  });

  // --- Slice 9: CONFLICT handling ---

  describe('drain — CONFLICT', () => {
    it('removes CONFLICT items without retrying', async () => {
      // #given
      await enqueue(makeInput());
      // #when
      const result = await drain(makeConfig(), makeFailUpload('CONFLICT'));
      // #then
      expect(result.processed).toBe(1);
      expect(result.remaining).toBe(0);
    });
  });

  // --- Slice 10: blobToBase64 + roundtrip ---

  describe('blobToBase64', () => {
    it('encodes correctly and drain decodes and passes to upload', async () => {
      // #given
      const original = new Uint8Array([116, 101, 115, 116]) as EncryptedBlob;
      const encoded = blobToBase64(original);
      await enqueue(makeInput({ blob: encoded }));
      const upload = makeSuccessUpload();
      // #when
      await drain(makeConfig(), upload);
      // #then
      const calls = (upload as ReturnType<typeof vi.fn>).mock.calls;
      const passedBlob = calls[0]![1] as Uint8Array;
      expect(Array.from(passedBlob)).toEqual([116, 101, 115, 116]);
    });
  });

  // --- Slice 11: Edge cases (CodeRabbit findings) ---

  describe('edge cases', () => {
    it('filters out malformed items from corrupted storage', async () => {
      // #given — storage contains a mix of valid and invalid items
      const validItem = {
        type: 'upload',
        blob: 'dGVzdA==',
        timestamp: 1_000_000,
        retryCount: 0,
        enqueuedAt: 1_000_000,
        nextRetryAt: 0,
      };
      const malformed = [
        { type: 'upload', blob: 'dGVzdA==' },
        'not-an-object',
        null,
        { type: 'download', blob: 'x', timestamp: 1, retryCount: 0, enqueuedAt: 1, nextRetryAt: 0 },
        validItem,
      ];
      await fakeBrowser.storage.local.set({ [STORAGE_KEY]: malformed });
      // #when
      const size = await getQueueSize();
      // #then
      expect(size).toBe(1);
    });

    it('treats non-SyncError result.error as retryable', async () => {
      // #given
      await enqueue(makeInput());
      const upload = vi.fn<UploadFn>().mockResolvedValue({
        success: false,
        error: new Error('not a SyncError'),
      } as SyncResult);
      // #when
      await drain(makeConfig(), upload);
      // #then — item stays in queue with incremented retryCount
      const result = await fakeBrowser.storage.local.get(STORAGE_KEY);
      const items = result[STORAGE_KEY] as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(items[0]!.retryCount).toBe(1);
    });

    it('drain rejects if upload throws, leaving queue intact', async () => {
      // #given
      await enqueue(makeInput());
      const upload = vi.fn<UploadFn>().mockRejectedValue(new Error('network down'));
      // #when / #then
      await expect(drain(makeConfig(), upload)).rejects.toThrow('network down');
      const size = await getQueueSize();
      expect(size).toBe(1);
    });
  });

  // --- Slice 12: Module purity ---

  describe('module purity', () => {
    it('has no React/DOM imports, no console.log, no crypto.subtle', async () => {
      // #given
      const fs = await import('node:fs');
      const source = fs.readFileSync(
        'entrypoints/background/sync-queue.ts',
        'utf-8',
      );
      // #then
      expect(source).not.toMatch(/from ['"]react['"]/);
      expect(source).not.toMatch(/from ['"]react-dom['"]/);
      expect(source).not.toMatch(/\bdocument\b/);
      expect(source).not.toMatch(/\bwindow\b/);
      expect(source).not.toMatch(/\bconsole\.log\b/);
      expect(source).not.toMatch(/\bcrypto\.subtle\b/);
      expect(source).toMatch(/from ['"]wxt\/browser['"]/);
    });

    it('file is within 300-line limit', async () => {
      // #given
      const fs = await import('node:fs');
      const source = fs.readFileSync(
        'entrypoints/background/sync-queue.ts',
        'utf-8',
      );
      // #then
      const lines = source.split('\n').length;
      expect(lines).toBeLessThanOrEqual(300);
    });
  });
});
