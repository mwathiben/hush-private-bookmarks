import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

const ROOT = resolve(process.cwd());

describe('Bookmark', () => {
  it('accepts a valid bookmark object', () => {
    const bookmark: Bookmark = {
      type: 'bookmark',
      id: 'bm-1',
      title: 'Example',
      url: 'https://example.com',
      dateAdded: Date.now(),
    };
    const discriminant: 'bookmark' = bookmark.type;
    expect(discriminant).toBe('bookmark');
    expect(bookmark.id).toBe('bm-1');
    expect(bookmark.title).toBe('Example');
    expect(bookmark.url).toBe('https://example.com');
    expect(typeof bookmark.dateAdded).toBe('number');
  });

  it('rejects missing url', () => {
    // @ts-expect-error — missing required url field
    const _invalid: Bookmark = {
      type: 'bookmark',
      id: 'bm-3',
      title: 'No URL',
      dateAdded: 0,
    };
    expect(_invalid).toBeDefined();
  });

  it('rejects wrong type discriminant', () => {
    const _invalid: Bookmark = {
      // @ts-expect-error — type must be 'bookmark', not 'folder'
      type: 'folder',
      id: 'bm-4',
      title: 'Wrong Type',
      url: 'https://wrong.com',
      dateAdded: 0,
    };
    expect(_invalid).toBeDefined();
  });
});

describe('Folder', () => {
  it('accepts a valid folder with empty children', () => {
    const folder: Folder = {
      type: 'folder',
      id: 'f-1',
      name: 'My Folder',
      children: [],
      dateAdded: Date.now(),
    };
    const discriminant: 'folder' = folder.type;
    expect(discriminant).toBe('folder');
    expect(folder.name).toBe('My Folder');
    expect(folder.children).toEqual([]);
  });

  it('accepts children with both bookmarks and folders', () => {
    const nested: Folder = {
      type: 'folder',
      id: 'f-3',
      name: 'Parent',
      children: [
        { type: 'bookmark', id: 'bm-c1', title: 'Child BM', url: 'https://child.com', dateAdded: 0 },
        { type: 'folder', id: 'f-c1', name: 'Child Folder', children: [], dateAdded: 0 },
      ],
      dateAdded: 0,
    };
    expect(nested.children).toHaveLength(2);
  });

  it('rejects missing children', () => {
    // @ts-expect-error — missing required children field
    const _invalid: Folder = {
      type: 'folder',
      id: 'f-4',
      name: 'No Children',
      dateAdded: 0,
    };
    expect(_invalid).toBeDefined();
  });
});

describe('BookmarkNode discriminated union', () => {
  it('narrows to Bookmark via type check', () => {
    const node: BookmarkNode = {
      type: 'bookmark',
      id: 'bm-n1',
      title: 'Narrowing Test',
      url: 'https://narrow.com',
      dateAdded: 0,
    };
    if (node.type === 'bookmark') {
      expect(node.url).toBe('https://narrow.com');
    }
  });

  it('narrows to Folder via type check', () => {
    const node: BookmarkNode = {
      type: 'folder',
      id: 'f-n1',
      name: 'Narrowing Folder',
      children: [],
      dateAdded: 0,
    };
    if (node.type === 'folder') {
      expect(node.children).toEqual([]);
    }
  });

  it('supports exhaustive switch', () => {
    function getLabel(node: BookmarkNode): string {
      switch (node.type) {
        case 'bookmark':
          return node.title;
        case 'folder':
          return node.name;
      }
    }
    const bm: BookmarkNode = { type: 'bookmark', id: 'bm-s1', title: 'Switch BM', url: 'https://sw.com', dateAdded: 0 };
    const fl: BookmarkNode = { type: 'folder', id: 'f-s1', name: 'Switch Folder', children: [], dateAdded: 0 };
    expect(getLabel(bm)).toBe('Switch BM');
    expect(getLabel(fl)).toBe('Switch Folder');
  });
});

describe('BookmarkTree', () => {
  it('is assignable from Folder', () => {
    const tree: BookmarkTree = {
      type: 'folder',
      id: 'root',
      name: 'Root',
      children: [],
      dateAdded: 0,
    };
    expect(tree.type).toBe('folder');
  });

  it('accepts deeply nested structure', () => {
    const tree: BookmarkTree = {
      type: 'folder',
      id: 'root',
      name: 'Root',
      children: [
        {
          type: 'folder',
          id: 'f-deep',
          name: 'Level 1',
          children: [
            { type: 'bookmark', id: 'bm-deep', title: 'Deep BM', url: 'https://deep.com', dateAdded: 0 },
          ],
          dateAdded: 0,
        },
      ],
      dateAdded: 0,
    };
    expect(tree.children).toHaveLength(1);
  });
});

describe('EncryptedStore', () => {
  it('accepts valid encrypted store', () => {
    const store: EncryptedStore = {
      salt: 'base64salt==',
      encrypted: 'base64data==',
      iv: 'base64iv==',
      iterations: 600_000,
    };
    expect(store.iterations).toBe(600_000);
    expect(typeof store.salt).toBe('string');
    expect(typeof store.iterations).toBe('number');
  });

  it('rejects missing salt', () => {
    // @ts-expect-error — missing required salt field
    const _invalid: EncryptedStore = {
      encrypted: 'e',
      iv: 'i',
      iterations: 600_000,
    };
    expect(_invalid).toBeDefined();
  });
});

describe('PasswordSet', () => {
  it('accepts valid password set with EncryptedStore', () => {
    const store: EncryptedStore = { salt: 's', encrypted: 'e', iv: 'i', iterations: 600_000 };
    const ps: PasswordSet = {
      id: 'ps-1',
      name: 'Default',
      store,
      createdAt: Date.now(),
    };
    expect(ps.name).toBe('Default');
    expect(ps.store).toBe(store);
    expect(ps.store.iterations).toBe(600_000);
  });
});

describe('RecoveryPhrase', () => {
  it('has string array words and string derivedKeyHash', () => {
    const rp: RecoveryPhrase = {
      words: ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'],
      derivedKeyHash: 'sha256hash',
    };
    expect(rp.words).toHaveLength(12);
    expect(typeof rp.words[0]).toBe('string');
    expect(typeof rp.derivedKeyHash).toBe('string');
  });
});

describe('CryptoConfig', () => {
  it('accepts valid config with correct field types', () => {
    const config: CryptoConfig = {
      iterations: 600_000,
      algorithm: 'AES-256-GCM',
      keyLength: 256,
      ivLength: 12,
      hashAlgorithm: 'SHA-256',
    };
    expect(config.iterations).toBe(600_000);
    expect(config.algorithm).toBe('AES-256-GCM');
    expect(config.keyLength).toBe(256);
    expect(config.ivLength).toBe(12);
    expect(config.hashAlgorithm).toBe('SHA-256');
    expect(typeof config.iterations).toBe('number');
    expect(typeof config.algorithm).toBe('string');
    expect(typeof config.keyLength).toBe('number');
    expect(typeof config.ivLength).toBe('number');
    expect(typeof config.hashAlgorithm).toBe('string');
  });
});

describe('Result<T, E>', () => {
  it('success result narrows to data', () => {
    const result: Result<string> = { success: true, data: 'hello' };
    if (result.success) {
      expect(result.data).toBe('hello');
    }
  });

  it('failure result narrows to error', () => {
    const result: Result<string> = { success: false, error: new Error('fail') };
    if (!result.success) {
      expect(result.error.message).toBe('fail');
    }
  });

  it('defaults E to Error', () => {
    const result: Result<number> = { success: false, error: new Error('default') };
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('narrows correctly in conditional', () => {
    function unwrap(r: Result<string>): string {
      if (r.success) {
        return r.data;
      }
      return r.error.message;
    }
    expect(unwrap({ success: true, data: 'ok' })).toBe('ok');
    expect(unwrap({ success: false, error: new Error('err') })).toBe('err');
  });
});

describe('lib/types.ts module purity', () => {
  it('has zero React/DOM imports', () => {
    const content = readFileSync(resolve(ROOT, 'lib/types.ts'), 'utf-8');
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(content).not.toContain('document.');
    expect(content).not.toContain('window.');
  });

  it('has zero browser.storage references', () => {
    const content = readFileSync(resolve(ROOT, 'lib/types.ts'), 'utf-8');
    expect(content).not.toContain('browser.storage');
    expect(content).not.toContain('chrome.storage');
  });
});
