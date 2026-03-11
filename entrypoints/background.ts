import { initSentry, captureException } from '@/lib/sentry';
import { getActiveSetId, loadSetData, listSets } from '@/lib/password-sets';
import { determineMode } from '@/lib/incognito';
import { InvalidPasswordError } from '@/lib/errors';
import type {
  BackgroundMessage,
  BackgroundResponse,
  SessionState,
  UnlockMessage,
} from '@/lib/background-types';
import type { BookmarkTree } from '@/lib/types';

initSentry();

const AUTO_LOCK_ALARM = 'hush_auto_lock';
const DEFAULT_AUTO_LOCK_MINUTES = 10;
const SESSION_KEY = 'sessionState';

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
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof (msg as { type: unknown }).type === 'string' &&
    VALID_TYPES.has((msg as { type: unknown }).type as string)
  );
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
  } catch {
    // Not available in all contexts — default to false
  }
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
  await browser.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: DEFAULT_AUTO_LOCK_MINUTES });

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
  const result = await browser.storage.session.get(SESSION_KEY);
  const stored = result[SESSION_KEY] as SessionState | undefined;
  if (!stored) {
    return { success: true, data: LOCKED_STATE };
  }
  return { success: true, data: stored };
}

export function onAlarmFired(alarm: { name: string }): void {
  if (alarm.name === AUTO_LOCK_ALARM) {
    void handleLock();
  }
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
    case 'ADD_BOOKMARK':
    case 'GET_INCOGNITO_STATE':
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
  browser.alarms.onAlarm.addListener(onAlarmFired);

  browser.runtime.onMessage.addListener(
    (message: unknown): Promise<BackgroundResponse> | undefined => {
      if (!isBackgroundMessage(message)) return undefined;

      return handleMessage(message).catch(
        (err: unknown): BackgroundResponse => {
          captureException(err);
          return { success: false, error: 'INTERNAL_ERROR' };
        },
      );
    },
  );
});
