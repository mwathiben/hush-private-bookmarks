import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());

describe('Tailwind v4 + shadcn/ui styling setup', () => {
  describe('app.css', () => {
    const cssPath = resolve(ROOT, 'app.css');

    it('exists at project root', () => {
      expect(existsSync(cssPath)).toBe(true);
    });

    it('uses Tailwind v4 import (not v3 directives)', () => {
      const css = readFileSync(cssPath, 'utf-8');
      expect(css).toContain('@import "tailwindcss"');
      expect(css).not.toContain('@tailwind base');
      expect(css).not.toContain('@tailwind components');
      expect(css).not.toContain('@tailwind utilities');
    });

    it('configures dark mode via class strategy', () => {
      const css = readFileSync(cssPath, 'utf-8');
      expect(css).toContain('@custom-variant dark');
    });

    it('defines CSS variables using OKLCH color format', () => {
      const css = readFileSync(cssPath, 'utf-8');
      expect(css).toMatch(/--background:\s*oklch\(/);
      expect(css).toMatch(/--foreground:\s*oklch\(/);
      expect(css).toMatch(/--primary:\s*oklch\(/);
    });

    it('has @theme inline block mapping variables to Tailwind utilities', () => {
      const css = readFileSync(cssPath, 'utf-8');
      expect(css).toContain('@theme inline');
      expect(css).toContain('--color-background: var(--background)');
      expect(css).toContain('--color-foreground: var(--foreground)');
      expect(css).toContain('--color-primary: var(--primary)');
    });

    it('has .dark selector for dark mode overrides', () => {
      const css = readFileSync(cssPath, 'utf-8');
      expect(css).toMatch(/\.dark\s*\{/);
    });

    it('does not put :root or .dark inside @layer base', () => {
      const css = readFileSync(cssPath, 'utf-8');
      const layerBaseBlock = css.match(/@layer base\s*\{[\s\S]*?\n\}/);
      if (layerBaseBlock) {
        expect(layerBaseBlock[0]).not.toContain(':root');
        expect(layerBaseBlock[0]).not.toContain('.dark');
      }
    });
  });

  describe('shadcn components', () => {
    const uiDir = resolve(ROOT, 'components/ui');

    it('button.tsx exists', () => {
      expect(existsSync(resolve(uiDir, 'button.tsx'))).toBe(true);
    });

    it('input.tsx exists', () => {
      expect(existsSync(resolve(uiDir, 'input.tsx'))).toBe(true);
    });

    it('dialog.tsx exists', () => {
      expect(existsSync(resolve(uiDir, 'dialog.tsx'))).toBe(true);
    });

    it('alert.tsx exists', () => {
      expect(existsSync(resolve(uiDir, 'alert.tsx'))).toBe(true);
    });
  });

  describe('lib/utils.ts', () => {
    const utilsPath = resolve(ROOT, 'lib/utils.ts');

    it('exists with cn() utility', () => {
      expect(existsSync(utilsPath)).toBe(true);
    });

    it('uses clsx and tailwind-merge', () => {
      const content = readFileSync(utilsPath, 'utf-8');
      expect(content).toContain('export function cn');
      expect(content).toContain('clsx');
      expect(content).toContain('twMerge');
    });

    it('has zero React/DOM imports', () => {
      const content = readFileSync(utilsPath, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]react['"]/);
      expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
      expect(content).not.toContain('document.');
      expect(content).not.toContain('window.');
    });
  });

  describe('components.json', () => {
    const configPath = resolve(ROOT, 'components.json');

    it('exists at project root', () => {
      expect(existsSync(configPath)).toBe(true);
    });

    it('has empty tailwind config path (v4 convention)', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.tailwind.config).toBe('');
    });

    it('points css to app.css', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.tailwind.css).toBe('app.css');
    });

    it('disables RSC (browser extension)', () => {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(config.rsc).toBe(false);
    });
  });

  describe('no tailwind config files', () => {
    it('tailwind.config.ts does not exist', () => {
      expect(existsSync(resolve(ROOT, 'tailwind.config.ts'))).toBe(false);
    });

    it('tailwind.config.js does not exist', () => {
      expect(existsSync(resolve(ROOT, 'tailwind.config.js'))).toBe(false);
    });
  });
});
