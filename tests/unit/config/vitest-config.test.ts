import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cn } from '@/lib/utils';

const ROOT = resolve(process.cwd());

describe('vitest configuration', () => {
  describe('@/* path alias resolution', () => {
    it('resolves @/lib/utils import at runtime', () => {
      expect(typeof cn).toBe('function');
    });

    it('cn() merges class names into a string', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('cn() handles conditional class names', () => {
      expect(cn('a', false && 'b', 'c')).toBe('a c');
    });
  });

  describe('vitest.config.ts coverage settings', () => {
    const configSource = readFileSync(
      resolve(ROOT, 'vitest.config.ts'),
      'utf-8',
    );

    it('uses v8 coverage provider', () => {
      expect(configSource).toContain("provider: 'v8'");
    });

    it('sets jsdom as test environment', () => {
      expect(configSource).toContain("environment: 'jsdom'");
    });

    it('configures lib/ coverage thresholds at 80%', () => {
      expect(configSource).toMatch(/'lib\/\*\*'/);
      expect(configSource).toContain('branches: 80');
    });

    it('includes source directories in coverage', () => {
      expect(configSource).toContain("'lib/**/*.ts'");
      expect(configSource).toContain("'entrypoints/**/*.{ts,tsx}'");
    });

    it('excludes shadcn ui primitives from coverage', () => {
      expect(configSource).toContain("'components/ui/**'");
    });

    it('references test setup file', () => {
      expect(configSource).toContain('setup.ts');
    });
  });
});
