import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());

describe('ESLint v10 flat config', () => {
  describe('config file structure', () => {
    it('eslint.config.js exists at project root', () => {
      expect(existsSync(resolve(ROOT, 'eslint.config.js'))).toBe(true);
    });

    it('no legacy .eslintrc.json exists', () => {
      expect(existsSync(resolve(ROOT, '.eslintrc.json'))).toBe(false);
    });

    it('no legacy .eslintrc.js exists', () => {
      expect(existsSync(resolve(ROOT, '.eslintrc.js'))).toBe(false);
    });
  });

  describe('config content', () => {
    const configPath = resolve(ROOT, 'eslint.config.js');
    const getConfig = (): string => readFileSync(configPath, 'utf-8');

    it('integrates @typescript-eslint plugin', () => {
      expect(getConfig()).toContain('@typescript-eslint');
    });

    it('uses @eslint/js recommended rules', () => {
      expect(getConfig()).toContain('@eslint/js');
    });

    it('imports WXT auto-imports for globals', () => {
      expect(getConfig()).toContain('eslint-auto-imports');
    });

    it('configures no-empty as error', () => {
      expect(getConfig()).toMatch(/'no-empty':\s*'error'/);
    });

    it('configures no-console as warn', () => {
      expect(getConfig()).toMatch(/'no-console':\s*'warn'/);
    });

    it('configures prefer-const as error', () => {
      expect(getConfig()).toMatch(/'prefer-const':\s*'error'/);
    });

    it('configures explicit-function-return-type', () => {
      expect(getConfig()).toContain('explicit-function-return-type');
    });

    it('excludes .wxt/ from linting', () => {
      expect(getConfig()).toContain('.wxt/');
    });

    it('excludes .output/ from linting', () => {
      expect(getConfig()).toContain('.output/');
    });

    it('excludes .prd/ from linting', () => {
      expect(getConfig()).toContain('.prd/');
    });
  });

  describe('package.json integration', () => {
    it('has lint script using eslint', () => {
      const pkg = JSON.parse(
        readFileSync(resolve(ROOT, 'package.json'), 'utf-8'),
      );
      expect(pkg.scripts.lint).toContain('eslint');
    });
  });
});
