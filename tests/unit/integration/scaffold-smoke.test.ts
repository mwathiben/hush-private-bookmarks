// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  Bookmark,
  Folder,
  BookmarkNode,
  BookmarkTree,
  PasswordSetInfo,
  PasswordSetManifest,
  RecoveryMetadata,
  CryptoConfig,
  Result,
} from '@/lib/types';

import {
  DecryptionError,
  InvalidPasswordError,
  StorageError,
  ImportError,
  RecoveryError,
} from '@/lib/errors';

import type { StorageErrorContext, ImportErrorContext, RecoveryErrorContext } from '@/lib/errors';

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
  normalizeTree,
  collectAllUrls,
  countBookmarks,
  flattenTree,
  MAX_TREE_DEPTH,
} from '@/lib/data-model';

import { convertChromeBookmarks, parseHtmlBookmarks } from '@/lib/bookmark-import';
import type { ChromeBookmarkTreeNode, ImportStats } from '@/lib/bookmark-import';
import { BACKUP_VERSION, exportEncryptedBackup, importEncryptedBackup } from '@/lib/bookmark-backup';

import {
  MANIFEST_KEY,
  MANIFEST_VERSION,
  setStorageKey,
  validateManifest,
  loadManifest,
  createSet,
  deleteSet,
  renameSet,
  listSets,
  saveSetData,
  loadSetData,
  hasSetData,
  getActiveSetId,
  setActiveSetId,
} from '@/lib/password-sets';

import {
  generateMnemonic,
  validateMnemonic,
  deriveRecoveryPassword,
  createRecoveryBlob,
  recoverFromBlob,
  recoveryStorageKey,
  RECOVERY_KEY_PREFIX,
} from '@/lib/recovery';

import {
  determineMode,
  shouldAutoUnlock,
  getIncognitoMessage,
  INCOGNITO_MESSAGES,
} from '@/lib/incognito';
import type { IncognitoState, IncognitoMode, IncognitoConfig } from '@/lib/incognito';

import type {
  BackgroundMessage,
  BackgroundResponse,
  SessionState,
  MessageType,
} from '@/lib/background-types';

const ROOT = resolve(process.cwd());

const LIB_MODULES = ['types.ts', 'errors.ts', 'sentry.ts', 'utils.ts', 'crypto.ts', 'storage.ts', 'data-model.ts', 'bookmark-import.ts', 'bookmark-backup.ts', 'password-sets.ts', 'recovery.ts', 'incognito.ts', 'background-types.ts'];

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
    expect(typeof normalizeTree).toBe('function');
    expect(typeof collectAllUrls).toBe('function');
    expect(typeof countBookmarks).toBe('function');
    expect(typeof flattenTree).toBe('function');
    expect(typeof MAX_TREE_DEPTH).toBe('number');
    expect(MAX_TREE_DEPTH).toBe(100);
  });

  it('cn utility merges classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('bookmark-import exports are callable', () => {
    expect(typeof convertChromeBookmarks).toBe('function');
    expect(typeof parseHtmlBookmarks).toBe('function');
    const node: ChromeBookmarkTreeNode = { id: '1', title: 'test' };
    expect(node.id).toBe('1');
    const stats: ImportStats = { bookmarksImported: 0, foldersImported: 0, errors: [] };
    expect(stats.bookmarksImported).toBe(0);
  });

  it('bookmark-backup exports are callable', () => {
    expect(typeof exportEncryptedBackup).toBe('function');
    expect(typeof importEncryptedBackup).toBe('function');
    expect(BACKUP_VERSION).toBe(1);
  });

  it('password-sets exports are callable', () => {
    expect(typeof MANIFEST_KEY).toBe('string');
    expect(typeof MANIFEST_VERSION).toBe('number');
    expect(typeof setStorageKey).toBe('function');
    expect(typeof validateManifest).toBe('function');
    expect(typeof loadManifest).toBe('function');
    expect(typeof createSet).toBe('function');
    expect(typeof deleteSet).toBe('function');
    expect(typeof renameSet).toBe('function');
    expect(typeof listSets).toBe('function');
    expect(typeof saveSetData).toBe('function');
    expect(typeof loadSetData).toBe('function');
    expect(typeof hasSetData).toBe('function');
    expect(typeof getActiveSetId).toBe('function');
    expect(typeof setActiveSetId).toBe('function');
    expect(MANIFEST_VERSION).toBe(1);
  });

  it('recovery exports are callable', () => {
    expect(typeof generateMnemonic).toBe('function');
    expect(typeof validateMnemonic).toBe('function');
    expect(typeof deriveRecoveryPassword).toBe('function');
    expect(typeof createRecoveryBlob).toBe('function');
    expect(typeof recoverFromBlob).toBe('function');
    expect(typeof recoveryStorageKey).toBe('function');
    expect(typeof RECOVERY_KEY_PREFIX).toBe('string');
    expect(RECOVERY_KEY_PREFIX).toBe('hush_recovery_');
  });

  it('incognito exports are callable', () => {
    expect(typeof determineMode).toBe('function');
    expect(typeof shouldAutoUnlock).toBe('function');
    expect(typeof getIncognitoMessage).toBe('function');
    expect(INCOGNITO_MESSAGES).toBeDefined();
    const state: IncognitoState = { isIncognitoContext: true, isAllowedIncognito: true };
    const mode: IncognitoMode = 'incognito_active';
    const config: IncognitoConfig = { autoUnlockInIncognito: true, showInNormalMode: true };
    expect(state).toBeDefined();
    expect(mode).toBeDefined();
    expect(config).toBeDefined();
  });

  it('background-types exports type-check correctly', () => {
    const msg: BackgroundMessage = { type: 'GET_STATE' };
    const resp: BackgroundResponse = { success: true };
    const session: SessionState = {
      isUnlocked: false,
      activeSetId: 'default',
      sets: [],
      tree: null,
      incognitoMode: 'normal_mode',
      hasData: false,
    };
    const msgType: MessageType = 'LOCK';
    expect(msg.type).toBe('GET_STATE');
    expect(resp.success).toBe(true);
    expect(session.isUnlocked).toBe(false);
    expect(msgType).toBe('LOCK');
  });
});

const BROWSER_STORAGE_ALLOWED = new Set(['storage.ts', 'password-sets.ts']);

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
        expect(content).not.toContain('@ts-expect-error');
      });

      it('has zero console.log', () => {
        expect(content).not.toMatch(/console\.log/);
      });

      it('has zero empty catch blocks', () => {
        expect(content).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
      });
    });
  }
});

describe('scaffold integration: type composition', () => {
  it('PasswordSetInfo has required fields', () => {
    const info: PasswordSetInfo = {
      id: '1',
      name: 'Default',
      createdAt: 0,
      lastAccessedAt: 0,
      isDefault: true,
    };
    expect(info.isDefault).toBe(true);
  });

  it('PasswordSetManifest contains sets and activeSetId', () => {
    const info: PasswordSetInfo = {
      id: '1',
      name: 'Default',
      createdAt: 0,
      lastAccessedAt: 0,
      isDefault: true,
    };
    const manifest: PasswordSetManifest = {
      sets: [info],
      activeSetId: '1',
      version: 1,
    };
    expect(manifest.sets).toHaveLength(1);
    expect(manifest.version).toBe(1);
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

  it('RecoveryMetadata holds derivedKeyHash', () => {
    const rm: RecoveryMetadata = {
      derivedKeyHash: 'hash',
    };
    expect(typeof rm.derivedKeyHash).toBe('string');
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
    expect(new RecoveryError('x', { reason: 'invalid_blob' }).name).toBe('RecoveryError');
  });

  it('error classes support cause chaining', () => {
    const cause = new Error('root');
    expect(new DecryptionError('x', { cause }).cause).toBe(cause);
    expect(new InvalidPasswordError('x', { cause }).cause).toBe(cause);
    expect(new StorageError('x', {}, { cause }).cause).toBe(cause);
    expect(new ImportError('x', {}, { cause }).cause).toBe(cause);
    expect(new RecoveryError('x', { reason: 'invalid_blob' }, { cause }).cause).toBe(cause);
  });

  it('StorageError exposes typed context', () => {
    const ctx: StorageErrorContext = { key: 'k', operation: 'write' };
    expect(new StorageError('x', ctx).context).toEqual(ctx);
  });

  it('ImportError exposes typed context', () => {
    const ctx: ImportErrorContext = { source: 's', format: 'json' };
    expect(new ImportError('x', ctx).context).toEqual(ctx);
  });

  it('RecoveryError exposes typed context', () => {
    const ctx: RecoveryErrorContext = { reason: 'invalid_blob' };
    expect(new RecoveryError('x', ctx).context).toEqual(ctx);
  });
});

describe('scaffold integration: imports lib/ modules successfully', () => {
  it('all lib/ modules imported successfully without hanging', () => {
    expect(LIB_MODULES).toHaveLength(13);
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

describe('scaffold integration: architecture constraints', () => {
  it('lib/ modules have no circular imports', () => {
    const edges = new Map<string, Set<string>>();
    for (const mod of LIB_MODULES) {
      const content = readFileSync(resolve(ROOT, 'lib', mod), 'utf-8');
      const imports = new Set<string>();
      const importRegex = /from\s+['"]@\/lib\/([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const target = match[1]!.endsWith('.ts') ? match[1]! : `${match[1]!}.ts`;
        if (target !== mod) imports.add(target);
      }
      edges.set(mod, imports);
    }
    for (const [modA, depsA] of edges) {
      for (const depB of depsA) {
        const depsB = edges.get(depB);
        if (depsB) {
          expect(depsB.has(modA)).toBe(false);
        }
      }
    }
  });

  it('data-model.ts is within 300-line limit', () => {
    const lines = readFileSync(resolve(ROOT, 'lib', 'data-model.ts'), 'utf-8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(300);
  });

  it('password-sets.ts is within 250-line limit', () => {
    const lines = readFileSync(resolve(ROOT, 'lib', 'password-sets.ts'), 'utf-8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(250);
  });

  it('password-sets.ts functions are within 50-line limit', () => {
    const content = readFileSync(resolve(ROOT, 'lib', 'password-sets.ts'), 'utf-8');
    const lines = content.split('\n');
    const funcStarts: Array<{ name: string; line: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const funcMatch = lines[i]!.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) funcStarts.push({ name: funcMatch[1]!, line: i });
    }
    for (let f = 0; f < funcStarts.length; f++) {
      const start = funcStarts[f]!.line;
      const end = f + 1 < funcStarts.length ? funcStarts[f + 1]!.line : lines.length;
      const funcLines = end - start;
      expect(funcLines).toBeLessThanOrEqual(50);
    }
  });

  it('recovery.ts is within 150-line limit', () => {
    const lines = readFileSync(resolve(ROOT, 'lib', 'recovery.ts'), 'utf-8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(150);
  });

  it('recovery.ts functions are within 50-line limit', () => {
    const content = readFileSync(resolve(ROOT, 'lib', 'recovery.ts'), 'utf-8');
    const lines = content.split('\n');
    const funcStarts: Array<{ name: string; line: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const funcMatch = lines[i]!.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) funcStarts.push({ name: funcMatch[1]!, line: i });
    }
    for (let f = 0; f < funcStarts.length; f++) {
      const start = funcStarts[f]!.line;
      const end = f + 1 < funcStarts.length ? funcStarts[f + 1]!.line : lines.length;
      const funcLines = end - start;
      expect(funcLines).toBeLessThanOrEqual(50);
    }
  });

  it('recovery.ts uses only @scure/bip39 as external crypto dependency', () => {
    const content = readFileSync(resolve(ROOT, 'lib', 'recovery.ts'), 'utf-8');
    const importRegex = /from\s+['"]([^@./][^'"]*)['"]/g;
    let match;
    const externalDeps = new Set<string>();
    while ((match = importRegex.exec(content)) !== null) {
      externalDeps.add(match[1]!);
    }
    for (const dep of externalDeps) {
      expect(dep.startsWith('@scure/bip39')).toBe(true);
    }
  });

  it('data-model.ts functions are within 50-line limit', () => {
    const content = readFileSync(resolve(ROOT, 'lib', 'data-model.ts'), 'utf-8');
    const lines = content.split('\n');
    const funcStarts: Array<{ name: string; line: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const funcMatch = lines[i]!.match(/^(?:export\s+)?function\s+(\w+)/);
      if (funcMatch) funcStarts.push({ name: funcMatch[1]!, line: i });
    }
    for (let f = 0; f < funcStarts.length; f++) {
      const start = funcStarts[f]!.line;
      const end = f + 1 < funcStarts.length ? funcStarts[f + 1]!.line : lines.length;
      const funcLines = end - start;
      expect(funcLines).toBeLessThanOrEqual(50);
    }
  });

  it('incognito.ts is within 80-line limit', () => {
    const lines = readFileSync(resolve(ROOT, 'lib', 'incognito.ts'), 'utf-8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(80);
  });

  it('incognito.ts has zero external dependencies', () => {
    const content = readFileSync(resolve(ROOT, 'lib', 'incognito.ts'), 'utf-8');
    const importRegex = /from\s+['"]([^@./][^'"]*)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      throw new Error(`Unexpected external dependency: ${match[1]}`);
    }
  });

  it('incognito.ts has zero browser/chrome API imports', () => {
    const content = readFileSync(resolve(ROOT, 'lib', 'incognito.ts'), 'utf-8');
    expect(content).not.toMatch(/from\s+['"]wxt\/browser['"]/);
    expect(content).not.toContain('chrome.');
    expect(content).not.toContain('browser.');
  });

  it('background-types.ts is within 150-line limit', () => {
    const lines = readFileSync(resolve(ROOT, 'lib', 'background-types.ts'), 'utf-8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(150);
  });

  it('background-types.ts has zero external dependencies', () => {
    const content = readFileSync(resolve(ROOT, 'lib', 'background-types.ts'), 'utf-8');
    const importRegex = /from\s+['"]([^@./][^'"]*)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      throw new Error(`Unexpected external dependency: ${match[1]}`);
    }
  });

  it('background-types.ts has zero browser/chrome API imports', () => {
    const content = readFileSync(resolve(ROOT, 'lib', 'background-types.ts'), 'utf-8');
    expect(content).not.toMatch(/from\s+['"]wxt\/browser['"]/);
    expect(content).not.toContain('chrome.');
    expect(content).not.toContain('browser.');
  });

  it('background.ts is within 300-line limit', () => {
    const lines = readFileSync(resolve(ROOT, 'entrypoints', 'background.ts'), 'utf-8').split('\n').length;
    expect(lines).toBeLessThanOrEqual(300);
  });
});
