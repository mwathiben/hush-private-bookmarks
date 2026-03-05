/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}));

import { validateEncryptedStore } from '@/lib/storage';

const ROOT = resolve(process.cwd());

describe('STORAGE-005: validateEncryptedStore type guard', () => {
  describe('valid inputs', () => {
    it('returns true for valid EncryptedStore', () => {
      // #given — object with all 4 required fields of correct types
      const valid = { salt: 'abc', encrypted: 'def', iv: 'ghi', iterations: 600_000 };
      // #then
      expect(validateEncryptedStore(valid)).toBe(true);
    });

    it('returns true for valid EncryptedStore with extra properties', () => {
      // #given — valid object with additional keys (chrome.storage may add metadata)
      const valid = { salt: 'abc', encrypted: 'def', iv: 'ghi', iterations: 600_000, extra: 'ignored' };
      // #then
      expect(validateEncryptedStore(valid)).toBe(true);
    });
  });

  describe('primitive rejection', () => {
    it('returns false for null', () => {
      expect(validateEncryptedStore(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(validateEncryptedStore(undefined)).toBe(false);
    });

    it('returns false for string', () => {
      expect(validateEncryptedStore('not-an-object')).toBe(false);
    });

    it('returns false for number', () => {
      expect(validateEncryptedStore(42)).toBe(false);
    });

    it('returns false for boolean', () => {
      expect(validateEncryptedStore(true)).toBe(false);
    });

    it('returns false for array', () => {
      // typeof [] === 'object', but has no expected string properties
      expect(validateEncryptedStore([1, 2, 3])).toBe(false);
    });
  });

  describe('missing required fields', () => {
    it('returns false for empty object', () => {
      expect(validateEncryptedStore({})).toBe(false);
    });

    it('returns false for object missing salt', () => {
      expect(validateEncryptedStore({ encrypted: 'e', iv: 'i', iterations: 600_000 })).toBe(false);
    });

    it('returns false for object missing encrypted', () => {
      expect(validateEncryptedStore({ salt: 's', iv: 'i', iterations: 600_000 })).toBe(false);
    });

    it('returns false for object missing iv', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iterations: 600_000 })).toBe(false);
    });

    it('returns false for object missing iterations', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i' })).toBe(false);
    });
  });

  describe('wrong field types', () => {
    it('returns false when salt is number', () => {
      expect(validateEncryptedStore({ salt: 123, encrypted: 'e', iv: 'i', iterations: 600_000 })).toBe(false);
    });

    it('returns false when encrypted is boolean', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: false, iv: 'i', iterations: 600_000 })).toBe(false);
    });

    it('returns false when iv is null', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: null, iterations: 600_000 })).toBe(false);
    });

    it('returns false when iterations is string', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i', iterations: '600000' })).toBe(false);
    });
  });

  describe('edge case values', () => {
    it('returns false for empty string salt', () => {
      expect(validateEncryptedStore({ salt: '', encrypted: 'e', iv: 'i', iterations: 600_000 })).toBe(false);
    });

    it('returns false for empty string encrypted', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: '', iv: 'i', iterations: 600_000 })).toBe(false);
    });

    it('returns false for empty string iv', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: '', iterations: 600_000 })).toBe(false);
    });

    it('returns false for iterations = 0', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i', iterations: 0 })).toBe(false);
    });

    it('returns false for iterations = NaN', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i', iterations: NaN })).toBe(false);
    });

    it('returns false for iterations = Infinity', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i', iterations: Infinity })).toBe(false);
    });

    it('returns false for iterations = -1', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i', iterations: -1 })).toBe(false);
    });

    it('returns false for iterations = -Infinity', () => {
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i', iterations: -Infinity })).toBe(false);
    });

    it('returns false for fractional iterations', () => {
      // PBKDF2 iterations must be an integer; fractional values are invalid
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i', iterations: 0.5 })).toBe(false);
      expect(validateEncryptedStore({ salt: 's', encrypted: 'e', iv: 'i', iterations: 1.7 })).toBe(false);
    });
  });
});

describe('STORAGE-005: Module purity — lib/storage.ts', () => {
  const content = readFileSync(resolve(ROOT, 'lib/storage.ts'), 'utf-8');
  const codeLines = content.split('\n').filter(
    (line) => {
      const t = line.trimStart();
      return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
    },
  );
  const codeOnly = codeLines.join('\n');

  it('has zero React/DOM imports', () => {
    expect(content).not.toMatch(/from\s+['"]react['"]/);
    expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    expect(codeOnly).not.toContain('document.');
    expect(codeOnly).not.toContain('window.');
  });

  it('uses browser from wxt/browser (not chrome.*)', () => {
    // #given — source code stripped of comments
    // #then — no direct chrome.* API calls in code (JSDoc references excluded)
    expect(codeOnly).not.toMatch(/chrome\./);
    // #then — imports browser from wxt/browser
    expect(content).toMatch(/from\s+['"]wxt\/browser['"]/);
  });

  it('has zero console.log statements', () => {
    expect(codeOnly).not.toMatch(/console\.(log|warn|error|info|debug)/);
  });

  it('has zero type suppressions', () => {
    expect(content).not.toContain('as any');
    expect(content).not.toContain('@ts-ignore');
    expect(content).not.toContain('@ts-expect-error');
  });

  it('has zero empty catch blocks', () => {
    expect(content).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
  });
});
