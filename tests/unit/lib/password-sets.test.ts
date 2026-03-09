// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { InvalidPasswordError, StorageError } from '@/lib/errors';
import {
  setStorageKey,
  MANIFEST_VERSION,
  loadManifest,
  createSet,
  deleteSet,
  renameSet,
  listSets,
  saveSetData,
  loadSetData,
  hasSetData,
  getActiveSetId,
  setActiveSetId,
} from '@/lib/password-sets';
import { validateEncryptedStore } from '@/lib/storage';

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

    const defaultSet = manifest.data.sets[0]!;
    // createSet already persisted the manifest; only flip activeSetId
    const afterCreate = await loadManifest();
    if (!afterCreate.success) return;
    await browser.storage.local.set({
      hush_manifest: { ...afterCreate.data, activeSetId: created.data.id },
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

describe('PWSET-002: per-set encrypted data', { timeout: 120_000 }, () => {
  it('saveSetData encrypts and stores under set-specific key', async () => {
    // #given — a non-default set exists
    await loadManifest();
    const created = await createSet('Work');
    expect(created.success).toBe(true);
    if (!created.success) return;

    const storageKey = setStorageKey(created.data.id, false);

    // #when — saving encrypted data
    const result = await saveSetData(created.data.id, 'secret bookmarks', 'mypassword');

    // #then — success and EncryptedStore shape stored under set-specific key
    expect(result.success).toBe(true);
    const raw = await browser.storage.local.get(storageKey);
    expect(validateEncryptedStore(raw[storageKey])).toBe(true);
  });

  it('loadSetData decrypts data (roundtrip)', async () => {
    // #given — a set with saved encrypted data
    await loadManifest();
    const created = await createSet('Roundtrip');
    expect(created.success).toBe(true);
    if (!created.success) return;

    const plaintext = 'my secret bookmarks JSON';
    await saveSetData(created.data.id, plaintext, 'testpass');

    // #when — loading with correct password
    const result = await loadSetData(created.data.id, 'testpass');

    // #then — original plaintext recovered
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(plaintext);
    }
  });

  it('saveSetData for default set stores under holyPrivateData', async () => {
    // #given — default manifest
    const manifest = await loadManifest();
    expect(manifest.success).toBe(true);
    if (!manifest.success) return;

    const defaultSet = manifest.data.sets[0]!;

    // #when — saving data for default set
    await saveSetData(defaultSet.id, 'default data', 'pw');

    // #then — stored under holyPrivateData key
    const raw = await browser.storage.local.get('holyPrivateData');
    expect(validateEncryptedStore(raw['holyPrivateData'])).toBe(true);
  });

  it('loadSetData returns not_found when set has no data', async () => {
    // #given — a set exists but no data saved
    await loadManifest();
    const created = await createSet('Empty');
    expect(created.success).toBe(true);
    if (!created.success) return;

    // #when — loading data
    const result = await loadSetData(created.data.id, 'anypass');

    // #then — not_found error
    expect(result.success).toBe(false);
    if (!result.success && result.error instanceof StorageError) {
      expect(result.error.context.reason).toBe('not_found');
    }
  });

  it('loadSetData returns InvalidPasswordError for wrong password', async () => {
    // #given — set with data encrypted under 'correct'
    await loadManifest();
    const created = await createSet('Locked');
    expect(created.success).toBe(true);
    if (!created.success) return;

    await saveSetData(created.data.id, 'secret', 'correct');

    // #when — loading with wrong password
    const result = await loadSetData(created.data.id, 'wrong');

    // #then — InvalidPasswordError
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InvalidPasswordError);
    }
  });

  it('hasSetData returns true/false correctly', async () => {
    // #given — a set with no data
    await loadManifest();
    const created = await createSet('Check');
    expect(created.success).toBe(true);
    if (!created.success) return;

    // #when — checking before save
    const before = await hasSetData(created.data.id);
    expect(before.success).toBe(true);
    if (before.success) expect(before.data).toBe(false);

    // #when — checking after save
    await saveSetData(created.data.id, 'data', 'pw');
    const after = await hasSetData(created.data.id);
    expect(after.success).toBe(true);
    if (after.success) expect(after.data).toBe(true);
  });

  it('saveSetData returns not_found for non-existent set ID', async () => {
    // #given — default manifest only
    await loadManifest();

    // #when — saving to a set that doesn't exist
    const result = await saveSetData('non-existent-id', 'data', 'pw');

    // #then — not_found error
    expect(result.success).toBe(false);
    if (!result.success && result.error instanceof StorageError) {
      expect(result.error.context.reason).toBe('not_found');
    }
  });

  it('loadSetData returns corrupted for malformed store data', async () => {
    // #given — a set with malformed data in storage
    await loadManifest();
    const created = await createSet('Broken');
    expect(created.success).toBe(true);
    if (!created.success) return;

    const storageKey = setStorageKey(created.data.id, false);
    await browser.storage.local.set({ [storageKey]: { bad: 'shape' } });

    // #when — loading the corrupted data
    const result = await loadSetData(created.data.id, 'pw');

    // #then — corrupted error
    expect(result.success).toBe(false);
    if (!result.success && result.error instanceof StorageError) {
      expect(result.error.context.reason).toBe('corrupted');
    }
  });

  it('different sets are cryptographically independent', async () => {
    // #given — two sets with data under different passwords
    await loadManifest();
    const set1 = await createSet('Set A');
    const set2 = await createSet('Set B');
    expect(set1.success).toBe(true);
    expect(set2.success).toBe(true);
    if (!set1.success || !set2.success) return;

    await saveSetData(set1.data.id, 'data-A', 'password-A');
    await saveSetData(set2.data.id, 'data-B', 'password-B');

    // #when — cross-decrypting set1's data with set2's password
    const crossResult = await loadSetData(set1.data.id, 'password-B');

    // #then — fails with InvalidPasswordError
    expect(crossResult.success).toBe(false);
    if (!crossResult.success) {
      expect(crossResult.error).toBeInstanceOf(InvalidPasswordError);
    }
  });
});

describe('PWSET-003: active set switching', () => {
  it('getActiveSetId returns default set id on fresh manifest', async () => {
    // #given — fresh manifest (auto-created)
    const manifest = await loadManifest();
    expect(manifest.success).toBe(true);
    if (!manifest.success) return;

    // #when — getting active set id
    const result = await getActiveSetId();

    // #then — matches default set's id
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(manifest.data.activeSetId);
      expect(result.data).toBe(manifest.data.sets[0]!.id);
    }
  });

  it('setActiveSetId updates manifest', async () => {
    // #given — default manifest + a second set
    await loadManifest();
    const created = await createSet('Other');
    expect(created.success).toBe(true);
    if (!created.success) return;

    // #when — switching active set
    const result = await setActiveSetId(created.data.id);

    // #then — manifest reflects the change
    expect(result.success).toBe(true);
    const reloaded = await loadManifest();
    expect(reloaded.success).toBe(true);
    if (reloaded.success) {
      expect(reloaded.data.activeSetId).toBe(created.data.id);
    }
  });

  it('setActiveSetId rejects non-existent set id', async () => {
    // #given — default manifest
    await loadManifest();

    // #when — switching to a bogus id
    const result = await setActiveSetId('non-existent-id');

    // #then — fails with not_found
    expect(result.success).toBe(false);
    if (!result.success && result.error instanceof StorageError) {
      expect(result.error.context.reason).toBe('not_found');
    }
  });
});

describe('PWSET-003: lastAccessedAt tracking', { timeout: 120_000 }, () => {
  it('loadSetData updates lastAccessedAt on success', async () => {
    // #given — a set with saved data
    const manifest = await loadManifest();
    expect(manifest.success).toBe(true);
    if (!manifest.success) return;

    const created = await createSet('Tracked');
    expect(created.success).toBe(true);
    if (!created.success) return;

    await saveSetData(created.data.id, 'secret', 'pw');
    const before = await loadManifest();
    expect(before.success).toBe(true);
    if (!before.success) return;
    const originalTimestamp = before.data.sets.find(s => s.id === created.data.id)!.lastAccessedAt;

    // #when — loading set data successfully (after a brief delay for timestamp difference)
    await new Promise(resolve => setTimeout(resolve, 10));
    const loadResult = await loadSetData(created.data.id, 'pw');
    expect(loadResult.success).toBe(true);

    // #then — lastAccessedAt is updated
    const after = await loadManifest();
    expect(after.success).toBe(true);
    if (after.success) {
      const updatedTimestamp = after.data.sets.find(s => s.id === created.data.id)!.lastAccessedAt;
      expect(updatedTimestamp).toBeGreaterThan(originalTimestamp);
    }
  });

  it('loadSetData does NOT update lastAccessedAt on failure', async () => {
    // #given — a set with saved data
    await loadManifest();
    const created = await createSet('NoUpdate');
    expect(created.success).toBe(true);
    if (!created.success) return;

    await saveSetData(created.data.id, 'data', 'correct');
    const before = await loadManifest();
    expect(before.success).toBe(true);
    if (!before.success) return;
    const originalTimestamp = before.data.sets.find(s => s.id === created.data.id)!.lastAccessedAt;

    // #when — loading with wrong password
    await new Promise(resolve => setTimeout(resolve, 10));
    const loadResult = await loadSetData(created.data.id, 'wrong');
    expect(loadResult.success).toBe(false);

    // #then — lastAccessedAt unchanged
    const after = await loadManifest();
    expect(after.success).toBe(true);
    if (after.success) {
      const unchangedTimestamp = after.data.sets.find(s => s.id === created.data.id)!.lastAccessedAt;
      expect(unchangedTimestamp).toBe(originalTimestamp);
    }
  });
});
