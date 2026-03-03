/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '@/lib/crypto';

const ROOT = resolve(process.cwd());

describe('stateless module purity and call independence', () => {
  describe('static source analysis', () => {
    const content = readFileSync(resolve(ROOT, 'lib/crypto.ts'), 'utf-8');

    it('has zero React/DOM imports', () => {
      expect(content).not.toMatch(/from\s+['"]react['"]/);
      expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
      expect(content).not.toContain('document.');
      expect(content).not.toContain('window.');
    });

    it('has zero extension storage references', () => {
      expect(content).not.toContain('chrome.storage');
      expect(content).not.toContain('browser.storage');
    });

    it('has zero module-level let declarations', () => {
      const lines = content.split('\n');
      const moduleLevelLets = lines.filter((line) => {
        const trimmed = line.trimStart();
        return (
          trimmed.startsWith('let ') && line.length - trimmed.length === 0
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

    it('has no chrome.alarms references', () => {
      expect(content).not.toContain('chrome.alarms');
    });

    it('has no module-level CryptoKey caching', () => {
      const lines = content.split('\n');
      const moduleLevelCryptoKey = lines.filter((line) => {
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;
        return (
          indent === 0 &&
          /^(export\s+)?(const|let|var)\s+/.test(trimmed) &&
          trimmed.includes('CryptoKey')
        );
      });
      expect(moduleLevelCryptoKey).toHaveLength(0);
    });
  });

  describe('call independence', () => {
    it(
      'sequential encrypt/decrypt with different passwords produces correct results',
      async () => {
        const plaintextA = 'sequential-data-alpha';
        const passwordA = 'password-alpha-seq';
        const plaintextB = 'sequential-data-beta';
        const passwordB = 'password-beta-seq';

        const storeA = await encrypt(plaintextA, passwordA);
        const storeB = await encrypt(plaintextB, passwordB);
        const resultA = await decrypt(storeA, passwordA);
        const resultB = await decrypt(storeB, passwordB);

        expect(resultA).toBe(plaintextA);
        expect(resultB).toBe(plaintextB);
      },
      120_000,
    );

    it(
      'concurrent encrypt/decrypt calls via Promise.all produce correct results',
      async () => {
        const pairs = Array.from({ length: 10 }, (_, i) => ({
          plaintext: `concurrent-data-${i}`,
          password: `concurrent-password-${i}`,
        }));

        const stores = await Promise.all(
          pairs.map((p) => encrypt(p.plaintext, p.password)),
        );

        const results = await Promise.all(
          stores.map((store, i) => decrypt(store, pairs[i]!.password)),
        );

        for (let i = 0; i < pairs.length; i++) {
          expect(results[i]).toBe(pairs[i]!.plaintext);
        }
      },
      120_000,
    );
  });
});
