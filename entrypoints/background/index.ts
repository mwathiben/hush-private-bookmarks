import type { Browser } from 'wxt/browser';
import { initSentry, captureException } from '@/lib/sentry';
import { listSets, hasSetData } from '@/lib/password-sets';
import type {
  BackgroundMessage,
  BackgroundResponse,
  SessionState,
} from '@/lib/background-types';
import type { HandlerContext } from './handlers';
import {
  handleUnlock, handleLock, handleGetState, handleSave,
  handleAddBookmark, handleGetIncognitoState, handleChangePassword,
  handleUpdateAutoLock, handleCreateSet, handleRenameSet,
  handleDeleteSet, handleSwitchSet, handleClearAll,
  handleImportChromeBookmarks, handleImportBackup, handleExportBackup,
  handleImportHush, handleCheckProStatus,
} from './handlers';
import {
  handleSyncUpload, handleSyncDownload, handleSyncStatus,
} from './sync-handlers';
import { INITIAL_PRO_STATUS } from '@/lib/pro-gate';

initSentry();

const AUTO_LOCK_ALARM = 'hush_auto_lock';
const DEFAULT_AUTO_LOCK_MINUTES = 10;
const SESSION_KEY = 'sessionState';
const CONTEXT_MENU_ID = 'add-to-hush';

let cachedPassword: string | null = null;

async function buildLockedState(): Promise<SessionState> {
  const setsResult = await listSets();
  const sets = setsResult.success ? setsResult.data : [];
  const activeSetId = sets.find(s => s.isDefault)?.id ?? '';
  let hasData = false;
  if (activeSetId) {
    const dataResult = await hasSetData(activeSetId);
    hasData = dataResult.success ? dataResult.data : false;
  }
  return {
    isUnlocked: false, activeSetId, sets, tree: null,
    incognitoMode: 'normal_mode', hasData, proStatus: INITIAL_PRO_STATUS,
  };
}

const VALID_TYPES = new Set<string>([
  'UNLOCK', 'LOCK', 'SAVE', 'GET_STATE', 'ADD_BOOKMARK',
  'GET_INCOGNITO_STATE', 'CHANGE_PASSWORD', 'UPDATE_AUTO_LOCK',
  'CREATE_SET', 'RENAME_SET', 'DELETE_SET', 'SWITCH_SET',
  'CLEAR_ALL', 'IMPORT_CHROME_BOOKMARKS', 'IMPORT_BACKUP', 'EXPORT_BACKUP',
  'IMPORT_HUSH', 'SYNC_UPLOAD', 'SYNC_DOWNLOAD', 'SYNC_STATUS', 'CHECK_PRO_STATUS',
]);

function isBackgroundMessage(msg: unknown): msg is BackgroundMessage {
  if (typeof msg !== 'object' || msg === null || !('type' in msg)) return false;
  const t = (msg as Record<string, unknown>).type;
  return typeof t === 'string' && VALID_TYPES.has(t);
}

async function resetAlarm(minutes?: number): Promise<void> {
  await browser.alarms.clear(AUTO_LOCK_ALARM);
  await browser.alarms.create(AUTO_LOCK_ALARM, {
    delayInMinutes: minutes ?? DEFAULT_AUTO_LOCK_MINUTES,
  });
}

async function getSessionState(): Promise<SessionState | null> {
  const result = await browser.storage.session.get(SESSION_KEY);
  return (result[SESSION_KEY] as SessionState | undefined) ?? null;
}

async function setSessionState(state: SessionState): Promise<void> {
  await browser.storage.session.set({ [SESSION_KEY]: state });
}

async function clearSession(): Promise<void> {
  await browser.storage.session.clear();
}

const ctx: HandlerContext = {
  getCachedPassword: () => cachedPassword,
  setCachedPassword: (pw) => { cachedPassword = pw; },
  getSessionState,
  setSessionState,
  clearSession,
  resetAlarm,
  clearAlarm: async () => { await browser.alarms.clear(AUTO_LOCK_ALARM); },
  buildLockedState,
  clearLocalStorage: async () => { await browser.storage.local.clear(); },
  getBookmarkTree: () => browser.bookmarks.getTree(),
  isAllowedIncognitoAccess: () => browser.extension.isAllowedIncognitoAccess(),
};

export function onAlarmFired(alarm: { name: string }): void {
  if (alarm.name === AUTO_LOCK_ALARM) {
    void handleLock(ctx).catch(captureException);
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
      return handleUnlock(msg, ctx);
    case 'LOCK':
      return handleLock(ctx);
    case 'GET_STATE':
      return handleGetState(ctx);
    case 'SAVE':
      return handleSave(msg, ctx);
    case 'ADD_BOOKMARK':
      return handleAddBookmark(msg, ctx);
    case 'GET_INCOGNITO_STATE':
      return handleGetIncognitoState(ctx);
    case 'CHANGE_PASSWORD':
      return handleChangePassword(msg, ctx);
    case 'UPDATE_AUTO_LOCK':
      return handleUpdateAutoLock(msg, ctx);
    case 'CREATE_SET':
      return handleCreateSet(msg, ctx);
    case 'RENAME_SET':
      return handleRenameSet(msg);
    case 'DELETE_SET':
      return handleDeleteSet(msg);
    case 'SWITCH_SET':
      return handleSwitchSet(msg, ctx);
    case 'CLEAR_ALL':
      return handleClearAll(msg, ctx);
    case 'IMPORT_CHROME_BOOKMARKS':
      return handleImportChromeBookmarks(msg, ctx);
    case 'IMPORT_BACKUP':
      return handleImportBackup(msg);
    case 'EXPORT_BACKUP':
      return handleExportBackup(msg, ctx);
    case 'IMPORT_HUSH':
      return handleImportHush(msg);
    case 'SYNC_UPLOAD':
      return handleSyncUpload(msg);
    case 'SYNC_DOWNLOAD':
      return handleSyncDownload();
    case 'SYNC_STATUS':
      return handleSyncStatus();
    case 'CHECK_PRO_STATUS':
      return handleCheckProStatus();
    default:
      msg satisfies never;
      throw new Error(`Unhandled BackgroundMessage type: ${(msg as { type: string }).type}`);
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
