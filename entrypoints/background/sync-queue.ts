import { browser } from 'wxt/browser';
import type { EncryptedBlob, SyncConfig, SyncResult } from '@/lib/sync-types';
import { SyncError } from '@/lib/errors';

const STORAGE_KEY = 'hush_sync_queue';
const MAX_QUEUE_DEPTH = 50;
const MAX_RETRIES = 10;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 300_000;

export interface EnqueueInput {
  readonly type: 'upload';
  readonly blob: string;
  readonly timestamp: number;
}

export interface DrainResult {
  readonly processed: number;
  readonly failed: number;
  readonly authFailed: number;
  readonly remaining: number;
}

export type UploadFn = (
  config: SyncConfig,
  blob: EncryptedBlob,
  timestamp: number,
) => Promise<SyncResult>;

interface QueueItem {
  readonly type: 'upload';
  readonly blob: string;
  readonly timestamp: number;
  retryCount: number;
  readonly enqueuedAt: number;
  nextRetryAt: number;
}

let storageLock: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = storageLock.then(fn, fn);
  storageLock = next.then(() => {}, () => {});
  return next;
}

function isQueueItem(value: unknown): value is QueueItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === 'upload' &&
    typeof v.blob === 'string' &&
    typeof v.timestamp === 'number' &&
    typeof v.retryCount === 'number' &&
    typeof v.enqueuedAt === 'number' &&
    typeof v.nextRetryAt === 'number'
  );
}

async function readQueue(): Promise<QueueItem[]> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isQueueItem);
}

async function writeQueue(items: QueueItem[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: items });
}

function calculateBackoffMs(retryCount: number): number {
  const maxDelay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** retryCount);
  return Math.floor(Math.random() * maxDelay);
}

function uint8ArrayToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return globalThis.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function enqueue(input: EnqueueInput): Promise<number> {
  return withLock(async () => {
    const items = await readQueue();
    const item: QueueItem = {
      type: input.type,
      blob: input.blob,
      timestamp: input.timestamp,
      retryCount: 0,
      enqueuedAt: Date.now(),
      nextRetryAt: 0,
    };
    items.push(item);
    if (items.length > MAX_QUEUE_DEPTH) {
      items.splice(0, items.length - MAX_QUEUE_DEPTH);
    }
    await writeQueue(items);
    return items.length;
  });
}

export async function getQueueSize(): Promise<number> {
  return withLock(async () => {
    const items = await readQueue();
    return items.length;
  });
}

export async function clearQueue(): Promise<void> {
  return withLock(async () => {
    await browser.storage.local.remove(STORAGE_KEY);
  });
}

let draining = false;

export async function drain(
  config: SyncConfig,
  upload: UploadFn,
): Promise<DrainResult> {
  if (draining) {
    return { processed: 0, failed: 0, authFailed: 0, remaining: -1 };
  }

  draining = true;
  try {
    return await withLock(async () => {
      const items = await readQueue();
      if (items.length === 0) {
        return { processed: 0, failed: 0, authFailed: 0, remaining: 0 };
      }

      let processed = 0;
      let failed = 0;
      let authFailed = 0;
      const toRemove = new Set<number>();
      const now = Date.now();

      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;

        if (item.nextRetryAt > now) continue;

        const blob = base64ToUint8Array(item.blob) as EncryptedBlob;
        const result = await upload(config, blob, item.timestamp);

        if (result.success) {
          toRemove.add(i);
          processed++;
          continue;
        }

        const error = result.error;
        if (error instanceof SyncError) {
          const code = error.context.code;

          if (code === 'AUTH_FAILED') {
            toRemove.add(i);
            authFailed++;
            continue;
          }

          if (code === 'CONFLICT') {
            toRemove.add(i);
            processed++;
            continue;
          }

          item.retryCount++;
          if (item.retryCount >= MAX_RETRIES) {
            toRemove.add(i);
            failed++;
            continue;
          }

          item.nextRetryAt = now + calculateBackoffMs(item.retryCount);
          break;
        }

        item.retryCount++;
        if (item.retryCount >= MAX_RETRIES) {
          toRemove.add(i);
          failed++;
          continue;
        }
        item.nextRetryAt = now + calculateBackoffMs(item.retryCount);
        break;
      }

      const remaining = items.filter((_, idx) => !toRemove.has(idx));
      await writeQueue(remaining);

      return {
        processed,
        failed,
        authFailed,
        remaining: remaining.length,
      };
    });
  } finally {
    draining = false;
  }
}

export function blobToBase64(blob: EncryptedBlob): string {
  return uint8ArrayToBase64(blob);
}

export function _resetForTesting(): void {
  draining = false;
  storageLock = Promise.resolve();
}
