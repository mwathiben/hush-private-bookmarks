import type { Result } from '@/lib/types';
import type { SyncError, SyncErrorContext } from '@/lib/errors';

/** Branded Uint8Array for plaintext data before encryption. */
export type PlaintextBlob = Uint8Array<ArrayBuffer> & { readonly __brand: 'PlaintextBlob' };

/** Branded Uint8Array for encrypted data ready for transport. */
export type EncryptedBlob = Uint8Array<ArrayBuffer> & { readonly __brand: 'EncryptedBlob' };

/**
 * Contract for Pro features that support cross-device sync.
 * serialize() returns PLAINTEXT data — encryption is the caller's responsibility.
 * The background sync handler must encrypt via crypto.ts BEFORE passing to sync-client.
 */
export interface SyncableFeature {
  readonly featureId: string;
  serialize(): Promise<PlaintextBlob>;
  deserialize(data: PlaintextBlob): Promise<void>;
  requiresServer(): boolean;
}

export interface SyncConfig {
  readonly backendUrl: string;
  readonly authToken: string;
  readonly syncIntervalMs: number;
}

export type SyncStatus =
  | { readonly state: 'idle'; readonly lastSyncAt: number }
  | { readonly state: 'syncing'; readonly lastSyncAt: number | null }
  | { readonly state: 'error'; readonly lastSyncAt: number | null; readonly error: NonNullable<SyncErrorContext['code']> }
  | { readonly state: 'offline'; readonly lastSyncAt: number | null }
  | { readonly state: 'not_configured' };

export type SyncResult = Result<
  { readonly timestamp: number; readonly bytesTransferred: number },
  SyncError
>;

export interface SyncConflict {
  readonly featureId: string;
  readonly local: EncryptedBlob;
  readonly remote: EncryptedBlob;
  readonly localTimestamp: number;
  readonly remoteTimestamp: number;
}
