import type { Browser } from 'wxt/browser';
import { initSentry, captureException } from '@/lib/sentry';
import { getActiveSetId, loadSetData, listSets, saveSetData } from '@/lib/password-sets';
import { addBookmark } from '@/lib/data-model';
import { determineMode } from '@/lib/incognito';
import { InvalidPasswordError } from '@/lib/errors';
import type {
  AddBookmarkMessage,
  BackgroundMessage,
  BackgroundResponse,
  SaveMessage,
  SessionState,
  UnlockMessage,
} from '@/lib/background-types';
import type { BookmarkTree } from '@/lib/types';

initSentry();

const AUTO_LOCK_ALARM = 'hush_auto_lock';
const DEFAULT_AUTO_LOCK_MINUTES = 10;
const SESSION_KEY = 'sessionState';
const CONTEXT_MENU_ID = 'add-to-hush';

let cachedPassword: string | null = null;

const LOCKED_STATE: SessionState = {
  isUnlocked: false,
  activeSetId: '',
  sets: [],
  tree: null,
  incognitoMode: 'normal_mode',
};

const VALID_TYPES = new Set<string>([
  'UNLOCK', 'LOCK', 'SAVE', 'GET_STATE', 'ADD_BOOKMARK',
  'GET_INCOGNITO_STATE', 'CHANGE_PASSWORD', 'UPDATE_AUTO_LOCK',
  'CREATE_SET', 'RENAME_SET', 'DELETE_SET', 'SWITCH_SET',
  'CLEAR_ALL', 'IMPORT_CHROME_BOOKMARKS', 'IMPORT_BACKUP', 'EXPORT_BACKUP',
]);

function isBackgroundMessage(msg: unknown): msg is BackgroundMessage {
  if (typeof msg !== 'object' || msg === null || !('type' in msg)) return false;
  const t = (msg as Record<string, unknown>).type;
  return typeof t === 'string' && VALID_TYPES.has(t);
}

async function handleUnlock(msg: UnlockMessage): Promise<BackgroundResponse> {
  const setIdResult = await getActiveSetId();
  if (!setIdResult.success) {
    return { success: false, error: setIdResult.error.message, code: 'STORAGE_ERROR' };
  }
  const setId = msg.setId ?? setIdResult.data;

  const dataResult = await loadSetData(setId, msg.password);
  if (!dataResult.success) {
    if (dataResult.error instanceof InvalidPasswordError) {
      return { success: false, error: 'Invalid password', code: 'INVALID_PASSWORD' };
    }
    return { success: false, error: dataResult.error.message, code: 'STORAGE_ERROR' };
  }

  let tree: BookmarkTree;
  try {
    tree = JSON.parse(dataResult.data) as BookmarkTree;
  } catch {
    return { success: false, error: 'Corrupted data', code: 'PARSE_ERROR' };
  }

  const setsResult = await listSets();
  const sets = setsResult.success ? setsResult.data : [];

  let isAllowedIncognito = false;
  try {
    isAllowedIncognito = await browser.extension.isAllowedIncognitoAccess();
  } catch { /* not available in all contexts */ }
  const incognitoMode = determineMode({ isIncognitoContext: false, isAllowedIncognito });

  const state: SessionState = {
    isUnlocked: true,
    activeSetId: setId,
    sets,
    tree,
    incognitoMode,
  };

  await browser.storage.session.set({ [SESSION_KEY]: state });
  cachedPassword = msg.password;
  await resetAlarm();

  return { success: true, data: state };
}

async function handleLock(): Promise<BackgroundResponse> {
  cachedPassword = null;
  await browser.storage.session.clear();
  await browser.alarms.clear(AUTO_LOCK_ALARM);
  return { success: true };
}

async function handleGetState(): Promise<BackgroundResponse> {
  if (cachedPassword === null) {
    return { success: true, data: LOCKED_STATE };
  }
  const stored = await getSessionState();
  if (!stored) {
    return { success: true, data: LOCKED_STATE };
  }
  return { success: true, data: stored };
}

async function resetAlarm(): Promise<void> {
  await browser.alarms.clear(AUTO_LOCK_ALARM);
  await browser.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: DEFAULT_AUTO_LOCK_MINUTES });
}

async function getSessionState(): Promise<SessionState | null> {
  const result = await browser.storage.session.get(SESSION_KEY);
  return (result[SESSION_KEY] as SessionState | undefined) ?? null;
}

async function handleSave(msg: SaveMessage): Promise<BackgroundResponse> {
  if (cachedPassword === null) {
    return { success: false, error: 'Not unlocked', code: 'NOT_UNLOCKED' };
  }
  const state = await getSessionState();
  if (!state) {
    return { success: false, error: 'No active session', code: 'NOT_UNLOCKED' };
  }

  const json = JSON.stringify(msg.tree);
  const saveResult = await saveSetData(state.activeSetId, json, cachedPassword);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error.message, code: 'STORAGE_ERROR' };
  }

  const updatedState: SessionState = { ...state, tree: msg.tree };
  await browser.storage.session.set({ [SESSION_KEY]: updatedState });
  await resetAlarm();
  return { success: true };
}

async function handleAddBookmark(msg: AddBookmarkMessage): Promise<BackgroundResponse> {
  if (cachedPassword === null) {
    return { success: false, error: 'Not unlocked', code: 'NOT_UNLOCKED' };
  }
  const state = await getSessionState();
  if (!state || !state.tree) {
    return { success: false, error: 'No active session', code: 'NOT_UNLOCKED' };
  }

  const result = addBookmark(state.tree, msg.parentPath ?? [], {
    type: 'bookmark',
    title: msg.title,
    url: msg.url,
    dateAdded: Date.now(),
  });
  if (!result.success) {
    return { success: false, error: result.error.message, code: 'DATA_MODEL_ERROR' };
  }

  const json = JSON.stringify(result.data);
  const saveResult = await saveSetData(state.activeSetId, json, cachedPassword);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error.message, code: 'STORAGE_ERROR' };
  }

  const updatedState: SessionState = { ...state, tree: result.data };
  await browser.storage.session.set({ [SESSION_KEY]: updatedState });
  await resetAlarm();
  return { success: true, data: result.data };
}

async function handleGetIncognitoState(): Promise<BackgroundResponse> {
  let isAllowedIncognito = false;
  try {
    isAllowedIncognito = await browser.extension.isAllowedIncognitoAccess();
  } catch { /* not available in all contexts */ }
  const mode = determineMode({ isIncognitoContext: false, isAllowedIncognito });
  return { success: true, data: mode };
}

export function onAlarmFired(alarm: { name: string }): void {
  if (alarm.name === AUTO_LOCK_ALARM) {
    void handleLock().catch(captureException);
  }
}

export async function registerContextMenu(): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Add to Hush',
    contexts: ['page', 'link'],
  });
  browser.contextMenus.onClicked.addListener(onContextMenuClicked);
}

export function onContextMenuClicked(
  info: Browser.contextMenus.OnClickData,
  tab?: Browser.tabs.Tab,
): void {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  const url = info.linkUrl ?? tab?.url ?? '';
  const title = info.linkUrl
    ? (info.selectionText ?? info.linkUrl)
    : (tab?.title ?? '');
  if (!url) return;
  void handleMessage({ type: 'ADD_BOOKMARK', url, title, parentPath: [] }).catch(captureException);
}

export function handleMessage(msg: BackgroundMessage): Promise<BackgroundResponse> {
  switch (msg.type) {
    case 'UNLOCK':
      return handleUnlock(msg);
    case 'LOCK':
      return handleLock();
    case 'GET_STATE':
      return handleGetState();
    case 'SAVE':
      return handleSave(msg);
    case 'ADD_BOOKMARK':
      return handleAddBookmark(msg);
    case 'GET_INCOGNITO_STATE':
      return handleGetIncognitoState();
    case 'CHANGE_PASSWORD':
    case 'UPDATE_AUTO_LOCK':
    case 'CREATE_SET':
    case 'RENAME_SET':
    case 'DELETE_SET':
    case 'SWITCH_SET':
    case 'CLEAR_ALL':
    case 'IMPORT_CHROME_BOOKMARKS':
    case 'IMPORT_BACKUP':
    case 'EXPORT_BACKUP':
      return Promise.resolve({ success: false, error: 'NOT_IMPLEMENTED', code: msg.type });
    default: {
      const _exhaustive: never = msg;
      return _exhaustive;
    }
  }
}

export default defineBackground(() => {
  void registerContextMenu().catch(captureException);
  browser.alarms.onAlarm.addListener(onAlarmFired);

  browser.runtime.onMessage.addListener(
    (message: unknown): Promise<BackgroundResponse> | undefined => {
      if (!isBackgroundMessage(message)) return undefined;

      return handleMessage(message).catch(
        (err: unknown): BackgroundResponse => {
          captureException(err);
          return { success: false, error: 'Internal error', code: 'INTERNAL_ERROR' };
        },
      );
    },
  );
});
