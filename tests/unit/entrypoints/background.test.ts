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
}));

vi.mock('@/lib/data-model', () => ({
  addBookmark: vi.fn(),
}));

vi.mock('@/lib/incognito', () => ({
  determineMode: vi.fn().mockReturnValue('normal_mode'),
}));

import {
  handleMessage, onAlarmFired, registerContextMenu, onContextMenuClicked,
} from '@/entrypoints/background';
import type { BackgroundResponse, MessageType, SessionState } from '@/lib/background-types';
import type { BookmarkTree, PasswordSetInfo } from '@/lib/types';
import { getActiveSetId, hasSetData, loadSetData, listSets, saveSetData } from '@/lib/password-sets';
import { addBookmark } from '@/lib/data-model';
import { captureException } from '@/lib/sentry';
import { determineMode } from '@/lib/incognito';
import { InvalidPasswordError, StorageError } from '@/lib/errors';

const UNIMPLEMENTED_TYPES: MessageType[] = [
  'CHANGE_PASSWORD', 'UPDATE_AUTO_LOCK', 'CREATE_SET', 'RENAME_SET',
  'DELETE_SET', 'SWITCH_SET', 'CLEAR_ALL',
  'IMPORT_CHROME_BOOKMARKS', 'IMPORT_BACKUP', 'EXPORT_BACKUP',
];

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

function buildMessage(type: MessageType) {
  const tree: BookmarkTree = TEST_TREE;
  switch (type) {
    case 'UNLOCK': return { type, password: 'p' } as const;
    case 'LOCK': return { type } as const;
    case 'SAVE': return { type, tree } as const;
    case 'GET_STATE': return { type } as const;
    case 'ADD_BOOKMARK': return { type, url: 'https://x.com', title: 't' } as const;
    case 'GET_INCOGNITO_STATE': return { type } as const;
    case 'CHANGE_PASSWORD': return { type, currentPassword: 'a', newPassword: 'b' } as const;
    case 'UPDATE_AUTO_LOCK': return { type, minutes: 5 } as const;
    case 'CREATE_SET': return { type, name: 'n', password: 'p' } as const;
    case 'RENAME_SET': return { type, setId: '1', newName: 'n' } as const;
    case 'DELETE_SET': return { type, setId: '1' } as const;
    case 'SWITCH_SET': return { type, setId: '1', password: 'p' } as const;
    case 'CLEAR_ALL': return { type, confirmation: 'DELETE' } as const;
    case 'IMPORT_CHROME_BOOKMARKS': return { type } as const;
    case 'IMPORT_BACKUP': return { type, blob: 'b64', password: 'p' } as const;
    case 'EXPORT_BACKUP': return { type } as const;
  }
}

describe('handleMessage — unimplemented types', () => {
  for (const type of UNIMPLEMENTED_TYPES) {
    it(`returns NOT_IMPLEMENTED for ${type}`, async () => {
      // #given
      const msg = buildMessage(type);
      // #when
      const response: BackgroundResponse = await handleMessage(msg);
      // #then
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBe('NOT_IMPLEMENTED');
        expect(response.code).toBe(type);
      }
    });
  }

  it('covers all 10 unimplemented message types', () => {
    expect(UNIMPLEMENTED_TYPES).toHaveLength(10);
  });
});

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
