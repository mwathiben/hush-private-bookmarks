import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CRYPTO_CONFIG,
  decrypt,
  deriveKey,
  encrypt,
  generateSalt,
  verifyPassword,
} from '@/lib/crypto';
import type { EncryptedStore } from '@/lib/types';

afterEach(() => {
  vi.restoreAllMocks();
});

const ROOT = resolve(process.cwd());

describe('encrypt/decrypt roundtrip', () => {
  it('encrypts and decrypts back to original plaintext', async () => {
    const plaintext = 'Hello, Hush Private Bookmarks!';
    const password = 'test-password-123';

    const store: EncryptedStore = await encrypt(plaintext, password);
    const result: string = await decrypt(store, password);

    expect(result).toBe(plaintext);
  });
});

describe('CRYPTO_CONFIG constants', () => {
  it('PBKDF2 iterations are >= 600,000', () => {
    expect(CRYPTO_CONFIG.iterations).toBeGreaterThanOrEqual(600_000);
  });

  it('algorithm is AES-GCM', () => {
    expect(CRYPTO_CONFIG.algorithm).toBe('AES-GCM');
  });

  it('keyLength is 256', () => {
    expect(CRYPTO_CONFIG.keyLength).toBe(256);
  });

  it('ivLength is 12', () => {
    expect(CRYPTO_CONFIG.ivLength).toBe(12);
  });

  it('hashAlgorithm is SHA-256', () => {
    expect(CRYPTO_CONFIG.hashAlgorithm).toBe('SHA-256');
  });
});

describe('module exports', () => {
  it('exports encrypt as async function', () => {
    expect(typeof encrypt).toBe('function');
  });

  it('exports decrypt as async function', () => {
    expect(typeof decrypt).toBe('function');
  });

  it('exports verifyPassword as async function', () => {
    expect(typeof verifyPassword).toBe('function');
  });

  it('exports deriveKey as async function', () => {
    expect(typeof deriveKey).toBe('function');
  });

  it('exports generateSalt as function', () => {
    expect(typeof generateSalt).toBe('function');
  });

  it('exports CRYPTO_CONFIG as object', () => {
    expect(typeof CRYPTO_CONFIG).toBe('object');
    expect(CRYPTO_CONFIG).not.toBeNull();
  });
});

describe('decrypt error handling', () => {
  it('throws InvalidPasswordError on wrong password', async () => {
    const store = await encrypt('secret data', 'correct-password');

    await expect(decrypt(store, 'wrong-password')).rejects.toThrow(
      'Decryption failed: wrong password or corrupted data',
    );

    try {
      await decrypt(store, 'wrong-password');
    } catch (error) {
      const { InvalidPasswordError } = await import('@/lib/errors');
      expect(error).toBeInstanceOf(InvalidPasswordError);
    }
  });

  it('throws DecryptionError for non-OperationError decrypt failures', async () => {
    const store = await encrypt('test data', 'password');
    const { DecryptionError } = await import('@/lib/errors');

    vi.spyOn(crypto.subtle, 'decrypt').mockRejectedValueOnce(
      new TypeError('mock internal failure'),
    );

    await expect(decrypt(store, 'password')).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('throws DecryptionError when decrypted data is not valid UTF-8', async () => {
    const store = await encrypt('test data', 'password');
    const { DecryptionError } = await import('@/lib/errors');

    vi.spyOn(TextDecoder.prototype, 'decode').mockImplementationOnce(() => {
      throw new TypeError('The encoded data was not valid');
    });

    await expect(decrypt(store, 'password')).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('throws DecryptionError on invalid base64 in store', async () => {
    const badStore: EncryptedStore = {
      salt: '!!!not-base64!!!',
      iv: 'also-bad',
      encrypted: 'nope',
      iterations: 600_000,
    };

    const { DecryptionError } = await import('@/lib/errors');
    await expect(decrypt(badStore, 'any-password')).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });
});

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const store = await encrypt('test data', 'my-password');
    const result = await verifyPassword(store, 'my-password');
    expect(result).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const store = await encrypt('test data', 'my-password');
    const result = await verifyPassword(store, 'wrong-password');
    expect(result).toBe(false);
  });

  it('re-throws non-InvalidPasswordError errors', async () => {
    const badStore: EncryptedStore = {
      salt: '!!!not-base64!!!',
      iv: 'also-bad',
      encrypted: 'nope',
      iterations: 600_000,
    };

    const { DecryptionError } = await import('@/lib/errors');
    await expect(
      verifyPassword(badStore, 'any-password'),
    ).rejects.toBeInstanceOf(DecryptionError);
  });
});

describe('lib/crypto.ts module purity', () => {
  const content = readFileSync(resolve(ROOT, 'lib/crypto.ts'), 'utf-8');

  it('has zero React/DOM imports', () => {
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(content).not.toContain('document.');
    expect(content).not.toContain('window.');
  });

  it('has zero extension storage references', () => {
    expect(content).not.toContain('chrome.storage');
  });

  it('has zero module-level let declarations', () => {
    const lines = content.split('\n');
    const moduleLevelLets = lines.filter((line) => {
      const trimmed = line.trimStart();
      return (
        trimmed.startsWith('let ') &&
        line.length - trimmed.length === 0
      );
    });
    expect(moduleLevelLets).toHaveLength(0);
  });

  it('has zero console.log statements', () => {
    expect(content).not.toMatch(/console\.(log|warn|error|info|debug)/);
  });

  it('has zero type suppressions', () => {
    expect(content).not.toContain('as any');
    expect(content).not.toContain('@ts-ignore');
    expect(content).not.toContain('@ts-expect-error');
  });

  it('has zero empty catch blocks', () => {
    expect(content).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
  });

  it('uses no Math.random()', () => {
    expect(content).not.toContain('Math.random');
  });

  it('has no setTimeout or setInterval', () => {
    expect(content).not.toContain('setTimeout');
    expect(content).not.toContain('setInterval');
  });
});
