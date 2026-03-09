/*
 * Hush Private Bookmarks — Privacy-first browser extension for hidden bookmarks
 * Copyright (C) 2026 Hush Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/** Resolved incognito state passed by callers (Module 9/10). No browser APIs here. */
export interface IncognitoState {
  readonly isIncognitoContext: boolean;
  readonly isAllowedIncognito: boolean;
}

/** Exhaustive incognito behavior modes derived from IncognitoState. */
export type IncognitoMode =
  | 'incognito_active'
  | 'normal_mode'
  | 'incognito_not_allowed';

/** User-configurable incognito preferences (Module 12: Settings). */
export interface IncognitoConfig {
  readonly autoUnlockInIncognito: boolean;
  readonly showInNormalMode: boolean;
}

export const INCOGNITO_MESSAGES = {
  incognito_active: null,
  normal_mode: null,
  incognito_not_allowed:
    'Hush is not enabled for incognito. Go to chrome://extensions, find Hush, and enable "Allow in Incognito".',
} as const satisfies Record<IncognitoMode, string | null>;

/** Pure state machine: maps resolved browser state to a behavior mode. */
export function determineMode(state: IncognitoState): IncognitoMode {
  if (!state.isIncognitoContext) return 'normal_mode';
  return state.isAllowedIncognito ? 'incognito_active' : 'incognito_not_allowed';
}

/**
 * Whether to auto-surface the bookmark list UI (skip the "enter password" landing).
 *
 * SECURITY: This does NOT bypass decryption. The user's master password is still
 * required to decrypt the vault. "Auto-unlock" means the UI assumes the user wants
 * to access bookmarks (since they're in incognito) and skips the non-incognito
 * informational screen.
 */
export function shouldAutoUnlock(mode: IncognitoMode): boolean {
  return mode === 'incognito_active';
}

/** Returns a user-facing guidance message for the given mode, or null if none needed. */
export function getIncognitoMessage(mode: IncognitoMode): string | null {
  return INCOGNITO_MESSAGES[mode];
}
