// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import {
  setStorageKey,
  MANIFEST_VERSION,
  loadManifest,
  createSet,
  deleteSet,
  renameSet,
  listSets,
} from '@/lib/password-sets';

beforeEach(async () => {
  await browser.storage.local.clear();
});

describe('PWSET-001: setStorageKey', () => {
  it('returns holyPrivateData for default set', () => {
    const key = setStorageKey('any-id', true);
    expect(key).toBe('holyPrivateData');
  });

  it('returns hush_set_{id} for non-default set', () => {
    const key = setStorageKey('abc-123', false);
    expect(key).toBe('hush_set_abc-123');
  });
});

describe('PWSET-001: loadManifest', () => {
  it('creates default manifest when none exists', async () => {
    // #given — empty storage
    // #when — loading manifest
    const result = await loadManifest();

    // #then — auto-created default manifest
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(MANIFEST_VERSION);
      expect(result.data.sets).toHaveLength(1);
      const defaultSet = result.data.sets[0];
      expect(defaultSet).toBeDefined();
      expect(defaultSet!.isDefault).toBe(true);
      expect(defaultSet!.name).toBe('Default');
      expect(result.data.activeSetId).toBe(defaultSet!.id);
    }
  });

  it('returns existing manifest when present', async () => {
    // #given — a manifest already in storage
    const first = await loadManifest();
    expect(first.success).toBe(true);

    // #when — loading again
    const second = await loadManifest();

    // #then — same manifest returned
    expect(second.success).toBe(true);
    if (first.success && second.success) {
      expect(second.data.sets).toHaveLength(1);
      expect(second.data.activeSetId).toBe(first.data.activeSetId);
    }
  });
});

describe('PWSET-001: createSet', () => {
  it('adds new set with isDefault: false and generated id', async () => {
    // #given — default manifest exists
    await loadManifest();

    // #when — creating a new set
    const result = await createSet('Work');

    // #then — new set added
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Work');
      expect(result.data.isDefault).toBe(false);
      expect(result.data.id).toBeTruthy();
    }

    const listResult = await listSets();
    expect(listResult.success).toBe(true);
    if (listResult.success) {
      expect(listResult.data).toHaveLength(2);
    }
  });

  it('generates unique IDs across 10 sets', async () => {
    // #given — default manifest
    await loadManifest();

    // #when — creating 10 sets
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const result = await createSet('Set ' + i);
      expect(result.success).toBe(true);
      if (result.success) ids.add(result.data.id);
    }

    // #then — all IDs unique
    expect(ids.size).toBe(10);
  });

  it('rejects empty/whitespace-only name', async () => {
    // #given — default manifest
    await loadManifest();

    // #when — creating with empty name
    const empty = await createSet('');
    const whitespace = await createSet('   ');

    // #then — both rejected
    expect(empty.success).toBe(false);
    expect(whitespace.success).toBe(false);
  });
});

describe('PWSET-001: listSets', () => {
  it('returns all sets', async () => {
    // #given — default + one extra set
    await loadManifest();
    await createSet('Extra');

    // #when — listing
    const result = await listSets();

    // #then — two sets returned
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });
});

describe('PWSET-001: deleteSet', () => {
  it('removes set from manifest and storage key', async () => {
    // #given — default + extra set with data stored
    await loadManifest();
    const created = await createSet('ToDelete');
    expect(created.success).toBe(true);
    if (!created.success) return;

    const storageKey = setStorageKey(created.data.id, false);
    await browser.storage.local.set({ [storageKey]: 'test-data' });

    // #when — deleting the extra set
    const result = await deleteSet(created.data.id);

    // #then — set removed from manifest and storage key removed
    expect(result.success).toBe(true);
    const list = await listSets();
    if (list.success) {
      expect(list.data).toHaveLength(1);
      expect(list.data[0]!.isDefault).toBe(true);
    }
    const raw = await browser.storage.local.get(storageKey);
    expect(raw[storageKey]).toBeUndefined();
  });

  it('switches activeSetId to default when deleting active non-default set', async () => {
    // #given — default + extra set, extra set is active
    const manifest = await loadManifest();
    expect(manifest.success).toBe(true);
    if (!manifest.success) return;

    const created = await createSet('Active');
    expect(created.success).toBe(true);
    if (!created.success) return;

    // manually set activeSetId to the new set
    const defaultSet = manifest.data.sets[0]!;
    await browser.storage.local.set({
      hush_manifest: {
        sets: [...manifest.data.sets, created.data],
        activeSetId: created.data.id,
        version: manifest.data.version,
      },
    });

    // #when — deleting the active non-default set
    const result = await deleteSet(created.data.id);

    // #then — succeeds and activeSetId switches to default
    expect(result.success).toBe(true);
    const reloaded = await loadManifest();
    expect(reloaded.success).toBe(true);
    if (reloaded.success) {
      expect(reloaded.data.activeSetId).toBe(defaultSet.id);
    }
  });

  it('cannot delete default set', async () => {
    // #given — default manifest
    const manifest = await loadManifest();
    expect(manifest.success).toBe(true);
    if (!manifest.success) return;

    const defaultSet = manifest.data.sets.find(s => s.isDefault);
    expect(defaultSet).toBeDefined();

    // #when — trying to delete default
    const result = await deleteSet(defaultSet!.id);

    // #then — rejected
    expect(result.success).toBe(false);
  });
});

describe('PWSET-001: renameSet', () => {
  it('updates set name in manifest', async () => {
    // #given — default manifest
    const manifest = await loadManifest();
    expect(manifest.success).toBe(true);
    if (!manifest.success) return;

    const defaultSet = manifest.data.sets[0]!;

    // #when — renaming
    const result = await renameSet(defaultSet.id, 'Personal');

    // #then — name updated
    expect(result.success).toBe(true);
    const list = await listSets();
    if (list.success) {
      expect(list.data[0]!.name).toBe('Personal');
    }
  });

  it('rejects empty/whitespace-only name', async () => {
    // #given — default manifest
    const manifest = await loadManifest();
    expect(manifest.success).toBe(true);
    if (!manifest.success) return;

    const defaultSet = manifest.data.sets[0]!;

    // #when — renaming with empty/whitespace
    const empty = await renameSet(defaultSet.id, '');
    const whitespace = await renameSet(defaultSet.id, '   ');

    // #then — both rejected
    expect(empty.success).toBe(false);
    expect(whitespace.success).toBe(false);
  });
});
