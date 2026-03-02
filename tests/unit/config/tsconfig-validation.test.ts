import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());

interface TsCompilerOptions {
  allowImportingTsExtensions?: boolean;
  jsx?: string;
  noUncheckedIndexedAccess?: boolean;
  noUnusedLocals?: boolean;
  noUnusedParameters?: boolean;
  noImplicitReturns?: boolean;
  noFallthroughCasesInSwitch?: boolean;
  strict?: boolean;
  paths?: Record<string, string[]>;
}

interface TsConfig {
  extends?: string;
  compilerOptions?: TsCompilerOptions;
}

function readJson<T>(relativePath: string): T {
  const fullPath = resolve(ROOT, relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
}

describe('tsconfig.json strict configuration', () => {
  const tsconfig = readJson<TsConfig>('tsconfig.json');
  const wxtTsconfig = readJson<TsConfig>('.wxt/tsconfig.json');

  it('extends WXT-generated tsconfig', () => {
    expect(tsconfig.extends).toBe('./.wxt/tsconfig.json');
  });

  it('enables noUncheckedIndexedAccess', () => {
    expect(tsconfig.compilerOptions?.noUncheckedIndexedAccess).toBe(true);
  });

  it('enables noUnusedLocals', () => {
    expect(tsconfig.compilerOptions?.noUnusedLocals).toBe(true);
  });

  it('enables noUnusedParameters', () => {
    expect(tsconfig.compilerOptions?.noUnusedParameters).toBe(true);
  });

  it('enables noImplicitReturns', () => {
    expect(tsconfig.compilerOptions?.noImplicitReturns).toBe(true);
  });

  it('enables noFallthroughCasesInSwitch', () => {
    expect(tsconfig.compilerOptions?.noFallthroughCasesInSwitch).toBe(true);
  });

  it('preserves jsx react-jsx setting', () => {
    expect(tsconfig.compilerOptions?.jsx).toBe('react-jsx');
  });

  it('preserves allowImportingTsExtensions', () => {
    expect(tsconfig.compilerOptions?.allowImportingTsExtensions).toBe(true);
  });

  it('does not weaken strict mode', () => {
    expect(tsconfig.compilerOptions?.strict).not.toBe(false);
  });

  it('does not define custom paths (WXT manages aliases)', () => {
    expect(tsconfig.compilerOptions?.paths).toBeUndefined();
  });

  describe('inherited from .wxt/tsconfig.json', () => {
    it('has strict mode enabled', () => {
      expect(wxtTsconfig.compilerOptions?.strict).toBe(true);
    });

    it('has @/* path alias configured', () => {
      const paths = wxtTsconfig.compilerOptions?.paths;
      expect(paths).toBeDefined();
      expect(paths?.['@/*']).toContain('../*');
    });
  });
});
