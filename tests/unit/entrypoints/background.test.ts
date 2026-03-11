// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('@/lib/sentry', () => ({
  initSentry: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/lib/password-sets', () => ({
  getActiveSetId: vi.fn(),
  loadSetData: vi.fn(),
  listSets: vi.fn(),
}));

vi.mock('@/lib/incognito', () => ({
  determineMode: vi.fn().mockReturnValue('normal_mode'),
}));

import { handleMessage, onAlarmFired } from '@/entrypoints/background';
import type { BackgroundResponse, MessageType, SessionState } from '@/lib/background-types';
import type { BookmarkTree, PasswordSetInfo } from '@/lib/types';
import { getActiveSetId, loadSetData, listSets } from '@/lib/password-sets';
import { InvalidPasswordError } from '@/lib/errors';

const UNIMPLEMENTED_TYPES: MessageType[] = [
  'SAVE', 'ADD_BOOKMARK', 'GET_INCOGNITO_STATE',
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

  it('covers all 13 unimplemented message types', () => {
    expect(UNIMPLEMENTED_TYPES).toHaveLength(13);
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
  });

  afterEach(async () => {
    await handleMessage({ type: 'LOCK' });
  });

  it('returns locked state when no session exists', async () => {
    // #given — fresh state, no unlock
    // #when
    const response = await handleMessage({ type: 'GET_STATE' });
    // #then
    expect(response.success).toBe(true);
    if (response.success) {
      const state = response.data as SessionState;
      expect(state.isUnlocked).toBe(false);
      expect(state.activeSetId).toBe('');
      expect(state.tree).toBeNull();
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
