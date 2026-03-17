import type { Result } from '@/lib/types';
import type { SyncError } from '@/lib/errors';

/**
 * Contract for Pro features that support cross-device sync.
 * serialize() returns PLAINTEXT data — encryption is the caller's responsibility.
 * The background sync handler must encrypt via crypto.ts BEFORE passing to sync-client.
 */
export interface SyncableFeature {
  readonly featureId: string;
  serialize(): Promise<Uint8Array<ArrayBuffer>>;
  deserialize(data: Uint8Array<ArrayBuffer>): Promise<void>;
  requiresServer(): boolean;
}

export interface SyncConfig {
  readonly backendUrl: string;
  readonly authToken: string;
  readonly syncIntervalMs: number;
}

export type SyncStatus = {
  readonly state: 'idle' | 'syncing' | 'error' | 'offline' | 'not_configured';
  readonly lastSyncAt: number | null;
  readonly error?: string;
};

export type SyncResult = Result<
  { readonly timestamp: number; readonly bytesTransferred: number },
  SyncError
>;

export interface SyncConflict {
  readonly local: Uint8Array<ArrayBuffer>;
  readonly remote: Uint8Array<ArrayBuffer>;
  readonly localTimestamp: number;
  readonly remoteTimestamp: number;
}
