/** Thrown when AES-GCM decryption fails (wrong key, corrupted data, or tampered ciphertext). */
export class DecryptionError extends Error {
  readonly name = 'DecryptionError' as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** Thrown when the provided password doesn't match the encrypted store's key. */
export class InvalidPasswordError extends Error {
  readonly name = 'InvalidPasswordError' as const;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** Operation metadata for storage errors. Never contains user data — keys only. */
export interface StorageErrorContext {
  readonly key?: string;
  readonly operation?: 'read' | 'write' | 'delete';
  readonly reason?:
    | 'not_found'
    | 'corrupted'
    | 'quota_exceeded'
    | 'write_failed'
    | 'read_failed';
}

/** Thrown when extension storage operations fail. Context is operation metadata, never PII. */
export class StorageError extends Error {
  readonly name = 'StorageError' as const;
  readonly context: StorageErrorContext;

  constructor(
    message: string,
    context: StorageErrorContext,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.context = context;
  }
}

/** Import source metadata. Identifies the source format, never bookmark content. */
export interface ImportErrorContext {
  readonly source?: string;
  readonly format?: string;
}

/** Thrown when bookmark import/migration fails. Context identifies source, not content. */
export class ImportError extends Error {
  readonly name = 'ImportError' as const;
  readonly context: ImportErrorContext;

  constructor(
    message: string,
    context: ImportErrorContext,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.context = context;
  }
}

/** Recovery operation metadata. Identifies failure reason, never mnemonic words or key material. */
export interface RecoveryErrorContext {
  readonly reason: 'invalid_blob';
}

/** Thrown when recovery blob operations fail. Context is structural, never PII. */
export class RecoveryError extends Error {
  readonly name = 'RecoveryError' as const;
  readonly context: RecoveryErrorContext;

  constructor(
    message: string,
    context: RecoveryErrorContext,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.context = context;
  }
}

/** Sync operation metadata. Identifies failure mode, never PII or auth tokens. */
export interface SyncErrorContext {
  readonly code?: 'AUTH_FAILED' | 'CONFLICT' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'TIMEOUT';
}

/** Thrown when sync operations fail. Context identifies failure mode, never user data. */
export class SyncError extends Error {
  readonly name = 'SyncError' as const;
  readonly context: SyncErrorContext;

  constructor(
    message: string,
    context: SyncErrorContext,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.context = context;
  }
}

/** Path and kind metadata for data model errors. Never contains bookmark content. */
export interface DataModelErrorContext {
  readonly kind:
    | 'path_not_found'
    | 'invalid_path'
    | 'type_mismatch'
    | 'cycle_detected';
  readonly path?: readonly number[];
}

/** Thrown when tree traversal or CRUD operations fail. Context is structural, never PII. */
export class DataModelError extends Error {
  readonly name = 'DataModelError' as const;
  readonly context: DataModelErrorContext;

  constructor(
    message: string,
    context: DataModelErrorContext,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.context = context;
  }
}
