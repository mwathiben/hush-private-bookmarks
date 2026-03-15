// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('@/lib/sentry', () => ({
  initSentry: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/lib/password-sets', () => ({
  getActiveSetId: vi.fn(),
  hasSetData: vi.fn(),
  loadSetData: vi.fn(),
  listSets: vi.fn(),
  saveSetData: vi.fn(),
  createSet: vi.fn(),
  deleteSet: vi.fn(),
  renameSet: vi.fn(),
  setActiveSetId: vi.fn(),
}));

vi.mock('@/lib/data-model', () => ({
  addBookmark: vi.fn(),
  createEmptyTree: vi.fn(),
}));

vi.mock('@/lib/incognito', () => ({
  determineMode: vi.fn().mockReturnValue('normal_mode'),
}));

vi.mock('@/lib/bookmark-import', () => ({
  convertChromeBookmarks: vi.fn(),
}));

vi.mock('@/lib/bookmark-backup', () => ({
  exportEncryptedBackup: vi.fn(),
  importEncryptedBackup: vi.fn(),
}));

import {
  handleMessage, onAlarmFired, registerContextMenu, onContextMenuClicked,
} from '@/entrypoints/background';
import type { BackgroundResponse, SessionState } from '@/lib/background-types';
import type { BookmarkTree, PasswordSetInfo } from '@/lib/types';
import {
  getActiveSetId, hasSetData, loadSetData, listSets, saveSetData,
  createSet, deleteSet, renameSet, setActiveSetId,
} from '@/lib/password-sets';
import { addBookmark, createEmptyTree } from '@/lib/data-model';
import { captureException } from '@/lib/sentry';
import { determineMode } from '@/lib/incognito';
import { InvalidPasswordError, StorageError, ImportError } from '@/lib/errors';
import { convertChromeBookmarks } from '@/lib/bookmark-import';
import { exportEncryptedBackup, importEncryptedBackup } from '@/lib/bookmark-backup';

const TEST_TREE: BookmarkTree = { type: 'folder', id: 'r', name: 'Root', children: [], dateAdded: 0 };

const TEST_SETS: readonly PasswordSetInfo[] = [{
  id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true,
}];

function mockSuccessfulUnlock(): void {
  vi.mocked(getActiveSetId).mockResolvedValue({ success: true, data: 'default' });
  vi.mocked(loadSetData).mockResolvedValue({ success: true, data: JSON.stringify(TEST_TREE) });
  vi.mocked(listSets).mockResolvedValue({ success: true, data: TEST_SETS });
  vi.mocked(hasSetData).mockResolvedValue({ success: true, data: true });
  vi.spyOn(browser.extension, 'isAllowedIncognitoAccess')
    .mockImplementation(() => Promise.resolve(false));
}

describe('handleMessage — UNLOCK', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await handleMessage({ type: 'LOCK' });
  });

  it('decrypts active set and returns SessionState', async () => {
    // #given
    mockSuccessfulUnlock();
    // #when
    const response = await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as SessionState;
      expect(state.isUnlocked).toBe(true);
      expect(state.activeSetId).toBe('default');
      expect(state.tree).toEqual(TEST_TREE);
    }
  });

  it('persists state to chrome.storage.session', async () => {
    // #given
    mockSuccessfulUnlock();
    // #when
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #then
    const stored = await browser.storage.session.get('sessionState');
    const state = stored['sessionState'] as SessionState;
    expect(state.isUnlocked).toBe(true);
    expect(state.activeSetId).toBe('default');
  });

  it('does not persist password to storage.session', async () => {
    // #given
    mockSuccessfulUnlock();
    const password = 'secret-pw-12345';
    // #when
    await handleMessage({ type: 'UNLOCK', password });
    // #then
    const allStored = await browser.storage.session.get(null);
    const serialized = JSON.stringify(allStored);
    expect(serialized).not.toContain(password);
  });

  it('starts auto-lock alarm', async () => {
    // #given
    mockSuccessfulUnlock();
    // #when
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #then
    const alarm = await browser.alarms.get('hush_auto_lock');
    expect(alarm).toBeDefined();
  });

  it('returns INVALID_PASSWORD for wrong password', async () => {
    // #given
    vi.mocked(getActiveSetId).mockResolvedValue({ success: true, data: 'default' });
    vi.mocked(loadSetData).mockResolvedValue({
      success: false,
      error: new InvalidPasswordError('wrong'),
    });
    // #when
    const response = await handleMessage({ type: 'UNLOCK', password: 'wrong' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error).toBe('Invalid password');
      expect(response.code).toBe('INVALID_PASSWORD');
    }
  });

  it('returns STORAGE_ERROR when getActiveSetId fails', async () => {
    // #given
    vi.mocked(getActiveSetId).mockResolvedValue({
      success: false,
      error: new StorageError('read_failed', { operation: 'read', reason: 'read_failed' }),
    });
    // #when
    const response = await handleMessage({ type: 'UNLOCK', password: 'pw' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('STORAGE_ERROR');
    }
  });

  it('returns STORAGE_ERROR when loadSetData fails with non-password error', async () => {
    // #given
    vi.mocked(getActiveSetId).mockResolvedValue({ success: true, data: 'default' });
    vi.mocked(loadSetData).mockResolvedValue({
      success: false,
      error: new StorageError('read_failed', { operation: 'read', reason: 'read_failed' }),
    });
    // #when
    const response = await handleMessage({ type: 'UNLOCK', password: 'pw' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('STORAGE_ERROR');
    }
  });

  it('returns PARSE_ERROR when decrypted data is invalid JSON', async () => {
    // #given
    vi.mocked(getActiveSetId).mockResolvedValue({ success: true, data: 'default' });
    vi.mocked(loadSetData).mockResolvedValue({ success: true, data: 'not-json{{{' });
    // #when
    const response = await handleMessage({ type: 'UNLOCK', password: 'pw' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('PARSE_ERROR');
    }
  });

  it('uses explicit setId when provided', async () => {
    // #given
    mockSuccessfulUnlock();
    // #when
    await handleMessage({ type: 'UNLOCK', password: 'pw', setId: 'custom-set' });
    // #then
    expect(vi.mocked(loadSetData)).toHaveBeenCalledWith('custom-set', 'pw');
  });
});

describe('handleMessage — LOCK', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('clears session state and returns locked on GET_STATE', async () => {
    // #given
    mockSuccessfulUnlock();
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    const lockResponse = await handleMessage({ type: 'LOCK' });
    // #then
    expect(lockResponse.success).toBe(true);
    const stateResponse = await handleMessage({ type: 'GET_STATE' });
    expect(stateResponse.success).toBe(true);
    if (stateResponse.success) {
      const state = stateResponse.data as SessionState;
      expect(state.isUnlocked).toBe(false);
    }
  });

  it('clears auto-lock alarm', async () => {
    // #given
    mockSuccessfulUnlock();
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    await handleMessage({ type: 'LOCK' });
    // #then
    const alarm = await browser.alarms.get('hush_auto_lock');
    expect(alarm).toBeUndefined();
  });
});

describe('onAlarmFired — auto-lock', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('locks session when auto-lock alarm fires', async () => {
    // #given
    mockSuccessfulUnlock();
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    onAlarmFired({ name: 'hush_auto_lock' });
    await new Promise(resolve => setTimeout(resolve, 10));
    // #then
    const response = await handleMessage({ type: 'GET_STATE' });
    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as SessionState;
      expect(state.isUnlocked).toBe(false);
    }
  });
});

describe('handleMessage — GET_STATE', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
    vi.mocked(listSets).mockResolvedValue({ success: true, data: TEST_SETS });
    vi.mocked(hasSetData).mockResolvedValue({ success: true, data: false });
  });

  afterEach(async () => {
    await handleMessage({ type: 'LOCK' });
  });

  it('returns locked state when no session exists', async () => {
    // #when
    const response = await handleMessage({ type: 'GET_STATE' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as SessionState;
      expect(state.isUnlocked).toBe(false);
      expect(state.activeSetId).toBe('default');
      expect(state.sets).toEqual(TEST_SETS);
      expect(state.tree).toBeNull();
      expect(state.hasData).toBe(false);
    }
  });

  it('returns session state after unlock', async () => {
    // #given
    mockSuccessfulUnlock();
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    const response = await handleMessage({ type: 'GET_STATE' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as SessionState;
      expect(state.isUnlocked).toBe(true);
      expect(state.activeSetId).toBe('default');
      expect(state.tree).toEqual(TEST_TREE);
    }
  });
});

describe('handleMessage — SAVE', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await handleMessage({ type: 'LOCK' });
  });

  it('serializes tree with JSON.stringify before saveSetData', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    const newTree: BookmarkTree = {
      type: 'folder', id: 'r', name: 'Root', dateAdded: 0,
      children: [{ type: 'bookmark', id: 'b1', title: 'Test', url: 'https://x.com', dateAdded: 1 }],
    };
    // #when
    const response = await handleMessage({ type: 'SAVE', tree: newTree });
    // #then
    expect(response.success).toBe(true);
    expect(vi.mocked(saveSetData)).toHaveBeenCalledWith('default', JSON.stringify(newTree), 'test-pw');
  });

  it('resets auto-lock alarm on success', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    await handleMessage({ type: 'SAVE', tree: TEST_TREE });
    // #then
    const alarm = await browser.alarms.get('hush_auto_lock');
    expect(alarm).toBeDefined();
  });

  it('returns NOT_UNLOCKED when no cached password', async () => {
    // #when
    const response = await handleMessage({ type: 'SAVE', tree: TEST_TREE });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
  });

  it('updates session state tree after save', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    const newTree: BookmarkTree = {
      type: 'folder', id: 'r', name: 'Updated', dateAdded: 0, children: [],
    };
    // #when
    await handleMessage({ type: 'SAVE', tree: newTree });
    // #then
    const stateResponse = await handleMessage({ type: 'GET_STATE' });
    if (stateResponse.success) {
      const state = stateResponse.data as SessionState;
      expect(state.tree).toEqual(newTree);
    }
  });

  it('returns STORAGE_ERROR when saveSetData fails', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({
      success: false,
      error: new StorageError('write_failed', { operation: 'write', reason: 'write_failed' }),
    });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    const response = await handleMessage({ type: 'SAVE', tree: TEST_TREE });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('STORAGE_ERROR');
    }
  });

  it('returns NOT_UNLOCKED when session state is null despite cached password', async () => {
    // #given — unlock then externally clear session storage
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    await browser.storage.session.clear();
    // #when
    const response = await handleMessage({ type: 'SAVE', tree: TEST_TREE });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
  });
});

describe('handleMessage — ADD_BOOKMARK', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await handleMessage({ type: 'LOCK' });
  });

  it('adds bookmark to tree and saves', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    const updatedTree: BookmarkTree = {
      type: 'folder', id: 'r', name: 'Root', dateAdded: 0,
      children: [{ type: 'bookmark', id: 'new-1', title: 'New', url: 'https://new.com', dateAdded: 1 }],
    };
    vi.mocked(addBookmark).mockReturnValue({ success: true, data: updatedTree });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    const response = await handleMessage({ type: 'ADD_BOOKMARK', url: 'https://new.com', title: 'New' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data).toEqual(updatedTree);
    }
    expect(vi.mocked(addBookmark)).toHaveBeenCalledWith(
      TEST_TREE, [],
      expect.objectContaining({ type: 'bookmark', title: 'New', url: 'https://new.com' }),
    );
    expect(vi.mocked(saveSetData)).toHaveBeenCalledWith('default', JSON.stringify(updatedTree), 'test-pw');
  });

  it('resets auto-lock alarm on success', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    const updatedTree: BookmarkTree = { ...TEST_TREE, children: [] };
    vi.mocked(addBookmark).mockReturnValue({ success: true, data: updatedTree });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    await handleMessage({ type: 'ADD_BOOKMARK', url: 'https://x.com', title: 't' });
    // #then
    const alarm = await browser.alarms.get('hush_auto_lock');
    expect(alarm).toBeDefined();
  });

  it('returns NOT_UNLOCKED when no cached password', async () => {
    // #when
    const response = await handleMessage({ type: 'ADD_BOOKMARK', url: 'https://x.com', title: 't' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
  });

  it('uses parentPath when provided', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    vi.mocked(addBookmark).mockReturnValue({ success: true, data: TEST_TREE });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    await handleMessage({ type: 'ADD_BOOKMARK', url: 'https://x.com', title: 't', parentPath: [0, 1] });
    // #then
    expect(vi.mocked(addBookmark)).toHaveBeenCalledWith(
      TEST_TREE, [0, 1],
      expect.objectContaining({ type: 'bookmark' }),
    );
  });

  it('returns DATA_MODEL_ERROR when addBookmark fails', async () => {
    // #given
    mockSuccessfulUnlock();
    const { DataModelError } = await import('@/lib/errors');
    vi.mocked(addBookmark).mockReturnValue({
      success: false,
      error: new DataModelError('Path not found', { kind: 'path_not_found' }),
    });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    const response = await handleMessage({ type: 'ADD_BOOKMARK', url: 'https://x.com', title: 't' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('DATA_MODEL_ERROR');
    }
  });

  it('returns NOT_UNLOCKED when session tree is null', async () => {
    // #given — unlock, then set session state with null tree
    mockSuccessfulUnlock();
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    const noTreeState: SessionState = {
      isUnlocked: true, activeSetId: 'default', sets: [],
      tree: null, incognitoMode: 'normal_mode', hasData: true,
    };
    await browser.storage.session.set({ sessionState: noTreeState });
    // #when
    const response = await handleMessage({ type: 'ADD_BOOKMARK', url: 'https://x.com', title: 't' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
  });

  it('does not update session when saveSetData fails', async () => {
    // #given
    mockSuccessfulUnlock();
    const updatedTree: BookmarkTree = { ...TEST_TREE, name: 'Modified' };
    vi.mocked(addBookmark).mockReturnValue({ success: true, data: updatedTree });
    vi.mocked(saveSetData).mockResolvedValue({
      success: false,
      error: new StorageError('write_failed', { operation: 'write', reason: 'write_failed' }),
    });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    // #when
    const response = await handleMessage({ type: 'ADD_BOOKMARK', url: 'https://x.com', title: 't' });
    // #then
    expect(response.success).toBe(false);
    const stateResponse = await handleMessage({ type: 'GET_STATE' });
    if (stateResponse.success) {
      const state = stateResponse.data as SessionState;
      expect(state.tree).toEqual(TEST_TREE);
    }
  });
});

describe('context menu registration', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('registers context menu on startup', async () => {
    // #given
    const removeAllSpy = vi.spyOn(browser.contextMenus, 'removeAll')
      .mockResolvedValue();
    const createSpy = vi.spyOn(browser.contextMenus, 'create')
      .mockReturnValue(1);
    vi.spyOn(browser.contextMenus.onClicked, 'addListener')
      .mockImplementation(() => {});
    // #when
    await registerContextMenu();
    // #then
    expect(removeAllSpy).toHaveBeenCalledOnce();
    expect(createSpy).toHaveBeenCalledWith({
      id: 'add-to-hush',
      title: 'Add to Hush',
      contexts: ['page', 'link'],
    });
  });

  it('context menu click triggers ADD_BOOKMARK with parentPath: []', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    const updatedTree: BookmarkTree = { ...TEST_TREE };
    vi.mocked(addBookmark).mockReturnValue({ success: true, data: updatedTree });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    const info = {
      menuItemId: 'add-to-hush',
      editable: false,
      pageUrl: 'https://example.com',
    };
    const tab = {
      id: 1, index: 0, highlighted: false, active: true, pinned: false,
      incognito: false, url: 'https://example.com', title: 'Example Page',
    };
    // #when
    onContextMenuClicked(
      info as unknown as Parameters<typeof onContextMenuClicked>[0],
      tab as unknown as Parameters<typeof onContextMenuClicked>[1],
    );
    await new Promise(resolve => setTimeout(resolve, 10));
    // #then
    expect(vi.mocked(addBookmark)).toHaveBeenCalledWith(
      TEST_TREE, [],
      expect.objectContaining({ type: 'bookmark', title: 'Example Page', url: 'https://example.com' }),
    );
    // cleanup
    await handleMessage({ type: 'LOCK' });
  });
});

describe('handleMessage — GET_INCOGNITO_STATE', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('returns resolved incognito mode', async () => {
    // #given
    vi.spyOn(browser.extension, 'isAllowedIncognitoAccess')
      .mockImplementation(() => Promise.resolve(true));
    vi.mocked(determineMode).mockReturnValue('incognito_active');
    // #when
    const response = await handleMessage({ type: 'GET_INCOGNITO_STATE' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data).toBe('incognito_active');
    }
    expect(vi.mocked(determineMode)).toHaveBeenCalledWith({
      isIncognitoContext: false,
      isAllowedIncognito: true,
    });
  });
});

describe('Sentry error wiring', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('handleMessage rejection is caught by captureException wrapper', async () => {
    // #given — force handleMessage to reject
    vi.mocked(getActiveSetId).mockRejectedValue(new Error('unexpected crash'));
    // #when — mirror the defineBackground wrapper pattern
    const response = await handleMessage({ type: 'UNLOCK', password: 'pw' }).catch(
      (err: unknown): BackgroundResponse => {
        captureException(err);
        return { success: false, error: 'Internal error', code: 'INTERNAL_ERROR' };
      },
    );
    // #then
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(response).toEqual({ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' });
  });
});

describe('handleMessage — CHANGE_PASSWORD', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await handleMessage({ type: 'LOCK' });
  });

  it('decrypts with old password and re-encrypts with new', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    await handleMessage({ type: 'UNLOCK', password: 'old-pw' });
    vi.mocked(loadSetData).mockResolvedValue({ success: true, data: '{"tree":"data"}' });
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    // #when
    const response = await handleMessage({
      type: 'CHANGE_PASSWORD', currentPassword: 'old-pw', newPassword: 'new-pw',
    });
    // #then
    expect(response.success).toBe(true);
    expect(vi.mocked(loadSetData)).toHaveBeenCalledWith('default', 'old-pw');
    expect(vi.mocked(saveSetData)).toHaveBeenCalledWith('default', '{"tree":"data"}', 'new-pw');
  });

  it('returns INVALID_PASSWORD for wrong current password', async () => {
    // #given
    mockSuccessfulUnlock();
    await handleMessage({ type: 'UNLOCK', password: 'pw' });
    vi.mocked(loadSetData).mockResolvedValue({
      success: false, error: new InvalidPasswordError('wrong'),
    });
    // #when
    const response = await handleMessage({
      type: 'CHANGE_PASSWORD', currentPassword: 'wrong', newPassword: 'new',
    });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_PASSWORD');
    }
  });

  it('returns NOT_UNLOCKED when locked', async () => {
    // #when
    const response = await handleMessage({
      type: 'CHANGE_PASSWORD', currentPassword: 'a', newPassword: 'b',
    });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
  });

  it('returns STORAGE_ERROR when re-encrypt fails', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    await handleMessage({ type: 'UNLOCK', password: 'old-pw' });
    vi.mocked(loadSetData).mockResolvedValue({ success: true, data: '{"tree":"data"}' });
    vi.mocked(saveSetData).mockResolvedValue({
      success: false,
      error: new StorageError('write_failed', { operation: 'write', reason: 'write_failed' }),
    });
    // #when
    const response = await handleMessage({
      type: 'CHANGE_PASSWORD', currentPassword: 'old-pw', newPassword: 'new-pw',
    });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('STORAGE_ERROR');
    }
  });
});

describe('handleMessage — UPDATE_AUTO_LOCK', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('clears and recreates alarm with new minutes', async () => {
    // #when
    const response = await handleMessage({ type: 'UPDATE_AUTO_LOCK', minutes: 5 });
    // #then
    expect(response.success).toBe(true);
    const alarm = await browser.alarms.get('hush_auto_lock');
    expect(alarm).toBeDefined();
  });

  it('rejects 0 minutes', async () => {
    // #when
    const response = await handleMessage({ type: 'UPDATE_AUTO_LOCK', minutes: 0 });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_INPUT');
    }
  });

  it('rejects negative minutes', async () => {
    // #when
    const response = await handleMessage({ type: 'UPDATE_AUTO_LOCK', minutes: -5 });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_INPUT');
    }
  });

  it('rejects float minutes', async () => {
    // #when
    const response = await handleMessage({ type: 'UPDATE_AUTO_LOCK', minutes: 5.5 });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_INPUT');
    }
  });
});

describe('handleMessage — CREATE_SET', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('creates set in manifest and saves empty tree encrypted', async () => {
    // #given
    const newSet = { id: 'new-id', name: 'Work', createdAt: 1, lastAccessedAt: 1, isDefault: false };
    const setsAfterCreate: readonly PasswordSetInfo[] = [...TEST_SETS, newSet];
    vi.mocked(createSet).mockResolvedValue({ success: true, data: newSet });
    vi.mocked(createEmptyTree).mockReturnValue(TEST_TREE);
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    vi.mocked(setActiveSetId).mockResolvedValue({ success: true, data: undefined });
    vi.mocked(listSets).mockResolvedValue({ success: true, data: setsAfterCreate });
    vi.mocked(determineMode).mockReturnValue('normal_mode');
    vi.spyOn(browser.extension, 'isAllowedIncognitoAccess')
      .mockImplementation(() => Promise.resolve(false));
    // #when
    const response = await handleMessage({ type: 'CREATE_SET', name: 'Work', password: 'pw' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data).toEqual({
        isUnlocked: true,
        activeSetId: 'new-id',
        hasData: true,
        sets: setsAfterCreate,
        tree: TEST_TREE,
        incognitoMode: 'normal_mode',
      });
    }
    expect(vi.mocked(createSet)).toHaveBeenCalledWith('Work');
    expect(vi.mocked(saveSetData)).toHaveBeenCalledWith('new-id', JSON.stringify(TEST_TREE), 'pw');
    expect(vi.mocked(setActiveSetId)).toHaveBeenCalledWith('new-id');

    const stored = await browser.storage.session.get('sessionState');
    expect(stored['sessionState']).toEqual({
      isUnlocked: true,
      activeSetId: 'new-id',
      hasData: true,
      sets: setsAfterCreate,
      tree: TEST_TREE,
      incognitoMode: 'normal_mode',
    });
  });

  it('returns STORAGE_ERROR when createSet fails', async () => {
    // #given
    vi.mocked(createSet).mockResolvedValue({
      success: false,
      error: new StorageError('write_failed', { operation: 'write', reason: 'write_failed' }),
    });
    // #when
    const response = await handleMessage({ type: 'CREATE_SET', name: 'X', password: 'pw' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('STORAGE_ERROR');
    }
  });

  it('returns STORAGE_ERROR when saveSetData fails after set creation', async () => {
    // #given
    const newSet = { id: 'new-id', name: 'Work', createdAt: 1, lastAccessedAt: 1, isDefault: false };
    vi.mocked(createSet).mockResolvedValue({ success: true, data: newSet });
    vi.mocked(createEmptyTree).mockReturnValue(TEST_TREE);
    vi.mocked(saveSetData).mockResolvedValue({
      success: false,
      error: new StorageError('write_failed', { operation: 'write', reason: 'write_failed' }),
    });
    // #when
    const response = await handleMessage({ type: 'CREATE_SET', name: 'Work', password: 'pw' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('STORAGE_ERROR');
    }
  });
});

describe('handleMessage — RENAME_SET', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('renames set in manifest', async () => {
    // #given
    vi.mocked(renameSet).mockResolvedValue({ success: true, data: undefined });
    // #when
    const response = await handleMessage({ type: 'RENAME_SET', setId: 's1', newName: 'Personal' });
    // #then
    expect(response.success).toBe(true);
    expect(vi.mocked(renameSet)).toHaveBeenCalledWith('s1', 'Personal');
  });
});

describe('handleMessage — DELETE_SET', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('removes set from manifest and deletes storage key', async () => {
    // #given
    vi.mocked(deleteSet).mockResolvedValue({ success: true, data: undefined });
    // #when
    const response = await handleMessage({ type: 'DELETE_SET', setId: 's1' });
    // #then
    expect(response.success).toBe(true);
    expect(vi.mocked(deleteSet)).toHaveBeenCalledWith('s1');
  });
});

describe('handleMessage — SWITCH_SET', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await handleMessage({ type: 'LOCK' });
  });

  it('locks current set and loads new set returning SessionState', async () => {
    // #given — unlock first to have an active session
    mockSuccessfulUnlock();
    await handleMessage({ type: 'UNLOCK', password: 'pw1' });
    vi.mocked(setActiveSetId).mockResolvedValue({ success: true, data: undefined });
    vi.mocked(loadSetData).mockResolvedValue({ success: true, data: JSON.stringify(TEST_TREE) });
    vi.mocked(listSets).mockResolvedValue({ success: true, data: TEST_SETS });
    vi.spyOn(browser.extension, 'isAllowedIncognitoAccess')
      .mockImplementation(() => Promise.resolve(false));
    // #when
    const response = await handleMessage({ type: 'SWITCH_SET', setId: 'new-set', password: 'pw2' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as SessionState;
      expect(state.isUnlocked).toBe(true);
      expect(state.activeSetId).toBe('new-set');
      expect(state.tree).toEqual(TEST_TREE);
    }
    expect(vi.mocked(setActiveSetId)).toHaveBeenCalledWith('new-set');
    expect(vi.mocked(loadSetData)).toHaveBeenCalledWith('new-set', 'pw2');
  });

  it('returns INVALID_PASSWORD for wrong password', async () => {
    // #given
    vi.mocked(setActiveSetId).mockResolvedValue({ success: true, data: undefined });
    vi.mocked(loadSetData).mockResolvedValue({
      success: false, error: new InvalidPasswordError('wrong'),
    });
    // #when
    const response = await handleMessage({ type: 'SWITCH_SET', setId: 's1', password: 'wrong' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_PASSWORD');
    }
  });
});

describe('handleMessage — CLEAR_ALL', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('with confirmation DELETE clears all storage and locks session', async () => {
    // #given — unlock first
    mockSuccessfulUnlock();
    await handleMessage({ type: 'UNLOCK', password: 'pw' });
    // #when
    const response = await handleMessage({ type: 'CLEAR_ALL', confirmation: 'DELETE' });
    // #then
    expect(response.success).toBe(true);
    const stateResponse = await handleMessage({ type: 'GET_STATE' });
    if (stateResponse.success) {
      const state = stateResponse.data as SessionState;
      expect(state.isUnlocked).toBe(false);
    }
  });

  it('rejects if confirmation is not DELETE', async () => {
    // #when — cast to bypass TypeScript literal type
    const response = await handleMessage(
      { type: 'CLEAR_ALL', confirmation: 'WRONG' as 'DELETE' },
    );
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_INPUT');
    }
  });
});

describe('handleMessage — IMPORT_CHROME_BOOKMARKS', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('calls getTree, extracts children, and converts', async () => {
    // #given
    const chromeChildren = [{ id: '1', title: 'Bar', url: 'https://bar.com' }];
    vi.spyOn(browser.bookmarks, 'getTree').mockResolvedValue([
      { id: '0', title: '', children: chromeChildren },
    ] as unknown as ReturnType<typeof browser.bookmarks.getTree> extends Promise<infer U> ? U : never);
    const importedTree: BookmarkTree = { ...TEST_TREE, name: 'Imported' };
    vi.mocked(convertChromeBookmarks).mockReturnValue({
      success: true,
      data: { tree: importedTree, stats: { bookmarksImported: 1, foldersImported: 0, errors: [] } },
    });
    // #when
    const response = await handleMessage({ type: 'IMPORT_CHROME_BOOKMARKS' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      const data = response.data as { tree: BookmarkTree; stats: unknown };
      expect(data.tree).toEqual(importedTree);
    }
    expect(vi.mocked(convertChromeBookmarks)).toHaveBeenCalledWith(chromeChildren);
  });
});

describe('handleMessage — IMPORT_BACKUP', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  it('calls importEncryptedBackup with blob and password', async () => {
    // #given
    vi.mocked(importEncryptedBackup).mockResolvedValue({
      success: true, data: TEST_TREE,
    });
    // #when
    const response = await handleMessage({ type: 'IMPORT_BACKUP', blob: 'b64data', password: 'pw' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      const data = response.data as { tree: BookmarkTree };
      expect(data.tree).toEqual(TEST_TREE);
    }
    expect(vi.mocked(importEncryptedBackup)).toHaveBeenCalledWith('b64data', 'pw');
  });

  it('returns INVALID_PASSWORD when backup password is wrong', async () => {
    // #given
    vi.mocked(importEncryptedBackup).mockResolvedValue({
      success: false, error: new InvalidPasswordError('wrong password'),
    });
    // #when
    const response = await handleMessage({ type: 'IMPORT_BACKUP', blob: 'b64', password: 'wrong' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('INVALID_PASSWORD');
    }
  });

  it('returns IMPORT_ERROR for corrupted backup', async () => {
    // #given
    vi.mocked(importEncryptedBackup).mockResolvedValue({
      success: false,
      error: new ImportError('corrupted', { source: 'backup', format: 'hush-backup' }),
    });
    // #when
    const response = await handleMessage({ type: 'IMPORT_BACKUP', blob: 'bad', password: 'pw' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('IMPORT_ERROR');
    }
  });
});

describe('handleMessage — EXPORT_BACKUP', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await handleMessage({ type: 'LOCK' });
  });

  it('calls exportEncryptedBackup with cached tree and password', async () => {
    // #given
    mockSuccessfulUnlock();
    vi.mocked(saveSetData).mockResolvedValue({ success: true, data: undefined });
    await handleMessage({ type: 'UNLOCK', password: 'test-pw' });
    vi.mocked(exportEncryptedBackup).mockResolvedValue('encrypted-blob');
    // #when
    const response = await handleMessage({ type: 'EXPORT_BACKUP' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      const data = response.data as { blob: string };
      expect(data.blob).toBe('encrypted-blob');
    }
    expect(vi.mocked(exportEncryptedBackup)).toHaveBeenCalledWith(TEST_TREE, 'test-pw');
  });

  it('returns NOT_UNLOCKED when session is locked', async () => {
    // #when
    const response = await handleMessage({ type: 'EXPORT_BACKUP' });
    // #then
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.code).toBe('NOT_UNLOCKED');
    }
  });
});
