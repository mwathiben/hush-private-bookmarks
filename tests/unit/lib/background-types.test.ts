import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  BackgroundMessage,
  BackgroundResponse,
  SessionState,
  MessageType,
  UnlockMessage,
  LockMessage,
  GetStateMessage,
  AddBookmarkMessage,
  GetIncognitoStateMessage,
  ChangePasswordMessage,
  UpdateAutoLockMessage,
  CreateSetMessage,
  RenameSetMessage,
  DeleteSetMessage,
  SwitchSetMessage,
  ClearAllMessage,
  ImportChromeBookmarksMessage,
  ImportBackupMessage,
  ExportBackupMessage,
} from '@/lib/background-types';

import type { BookmarkTree } from '@/lib/types';

const ROOT = resolve(process.cwd());
const SOURCE = readFileSync(resolve(ROOT, 'lib', 'background-types.ts'), 'utf-8');

describe('background-types: type compilation', () => {
  it('all 16 message types construct correctly', () => {
    const tree: BookmarkTree = { type: 'folder', id: 'r', name: 'Root', children: [], dateAdded: 0 };

    const messages: BackgroundMessage[] = [
      { type: 'UNLOCK', password: 'p' },
      { type: 'LOCK' },
      { type: 'SAVE', tree },
      { type: 'GET_STATE' },
      { type: 'ADD_BOOKMARK', url: 'https://x.com', title: 't' },
      { type: 'GET_INCOGNITO_STATE' },
      { type: 'CHANGE_PASSWORD', currentPassword: 'a', newPassword: 'b' },
      { type: 'UPDATE_AUTO_LOCK', minutes: 5 },
      { type: 'CREATE_SET', name: 's', password: 'p' },
      { type: 'RENAME_SET', setId: '1', newName: 'n' },
      { type: 'DELETE_SET', setId: '1' },
      { type: 'SWITCH_SET', setId: '1', password: 'p' },
      { type: 'CLEAR_ALL', confirmation: 'DELETE' },
      { type: 'IMPORT_CHROME_BOOKMARKS' },
      { type: 'IMPORT_BACKUP', blob: 'base64data', password: 'p' },
      { type: 'EXPORT_BACKUP' },
    ];

    expect(messages).toHaveLength(16);
  });

  it('discriminated union narrows correctly in switch', () => {
    const msg: BackgroundMessage = { type: 'SAVE', tree: { type: 'folder', id: 'r', name: 'Root', children: [], dateAdded: 0 } };

    switch (msg.type) {
      case 'SAVE':
        expect(msg.tree.name).toBe('Root');
        break;
      default:
        throw new Error('Should not reach default');
    }
  });

  it('UNLOCK accepts optional setId', () => {
    const withSet: UnlockMessage = { type: 'UNLOCK', password: 'p', setId: '1' };
    const withoutSet: UnlockMessage = { type: 'UNLOCK', password: 'p' };
    expect(withSet.setId).toBe('1');
    expect(withoutSet.setId).toBeUndefined();
  });

  it('ADD_BOOKMARK accepts optional parentPath', () => {
    const withPath: AddBookmarkMessage = { type: 'ADD_BOOKMARK', url: 'u', title: 't', parentPath: [0, 1] };
    const withoutPath: AddBookmarkMessage = { type: 'ADD_BOOKMARK', url: 'u', title: 't' };
    expect(withPath.parentPath).toEqual([0, 1]);
    expect(withoutPath.parentPath).toBeUndefined();
  });
});

describe('background-types: BackgroundResponse', () => {
  it('success response has optional data', () => {
    const ok: BackgroundResponse = { success: true };
    const okWithData: BackgroundResponse = { success: true, data: { tree: null } };
    expect(ok.success).toBe(true);
    expect(okWithData.success).toBe(true);
  });

  it('failure response has error and optional code', () => {
    const fail: BackgroundResponse = { success: false, error: 'NOT_IMPLEMENTED' };
    const failWithCode: BackgroundResponse = { success: false, error: 'NOT_IMPLEMENTED', code: 'GET_STATE' };
    expect(fail.success).toBe(false);
    expect(failWithCode.success).toBe(false);
  });
});

describe('background-types: SessionState', () => {
  it('constructs with all required fields', () => {
    const state: SessionState = {
      isUnlocked: false,
      activeSetId: 'default',
      sets: [{ id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true }],
      tree: null,
      incognitoMode: 'normal_mode',
    };
    expect(state.isUnlocked).toBe(false);
    expect(state.tree).toBeNull();
  });

  it('tree accepts BookmarkTree when unlocked', () => {
    const state: SessionState = {
      isUnlocked: true,
      activeSetId: 'default',
      sets: [],
      tree: { type: 'folder', id: 'r', name: 'Root', children: [], dateAdded: 0 },
      incognitoMode: 'incognito_active',
    };
    expect(state.tree).not.toBeNull();
  });
});

describe('background-types: MessageType literal union', () => {
  it('accepts all 16 type strings', () => {
    const types: MessageType[] = [
      'UNLOCK', 'LOCK', 'SAVE', 'GET_STATE', 'ADD_BOOKMARK', 'GET_INCOGNITO_STATE',
      'CHANGE_PASSWORD', 'UPDATE_AUTO_LOCK', 'CREATE_SET', 'RENAME_SET',
      'DELETE_SET', 'SWITCH_SET', 'CLEAR_ALL',
      'IMPORT_CHROME_BOOKMARKS', 'IMPORT_BACKUP', 'EXPORT_BACKUP',
    ];
    expect(types).toHaveLength(16);
  });
});

describe('background-types: individual message type exports', () => {
  it('each interface is independently importable', () => {
    const messages: BackgroundMessage[] = [
      { type: 'LOCK' } satisfies LockMessage,
      { type: 'GET_STATE' } satisfies GetStateMessage,
      { type: 'GET_INCOGNITO_STATE' } satisfies GetIncognitoStateMessage,
      { type: 'CHANGE_PASSWORD', currentPassword: 'a', newPassword: 'b' } satisfies ChangePasswordMessage,
      { type: 'UPDATE_AUTO_LOCK', minutes: 5 } satisfies UpdateAutoLockMessage,
      { type: 'CREATE_SET', name: 'n', password: 'p' } satisfies CreateSetMessage,
      { type: 'RENAME_SET', setId: '1', newName: 'n' } satisfies RenameSetMessage,
      { type: 'DELETE_SET', setId: '1' } satisfies DeleteSetMessage,
      { type: 'SWITCH_SET', setId: '1', password: 'p' } satisfies SwitchSetMessage,
      { type: 'CLEAR_ALL', confirmation: 'DELETE' } satisfies ClearAllMessage,
      { type: 'IMPORT_CHROME_BOOKMARKS' } satisfies ImportChromeBookmarksMessage,
      { type: 'IMPORT_BACKUP', blob: 'b', password: 'p' } satisfies ImportBackupMessage,
      { type: 'EXPORT_BACKUP' } satisfies ExportBackupMessage,
    ];

    expect(messages).toHaveLength(13);
  });
});

describe('background-types: module purity', () => {
  it('contains zero runtime code', () => {
    const lines = SOURCE.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed === '') continue;
      if (trimmed.startsWith('import type') || trimmed.startsWith('export type') || trimmed.startsWith('export interface')) continue;
      if (trimmed.startsWith('|') || trimmed.startsWith('readonly') || trimmed.startsWith('}')) continue;
      if (trimmed === '{' || trimmed === '};') continue;

      expect(trimmed).not.toMatch(/^(const|let|var|function|class|new) /);
    }
  });

  it('has zero React/DOM imports', () => {
    expect(SOURCE).not.toMatch(/from\s+['"]react['"]/);
    expect(SOURCE).not.toMatch(/from\s+['"]react-dom['"]/);
  });

  it('has zero browser/chrome API usage', () => {
    expect(SOURCE).not.toMatch(/from\s+['"]wxt\/browser['"]/);
    expect(SOURCE).not.toContain('chrome.');
    expect(SOURCE).not.toContain('browser.');
  });

  it('uses only import type (no value imports)', () => {
    const importLines = SOURCE.split('\n').filter(l => l.trim().startsWith('import'));
    for (const line of importLines) {
      expect(line).toMatch(/import\s+type/);
    }
  });

  it('has zero type suppressions', () => {
    expect(SOURCE).not.toContain('as any');
    expect(SOURCE).not.toContain('@ts-ignore');
    expect(SOURCE).not.toContain('@ts-expect-error');
  });

  it('has zero console.log', () => {
    expect(SOURCE).not.toMatch(/console\.log/);
  });

  it('is within 150-line limit', () => {
    const lineCount = SOURCE.split('\n').length;
    expect(lineCount).toBeLessThanOrEqual(150);
  });

  it('has zero external dependencies', () => {
    const importRegex = /from\s+['"]([^@./][^'"]*)['"]/g;
    let match;
    while ((match = importRegex.exec(SOURCE)) !== null) {
      throw new Error(`Unexpected external dependency: ${match[1]}`);
    }
  });
});
