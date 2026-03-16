/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { BookmarkTree, PasswordSetInfo } from '@/lib/types';
import type { IncognitoMode } from '@/lib/incognito';

export interface UnlockMessage {
  readonly type: 'UNLOCK';
  readonly password: string;
  readonly setId?: string;
}

export interface LockMessage {
  readonly type: 'LOCK';
}

export interface SaveMessage {
  readonly type: 'SAVE';
  readonly tree: BookmarkTree;
}

export interface GetStateMessage {
  readonly type: 'GET_STATE';
}

export interface AddBookmarkMessage {
  readonly type: 'ADD_BOOKMARK';
  readonly url: string;
  readonly title: string;
  readonly parentPath?: readonly number[];
}

export interface GetIncognitoStateMessage {
  readonly type: 'GET_INCOGNITO_STATE';
}

export interface ChangePasswordMessage {
  readonly type: 'CHANGE_PASSWORD';
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface UpdateAutoLockMessage {
  readonly type: 'UPDATE_AUTO_LOCK';
  readonly minutes: number;
}

export interface CreateSetMessage {
  readonly type: 'CREATE_SET';
  readonly name: string;
  readonly password: string;
}

export interface RenameSetMessage {
  readonly type: 'RENAME_SET';
  readonly setId: string;
  readonly newName: string;
}

export interface DeleteSetMessage {
  readonly type: 'DELETE_SET';
  readonly setId: string;
}

export interface SwitchSetMessage {
  readonly type: 'SWITCH_SET';
  readonly setId: string;
  readonly password: string;
}

export interface ClearAllMessage {
  readonly type: 'CLEAR_ALL';
  readonly confirmation: 'DELETE';
}

export interface ImportChromeBookmarksMessage {
  readonly type: 'IMPORT_CHROME_BOOKMARKS';
}

export interface ImportBackupMessage {
  readonly type: 'IMPORT_BACKUP';
  readonly blob: string;
  readonly password: string;
}

export interface ExportBackupMessage {
  readonly type: 'EXPORT_BACKUP';
}

export interface ImportHushMessage {
  readonly type: 'IMPORT_HUSH';
  readonly blob: string;
  readonly password: string;
}

export type BackgroundMessage =
  | UnlockMessage
  | LockMessage
  | SaveMessage
  | GetStateMessage
  | AddBookmarkMessage
  | GetIncognitoStateMessage
  | ChangePasswordMessage
  | UpdateAutoLockMessage
  | CreateSetMessage
  | RenameSetMessage
  | DeleteSetMessage
  | SwitchSetMessage
  | ClearAllMessage
  | ImportChromeBookmarksMessage
  | ImportBackupMessage
  | ExportBackupMessage
  | ImportHushMessage;

export type MessageType = BackgroundMessage['type'];

export type BackgroundResponse =
  | { readonly success: true; readonly data?: unknown }
  | { readonly success: false; readonly error: string; readonly code?: string };

export interface SessionState {
  readonly isUnlocked: boolean;
  readonly activeSetId: string;
  readonly sets: readonly PasswordSetInfo[];
  readonly tree: BookmarkTree | null;
  readonly incognitoMode: IncognitoMode;
  readonly hasData: boolean;
}
