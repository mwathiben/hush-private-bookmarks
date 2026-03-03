import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CRYPTO_CONFIG,
  decrypt,
  deriveKey,
  encrypt,
  generateSalt,
  verifyPassword,
} from '@/lib/crypto';
import { DecryptionError, InvalidPasswordError } from '@/lib/errors';
import type { EncryptedStore } from '@/lib/types';

afterEach(() => {
  vi.restoreAllMocks();
});

const ROOT = resolve(process.cwd());

function corruptBase64(original: string): string {
  const bytes = Uint8Array.from(atob(original), (c) => c.charCodeAt(0));
  bytes[0] = bytes[0]! ^ 0xff;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

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

    await expect(decrypt(store, 'wrong-password')).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
    await expect(decrypt(store, 'wrong-password')).rejects.toThrow(
      'Decryption failed: wrong password or corrupted data',
    );
  });

  it('throws DecryptionError for non-OperationError decrypt failures', async () => {
    const store = await encrypt('test data', 'password');

    vi.spyOn(crypto.subtle, 'decrypt').mockRejectedValueOnce(
      new TypeError('mock internal failure'),
    );

    await expect(decrypt(store, 'password')).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('throws DecryptionError when decrypted data is not valid UTF-8', async () => {
    const store = await encrypt('test data', 'password');

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

    await expect(
      verifyPassword(badStore, 'any-password'),
    ).rejects.toBeInstanceOf(DecryptionError);
  });
});

describe('decrypt with corrupted store fields', () => {
  let store: EncryptedStore;

  beforeAll(async () => {
    store = await encrypt('test data for corruption', 'password');
  });

  it('throws InvalidPasswordError for corrupted ciphertext (valid base64)', async () => {
    const corrupted: EncryptedStore = {
      ...store,
      encrypted: corruptBase64(store.encrypted),
    };

    await expect(decrypt(corrupted, 'password')).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
  });

  it('throws InvalidPasswordError for corrupted IV (valid base64)', async () => {
    const corrupted: EncryptedStore = {
      ...store,
      iv: corruptBase64(store.iv),
    };

    await expect(decrypt(corrupted, 'password')).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
  });

  it('throws InvalidPasswordError for corrupted salt (valid base64)', async () => {
    const corrupted: EncryptedStore = {
      ...store,
      salt: corruptBase64(store.salt),
    };

    await expect(decrypt(corrupted, 'password')).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
  });
});

describe('error cause chain', () => {
  it('InvalidPasswordError from wrong password has OperationError cause', async () => {
    const store = await encrypt('test data', 'correct');

    try {
      await decrypt(store, 'wrong');
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPasswordError);
      expect((error as InvalidPasswordError).cause).toBeInstanceOf(Error);
      expect((error as InvalidPasswordError).cause).toHaveProperty(
        'name',
        'OperationError',
      );
    }
  });

  it('DecryptionError from invalid base64 has Error cause', async () => {
    const badStore: EncryptedStore = {
      salt: '!!!not-base64!!!',
      iv: 'also-bad',
      encrypted: 'nope',
      iterations: 600_000,
    };

    try {
      await decrypt(badStore, 'any');
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DecryptionError);
      expect((error as DecryptionError).cause).toBeInstanceOf(Error);
    }
  });

  it('DecryptionError from non-OperationError preserves original cause', async () => {
    const store = await encrypt('test data', 'password');
    const mockError = new TypeError('mock internal failure');

    vi.spyOn(crypto.subtle, 'decrypt').mockRejectedValueOnce(mockError);

    try {
      await decrypt(store, 'password');
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DecryptionError);
      expect((error as DecryptionError).cause).toBe(mockError);
    }
  });

  it('DecryptionError from invalid UTF-8 has Error cause', async () => {
    const store = await encrypt('test data', 'password');

    vi.spyOn(TextDecoder.prototype, 'decode').mockImplementationOnce(() => {
      throw new TypeError('The encoded data was not valid');
    });

    try {
      await decrypt(store, 'password');
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DecryptionError);
      expect((error as DecryptionError).cause).toBeInstanceOf(Error);
      expect((error as DecryptionError).cause).toHaveProperty(
        'message',
        'The encoded data was not valid',
      );
    }
  });
});

describe('error message safety', () => {
  it('error messages do not contain the password string', async () => {
    const password = 'super-secret-p@ssw0rd-12345';
    const store = await encrypt('sensitive data', password);

    try {
      await decrypt(store, 'wrong-password');
      expect.fail('should have thrown');
    } catch (error) {
      const err = error as InvalidPasswordError;
      expect(err.message).not.toContain(password);
      expect(err.message).not.toContain('wrong-password');
      expect(String(err.cause)).not.toContain(password);
      expect(String(err.cause)).not.toContain('wrong-password');
    }
  });

  it('error messages do not contain key material representations', async () => {
    const store = await encrypt('data', 'password');

    try {
      await decrypt(store, 'wrong');
      expect.fail('should have thrown');
    } catch (error) {
      const msg = (error as Error).message;
      expect(msg).not.toMatch(/CryptoKey/);
      expect(msg).not.toMatch(/Uint8Array/);
      expect(msg).not.toMatch(/\[object ArrayBuffer\]/);
    }
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
