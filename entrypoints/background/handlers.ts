import {
  getActiveSetId, loadSetData, listSets, saveSetData,
  createSet, deleteSet, renameSet, setActiveSetId,
} from '@/lib/password-sets';
import { addBookmark, createEmptyTree } from '@/lib/data-model';
import { determineMode } from '@/lib/incognito';
import { InvalidPasswordError } from '@/lib/errors';
import { convertChromeBookmarks, type ChromeBookmarkTreeNode } from '@/lib/bookmark-import';
import { exportEncryptedBackup, importEncryptedBackup } from '@/lib/bookmark-backup';
import type {
  AddBookmarkMessage, BackgroundResponse, ChangePasswordMessage,
  ClearAllMessage, CreateSetMessage, DeleteSetMessage,
  ExportBackupMessage, ImportBackupMessage, ImportChromeBookmarksMessage,
  RenameSetMessage, SaveMessage, SessionState,
  SwitchSetMessage, UnlockMessage, UpdateAutoLockMessage,
} from '@/lib/background-types';
import type { BookmarkTree } from '@/lib/types';

export interface HandlerContext {
  getCachedPassword(): string | null;
  setCachedPassword(pw: string | null): void;
  getSessionState(): Promise<SessionState | null>;
  setSessionState(state: SessionState): Promise<void>;
  clearSession(): Promise<void>;
  resetAlarm(minutes?: number): Promise<void>;
  clearAlarm(): Promise<void>;
  buildLockedState(): Promise<SessionState>;
  clearLocalStorage(): Promise<void>;
  getBookmarkTree(): Promise<ChromeBookmarkTreeNode[]>;
  isAllowedIncognitoAccess(): Promise<boolean>;
}

async function loadAndActivateSet(
  setId: string, password: string, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  const dataResult = await loadSetData(setId, password);
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
    isAllowedIncognito = await ctx.isAllowedIncognitoAccess();
  } catch { /* not available in all contexts */ }

  const state: SessionState = {
    isUnlocked: true, activeSetId: setId, sets, tree,
    incognitoMode: determineMode({ isIncognitoContext: false, isAllowedIncognito }),
    hasData: true,
  };

  await ctx.setSessionState(state);
  ctx.setCachedPassword(password);
  await ctx.resetAlarm();
  return { success: true, data: state };
}

export async function handleUnlock(
  msg: UnlockMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  const setIdResult = await getActiveSetId();
  if (!setIdResult.success) {
    return { success: false, error: setIdResult.error.message, code: 'STORAGE_ERROR' };
  }
  return loadAndActivateSet(msg.setId ?? setIdResult.data, msg.password, ctx);
}

export async function handleLock(ctx: HandlerContext): Promise<BackgroundResponse> {
  ctx.setCachedPassword(null);
  await ctx.clearSession();
  await ctx.clearAlarm();
  return { success: true };
}

export async function handleGetState(ctx: HandlerContext): Promise<BackgroundResponse> {
  if (ctx.getCachedPassword() === null) {
    return { success: true, data: await ctx.buildLockedState() };
  }
  const stored = await ctx.getSessionState();
  if (!stored) {
    return { success: true, data: await ctx.buildLockedState() };
  }
  return { success: true, data: stored };
}

export async function handleSave(
  msg: SaveMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  if (ctx.getCachedPassword() === null) {
    return { success: false, error: 'Not unlocked', code: 'NOT_UNLOCKED' };
  }
  const state = await ctx.getSessionState();
  if (!state) {
    return { success: false, error: 'No active session', code: 'NOT_UNLOCKED' };
  }

  const json = JSON.stringify(msg.tree);
  const saveResult = await saveSetData(state.activeSetId, json, ctx.getCachedPassword()!);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error.message, code: 'STORAGE_ERROR' };
  }

  await ctx.setSessionState({ ...state, tree: msg.tree });
  await ctx.resetAlarm();
  return { success: true };
}

export async function handleAddBookmark(
  msg: AddBookmarkMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  if (ctx.getCachedPassword() === null) {
    return { success: false, error: 'Not unlocked', code: 'NOT_UNLOCKED' };
  }
  const state = await ctx.getSessionState();
  if (!state || !state.tree) {
    return { success: false, error: 'No active session', code: 'NOT_UNLOCKED' };
  }

  const result = addBookmark(state.tree, msg.parentPath ?? [], {
    type: 'bookmark', title: msg.title, url: msg.url, dateAdded: Date.now(),
  });
  if (!result.success) {
    return { success: false, error: result.error.message, code: 'DATA_MODEL_ERROR' };
  }

  const json = JSON.stringify(result.data);
  const saveResult = await saveSetData(state.activeSetId, json, ctx.getCachedPassword()!);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error.message, code: 'STORAGE_ERROR' };
  }

  await ctx.setSessionState({ ...state, tree: result.data });
  await ctx.resetAlarm();
  return { success: true, data: result.data };
}

export async function handleGetIncognitoState(ctx: HandlerContext): Promise<BackgroundResponse> {
  let isAllowedIncognito = false;
  try {
    isAllowedIncognito = await ctx.isAllowedIncognitoAccess();
  } catch { /* not available in all contexts */ }
  return { success: true, data: determineMode({ isIncognitoContext: false, isAllowedIncognito }) };
}

export async function handleChangePassword(
  msg: ChangePasswordMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  if (ctx.getCachedPassword() === null) {
    return { success: false, error: 'Not unlocked', code: 'NOT_UNLOCKED' };
  }
  const state = await ctx.getSessionState();
  if (!state) {
    return { success: false, error: 'No active session', code: 'NOT_UNLOCKED' };
  }

  const dataResult = await loadSetData(state.activeSetId, msg.currentPassword);
  if (!dataResult.success) {
    if (dataResult.error instanceof InvalidPasswordError) {
      return { success: false, error: 'Invalid password', code: 'INVALID_PASSWORD' };
    }
    return { success: false, error: dataResult.error.message, code: 'STORAGE_ERROR' };
  }

  const saveResult = await saveSetData(state.activeSetId, dataResult.data, msg.newPassword);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error.message, code: 'STORAGE_ERROR' };
  }
  ctx.setCachedPassword(msg.newPassword);
  return { success: true };
}

export async function handleUpdateAutoLock(
  msg: UpdateAutoLockMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  if (msg.minutes <= 0 || !Number.isInteger(msg.minutes)) {
    return { success: false, error: 'Minutes must be a positive integer', code: 'INVALID_INPUT' };
  }
  await ctx.clearAlarm();
  await ctx.resetAlarm(msg.minutes);
  return { success: true };
}

export async function handleCreateSet(msg: CreateSetMessage): Promise<BackgroundResponse> {
  const setResult = await createSet(msg.name);
  if (!setResult.success) {
    return { success: false, error: setResult.error.message, code: 'STORAGE_ERROR' };
  }
  const emptyTree = createEmptyTree();
  const saveResult = await saveSetData(setResult.data.id, JSON.stringify(emptyTree), msg.password);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error.message, code: 'STORAGE_ERROR' };
  }
  return { success: true, data: { setId: setResult.data.id } };
}

export async function handleRenameSet(msg: RenameSetMessage): Promise<BackgroundResponse> {
  const result = await renameSet(msg.setId, msg.newName);
  if (!result.success) {
    return { success: false, error: result.error.message, code: 'STORAGE_ERROR' };
  }
  return { success: true };
}

export async function handleDeleteSet(msg: DeleteSetMessage): Promise<BackgroundResponse> {
  const result = await deleteSet(msg.setId);
  if (!result.success) {
    return { success: false, error: result.error.message, code: 'STORAGE_ERROR' };
  }
  return { success: true };
}

export async function handleSwitchSet(
  msg: SwitchSetMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  if (ctx.getCachedPassword() !== null) {
    ctx.setCachedPassword(null);
    await ctx.clearSession();
    await ctx.clearAlarm();
  }
  const setIdResult = await setActiveSetId(msg.setId);
  if (!setIdResult.success) {
    return { success: false, error: setIdResult.error.message, code: 'STORAGE_ERROR' };
  }
  return loadAndActivateSet(msg.setId, msg.password, ctx);
}

export async function handleClearAll(
  msg: ClearAllMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  if (msg.confirmation !== 'DELETE') {
    return { success: false, error: 'Confirmation must be DELETE', code: 'INVALID_INPUT' };
  }
  await ctx.clearLocalStorage();
  ctx.setCachedPassword(null);
  await ctx.clearSession();
  await ctx.clearAlarm();
  return { success: true };
}

export async function handleImportChromeBookmarks(
  _msg: ImportChromeBookmarksMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  const roots = await ctx.getBookmarkTree();
  const children = [...(roots[0]?.children ?? [])];
  const result = convertChromeBookmarks(children);
  if (!result.success) {
    return { success: false, error: result.error.message, code: 'IMPORT_ERROR' };
  }
  return { success: true, data: { tree: result.data.tree, stats: result.data.stats } };
}

export async function handleImportBackup(msg: ImportBackupMessage): Promise<BackgroundResponse> {
  const result = await importEncryptedBackup(msg.blob, msg.password);
  if (!result.success) {
    if (result.error instanceof InvalidPasswordError) {
      return { success: false, error: 'Invalid password', code: 'INVALID_PASSWORD' };
    }
    return { success: false, error: result.error.message, code: 'IMPORT_ERROR' };
  }
  return { success: true, data: { tree: result.data } };
}

export async function handleExportBackup(
  _msg: ExportBackupMessage, ctx: HandlerContext,
): Promise<BackgroundResponse> {
  if (ctx.getCachedPassword() === null) {
    return { success: false, error: 'Not unlocked', code: 'NOT_UNLOCKED' };
  }
  const state = await ctx.getSessionState();
  if (!state || !state.tree) {
    return { success: false, error: 'No active session', code: 'NOT_UNLOCKED' };
  }
  const blob = await exportEncryptedBackup(state.tree, ctx.getCachedPassword()!);
  return { success: true, data: { blob } };
}
