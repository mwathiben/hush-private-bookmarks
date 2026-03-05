// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  Bookmark,
  Folder,
  BookmarkNode,
  BookmarkTree,
  EncryptedStore,
  PasswordSet,
  RecoveryPhrase,
  CryptoConfig,
  Result,
} from '@/lib/types';

import {
  DecryptionError,
  InvalidPasswordError,
  StorageError,
  ImportError,
} from '@/lib/errors';

import type { StorageErrorContext, ImportErrorContext } from '@/lib/errors';

import {
  SENTRY_DSN,
  stripPii,
  getFilteredIntegrations,
  initSentry,
  captureException,
  getSentryScope,
} from '@/lib/sentry';

import { cn } from '@/lib/utils';

import {
  CRYPTO_CONFIG,
  encrypt,
  decrypt,
  deriveKey,
  generateSalt,
  verifyPassword,
} from '@/lib/crypto';

import {
  STORAGE_KEY,
  RETRY_CONFIG,
  DEFAULT_STORAGE_QUOTA,
  validateEncryptedStore,
  saveEncryptedData,
  loadEncryptedData,
  hasData,
  clearAll,
  getStorageUsage,
} from '@/lib/storage';

import {
  isBookmark,
  isFolder,
  generateId,
  createEmptyTree,
  getItemByPath,
  findItemPath,
  addBookmark,
  addFolder,
  removeItem,
  updateBookmark,
  renameFolder,
  moveItem,
} from '@/lib/data-model';

const ROOT = resolve(process.cwd());

const LIB_MODULES = ['types.ts', 'errors.ts', 'sentry.ts', 'utils.ts', 'crypto.ts', 'storage.ts', 'data-model.ts'];

describe('scaffold integration: lib/ imports resolve', () => {
  it('all lib/ modules exist on disk', () => {
    for (const mod of LIB_MODULES) {
      expect(existsSync(resolve(ROOT, 'lib', mod))).toBe(true);
    }
  });

  it('types exports instantiate correctly', () => {
    const bookmark: Bookmark = {
      type: 'bookmark',
      id: 'x',
      title: 't',
      url: 'https://x.com',
      dateAdded: 0,
    };
    expect(bookmark.type).toBe('bookmark');

    const folder: Folder = {
      type: 'folder',
      id: 'f1',
      name: 'dir',
      children: [],
      dateAdded: 0,
    };
    expect(folder.type).toBe('folder');

    const node: BookmarkNode = bookmark;
    expect(node.type).toBe('bookmark');
  });

  it('error classes instantiate correctly', () => {
    expect(new DecryptionError('test')).toBeInstanceOf(Error);
    expect(new InvalidPasswordError('test')).toBeInstanceOf(Error);
    expect(new StorageError('test', { operation: 'read' })).toBeInstanceOf(Error);
    expect(new ImportError('test', { source: 'x' })).toBeInstanceOf(Error);
  });

  it('sentry exports are callable', () => {
    expect(typeof SENTRY_DSN).toBe('string');
    expect(typeof stripPii).toBe('function');
    expect(typeof getFilteredIntegrations).toBe('function');
    expect(typeof initSentry).toBe('function');
    expect(typeof captureException).toBe('function');
    expect(typeof getSentryScope).toBe('function');
  });

  it('crypto exports are callable', () => {
    expect(typeof CRYPTO_CONFIG).toBe('object');
    expect(typeof encrypt).toBe('function');
    expect(typeof decrypt).toBe('function');
    expect(typeof deriveKey).toBe('function');
    expect(typeof generateSalt).toBe('function');
    expect(typeof verifyPassword).toBe('function');
  });

  it('storage exports are callable', () => {
    expect(typeof STORAGE_KEY).toBe('string');
    expect(typeof RETRY_CONFIG).toBe('object');
    expect(typeof DEFAULT_STORAGE_QUOTA).toBe('number');
    expect(typeof validateEncryptedStore).toBe('function');
    expect(typeof saveEncryptedData).toBe('function');
    expect(typeof loadEncryptedData).toBe('function');
    expect(typeof hasData).toBe('function');
    expect(typeof clearAll).toBe('function');
    expect(typeof getStorageUsage).toBe('function');
  });

  it('data-model exports are callable', () => {
    expect(typeof isBookmark).toBe('function');
    expect(typeof isFolder).toBe('function');
    expect(typeof generateId).toBe('function');
    expect(typeof createEmptyTree).toBe('function');
    expect(typeof getItemByPath).toBe('function');
    expect(typeof findItemPath).toBe('function');
    expect(typeof addBookmark).toBe('function');
    expect(typeof addFolder).toBe('function');
    expect(typeof removeItem).toBe('function');
    expect(typeof updateBookmark).toBe('function');
    expect(typeof renameFolder).toBe('function');
    expect(typeof moveItem).toBe('function');
  });

  it('cn utility merges classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

const BROWSER_STORAGE_ALLOWED = new Set(['storage.ts']);

describe('scaffold integration: lib/ module purity', () => {
  for (const mod of LIB_MODULES) {
    describe(mod, () => {
      const content = readFileSync(resolve(ROOT, 'lib', mod), 'utf-8');

      it('has zero React/DOM imports', () => {
        expect(content).not.toMatch(/from\s+['"]react['"]/);
        expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
      });

      it('has zero direct browser.storage access', () => {
        if (BROWSER_STORAGE_ALLOWED.has(mod)) return;
        expect(content).not.toContain('browser.storage');
        expect(content).not.toContain('chrome.storage');
      });

      it('has zero type suppressions', () => {
        expect(content).not.toContain('as any');
        expect(content).not.toContain('@ts-ignore');
      });

      it('has zero console.log', () => {
        expect(content).not.toMatch(/console\.log/);
      });
    });
  }
});

describe('scaffold integration: type composition', () => {
  it('PasswordSet.store is EncryptedStore', () => {
    const store: EncryptedStore = {
      salt: 's',
      encrypted: 'e',
      iv: 'i',
      iterations: 600_000,
    };
    const ps: PasswordSet = { id: '1', name: 'n', store, createdAt: 0 };
    expect(ps.store.iterations).toBe(600_000);
  });

  it('Folder.children accepts BookmarkNode[]', () => {
    const tree: BookmarkTree = {
      type: 'folder',
      id: 'root',
      name: 'Root',
      dateAdded: 0,
      children: [
        {
          type: 'bookmark',
          id: 'b1',
          title: 't',
          url: 'https://x.com',
          dateAdded: 0,
        },
        {
          type: 'folder',
          id: 'f1',
          name: 'sub',
          children: [],
          dateAdded: 0,
        },
      ],
    };
    expect(tree.children).toHaveLength(2);
  });

  it('Result narrows correctly with custom error types', () => {
    const ok: Result<string> = { success: true, data: 'ok' };
    const err: Result<string> = {
      success: false,
      error: new DecryptionError('fail'),
    };
    if (ok.success) expect(ok.data).toBe('ok');
    if (!err.success) expect(err.error).toBeInstanceOf(DecryptionError);
  });

  it('RecoveryPhrase holds BIP-39 word array', () => {
    const rp: RecoveryPhrase = {
      words: Array.from({ length: 12 }, () => 'word'),
      derivedKeyHash: 'hash',
    };
    expect(rp.words).toHaveLength(12);
  });

  it('CryptoConfig has correct field types', () => {
    const config: CryptoConfig = {
      iterations: 600_000,
      algorithm: 'AES-256-GCM',
      keyLength: 256,
      ivLength: 12,
      hashAlgorithm: 'SHA-256',
    };
    expect(typeof config.iterations).toBe('number');
    expect(typeof config.algorithm).toBe('string');
    expect(typeof config.keyLength).toBe('number');
    expect(typeof config.ivLength).toBe('number');
    expect(typeof config.hashAlgorithm).toBe('string');
  });
});

describe('scaffold integration: error class properties', () => {
  it('all error classes have readonly name', () => {
    expect(new DecryptionError('x').name).toBe('DecryptionError');
    expect(new InvalidPasswordError('x').name).toBe('InvalidPasswordError');
    expect(new StorageError('x', {}).name).toBe('StorageError');
    expect(new ImportError('x', {}).name).toBe('ImportError');
  });

  it('error classes support cause chaining', () => {
    const cause = new Error('root');
    expect(new DecryptionError('x', { cause }).cause).toBe(cause);
    expect(new InvalidPasswordError('x', { cause }).cause).toBe(cause);
    expect(new StorageError('x', {}, { cause }).cause).toBe(cause);
    expect(new ImportError('x', {}, { cause }).cause).toBe(cause);
  });

  it('StorageError exposes typed context', () => {
    const ctx: StorageErrorContext = { key: 'k', operation: 'write' };
    expect(new StorageError('x', ctx).context).toEqual(ctx);
  });

  it('ImportError exposes typed context', () => {
    const ctx: ImportErrorContext = { source: 's', format: 'json' };
    expect(new ImportError('x', ctx).context).toEqual(ctx);
  });
});

describe('scaffold integration: imports lib/ modules successfully', () => {
  it('all lib/ modules imported successfully without hanging', () => {
    expect(LIB_MODULES).toHaveLength(7);
  });
});

describe('scaffold integration: .gitignore hygiene', () => {
  it('gitignores .env files', () => {
    const content = readFileSync(resolve(ROOT, '.gitignore'), 'utf-8');
    expect(content).toMatch(/^\.env/m);
  });
});

describe('scaffold integration: package.json scripts', () => {
  const pkg = JSON.parse(
    readFileSync(resolve(ROOT, 'package.json'), 'utf-8'),
  );

  it('has verify script with all four checks', () => {
    expect(pkg.scripts.verify).toBeDefined();
    expect(pkg.scripts.verify).toContain('tsc --noEmit');
    expect(pkg.scripts.verify).toContain('eslint');
    expect(pkg.scripts.verify).toContain('vitest');
    expect(pkg.scripts.verify).toContain('wxt build');
  });

  it('has test:e2e script', () => {
    expect(pkg.scripts['test:e2e']).toBe('playwright test');
  });
});
