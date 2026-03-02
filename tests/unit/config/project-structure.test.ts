import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());

function pathExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

function readText(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

describe('directory structure', () => {
  const REQUIRED_DIRS = [
    'lib',
    'components/ui',
    'hooks',
    'entrypoints/popup',
    'tests/unit',
    'tests/e2e',
    'public/_locales',
    'public/icon',
    '.prd',
  ];

  for (const dir of REQUIRED_DIRS) {
    it(`${dir}/ exists`, () => {
      expect(pathExists(dir)).toBe(true);
    });
  }
});

describe('i18n locales', () => {
  const EXPECTED_LOCALES = [
    'ar', 'de', 'en', 'es', 'fr', 'hy', 'it', 'ru', 'uk', 'zh_CN',
  ];

  it('contains exactly 10 locale directories', () => {
    const locales = readdirSync(resolve(ROOT, 'public/_locales'));
    expect(locales.sort()).toEqual([...EXPECTED_LOCALES].sort());
  });

  for (const locale of EXPECTED_LOCALES) {
    it(`${locale}/messages.json exists and is valid JSON`, () => {
      const messagesPath = `public/_locales/${locale}/messages.json`;
      expect(pathExists(messagesPath)).toBe(true);
      const content = readText(messagesPath);
      expect(() => JSON.parse(content)).not.toThrow();
    });
  }

  it('en/messages.json has extensionName for Hush', () => {
    const messages = JSON.parse(readText('public/_locales/en/messages.json'));
    expect(messages.extensionName?.message).toBe('Hush Private Bookmarks');
  });

  it('en/messages.json has extensionDescription', () => {
    const messages = JSON.parse(readText('public/_locales/en/messages.json'));
    expect(messages.extensionDescription?.message).toBeTruthy();
  });
});

describe('icon files', () => {
  const REQUIRED_ICONS = ['16.png', '32.png', '48.png', '96.png', '128.png'];

  for (const icon of REQUIRED_ICONS) {
    it(`public/icon/${icon} exists`, () => {
      expect(pathExists(`public/icon/${icon}`)).toBe(true);
    });
  }
});

describe('licensing files', () => {
  it('LICENSE contains GPL-3.0 text', () => {
    const content = readText('LICENSE');
    expect(content).toContain('GNU GENERAL PUBLIC LICENSE');
    expect(content).toContain('Version 3');
  });

  it('NOTICE references Holy Private Bookmarks', () => {
    const content = readText('NOTICE');
    expect(content).toContain('Holy Private Bookmarks');
    expect(content).toContain('holy-private-bookmarks');
  });

  it('NOTICE lists derived files', () => {
    const content = readText('NOTICE');
    expect(content).toContain('crypto.ts');
    expect(content).toContain('data-model.ts');
    expect(content).toContain('_locales');
  });

  it('NOTICE references GPL-3.0', () => {
    const content = readText('NOTICE');
    expect(content).toContain('GPL-3.0');
  });
});

describe('hooks directory', () => {
  it('hooks/.gitkeep exists', () => {
    expect(pathExists('hooks/.gitkeep')).toBe(true);
  });
});

describe('ErrorBoundary component', () => {
  it('components/ErrorBoundary.tsx exists', () => {
    expect(pathExists('components/ErrorBoundary.tsx')).toBe(true);
  });

  it('imports captureException from lib/sentry', () => {
    const content = readText('components/ErrorBoundary.tsx');
    expect(content).toContain('captureException');
    expect(content).toContain('@/lib/sentry');
  });

  it('is a class component with error lifecycle methods', () => {
    const content = readText('components/ErrorBoundary.tsx');
    expect(content).toContain('getDerivedStateFromError');
    expect(content).toContain('componentDidCatch');
  });

  it('has zero type suppressions', () => {
    const content = readText('components/ErrorBoundary.tsx');
    expect(content).not.toContain('as any');
    expect(content).not.toContain('@ts-ignore');
    expect(content).not.toContain('@ts-expect-error');
  });

  it('does not import browser.storage', () => {
    const content = readText('components/ErrorBoundary.tsx');
    expect(content).not.toContain('browser.storage');
  });
});
