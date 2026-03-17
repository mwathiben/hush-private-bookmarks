import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DecryptionError,
  InvalidPasswordError,
  StorageError,
  ImportError,
  DataModelError,
  SyncError,
} from '@/lib/errors';

const ROOT = resolve(process.cwd());

describe('DecryptionError', () => {
  it('is an instance of Error', () => {
    const err = new DecryptionError('decryption failed');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DecryptionError);
  });

  it('has name "DecryptionError"', () => {
    const err = new DecryptionError('test');
    expect(err.name).toBe('DecryptionError');
  });

  it('preserves message', () => {
    const err = new DecryptionError('bad ciphertext');
    expect(err.message).toBe('bad ciphertext');
  });

  it('supports cause chaining', () => {
    const cause = new Error('original');
    const err = new DecryptionError('wrapped', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('InvalidPasswordError', () => {
  it('is an instance of Error', () => {
    const err = new InvalidPasswordError('wrong password');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(InvalidPasswordError);
  });

  it('has name "InvalidPasswordError"', () => {
    const err = new InvalidPasswordError('test');
    expect(err.name).toBe('InvalidPasswordError');
  });

  it('supports cause chaining', () => {
    const cause = new Error('original');
    const err = new InvalidPasswordError('wrapped', { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('StorageError', () => {
  it('is an instance of Error', () => {
    const err = new StorageError('read failed', { key: 'bookmarks', operation: 'read' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StorageError);
  });

  it('has name "StorageError"', () => {
    const err = new StorageError('fail', { operation: 'write' });
    expect(err.name).toBe('StorageError');
  });

  it('exposes typed context', () => {
    const err = new StorageError('fail', { key: 'store', operation: 'delete' });
    expect(err.context.key).toBe('store');
    expect(err.context.operation).toBe('delete');
  });

  it('supports cause chaining', () => {
    const cause = new Error('original');
    const err = new StorageError('wrapped', { operation: 'read' }, { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('ImportError', () => {
  it('is an instance of Error', () => {
    const err = new ImportError('parse failed', { source: 'Holy PB', format: 'json' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImportError);
  });

  it('has name "ImportError"', () => {
    const err = new ImportError('fail', { source: 'Chrome' });
    expect(err.name).toBe('ImportError');
  });

  it('exposes typed context', () => {
    const err = new ImportError('fail', { source: 'Holy PB', format: 'html' });
    expect(err.context.source).toBe('Holy PB');
    expect(err.context.format).toBe('html');
  });

  it('supports cause chaining', () => {
    const cause = new Error('original');
    const err = new ImportError('wrapped', { format: 'json' }, { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('DataModelError', () => {
  it('is an instance of Error', () => {
    const err = new DataModelError('path invalid', { kind: 'invalid_path', path: [-1] });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DataModelError);
  });

  it('has name "DataModelError"', () => {
    const err = new DataModelError('test', { kind: 'path_not_found' });
    expect(err.name).toBe('DataModelError');
  });

  it('exposes typed context with kind and path', () => {
    const err = new DataModelError('not found', { kind: 'path_not_found', path: [0, 2, 1] });
    expect(err.context.kind).toBe('path_not_found');
    expect(err.context.path).toEqual([0, 2, 1]);
  });

  it('supports cause chaining', () => {
    const cause = new Error('original');
    const err = new DataModelError('wrapped', { kind: 'type_mismatch' }, { cause });
    expect(err.cause).toBe(cause);
  });
});

describe('SyncError', () => {
  it('is an instance of Error', () => {
    const err = new SyncError('sync failed', { code: 'NETWORK_ERROR' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SyncError);
  });

  it('has name "SyncError"', () => {
    const err = new SyncError('test', { code: 'AUTH_FAILED' });
    expect(err.name).toBe('SyncError');
  });

  it('exposes typed context with code', () => {
    const err = new SyncError('server down', { code: 'SERVER_ERROR' });
    expect(err.context.code).toBe('SERVER_ERROR');
  });

  it('accepts empty context', () => {
    const err = new SyncError('unknown', {});
    expect(err.context.code).toBeUndefined();
  });

  it('supports cause chaining', () => {
    const cause = new Error('original');
    const err = new SyncError('wrapped', { code: 'TIMEOUT' }, { cause });
    expect(err.cause).toBe(cause);
  });

  it('accepts CONFLICT code', () => {
    const err = new SyncError('conflict detected', { code: 'CONFLICT' });
    expect(err.context.code).toBe('CONFLICT');
  });
});

describe('lib/errors.ts module purity', () => {
  it('has zero React/DOM imports', () => {
    const content = readFileSync(resolve(ROOT, 'lib/errors.ts'), 'utf-8');
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(content).not.toContain('document.');
    expect(content).not.toContain('window.');
  });

  it('has zero browser.storage references', () => {
    const content = readFileSync(resolve(ROOT, 'lib/errors.ts'), 'utf-8');
    expect(content).not.toContain('browser.storage');
    expect(content).not.toContain('chrome.storage');
  });
});
