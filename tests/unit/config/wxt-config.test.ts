import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MANIFEST_PATH = resolve(process.cwd(), '.output/chrome-mv3/manifest.json');

interface Manifest {
  name: string;
  description: string;
  default_locale?: string;
  permissions: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  manifest_version: number;
  action?: { default_title?: string };
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(
      `Manifest not found at ${MANIFEST_PATH}. Run "wxt build" before running config tests.`,
    );
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest;
}

describe('WXT manifest configuration', () => {
  const manifest = readManifest();

  it('includes required permissions', () => {
    const required = ['storage', 'contextMenus', 'activeTab', 'bookmarks'];
    for (const perm of required) {
      expect(manifest.permissions).toContain(perm);
    }
  });

  it('declares history as optional permission', () => {
    expect(manifest.optional_permissions).toContain('history');
    expect(manifest.permissions).not.toContain('history');
  });

  it('excludes clipboard permissions', () => {
    expect(manifest.permissions).not.toContain('clipboardRead');
    expect(manifest.permissions).not.toContain('clipboardWrite');
  });

  it('has correct extension name', () => {
    expect(manifest.name).toBe('Hush Private Bookmarks');
  });

  it('has a non-empty description', () => {
    expect(manifest.description).toBeTruthy();
    expect(typeof manifest.description).toBe('string');
  });

  it('does not include google.com host permissions', () => {
    const hostPerms = manifest.host_permissions ?? [];
    const hasGoogle = hostPerms.some((hp) => hp.includes('google.com'));
    expect(hasGoogle).toBe(false);
  });

  it('uses manifest version 3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('declares default_locale as en', () => {
    expect(manifest.default_locale).toBe('en');
  });
});
