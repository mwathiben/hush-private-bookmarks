import { useState, useCallback, useMemo } from 'react';
import {
  useSessionProvider,
  useSessionState,
  useSessionDispatch,
  SessionProvider,
} from '@/hooks/useSessionProvider';
import type { Screen } from '@/hooks/useSessionProvider';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useTree } from '@/hooks/useTree';
import { useSearch } from '@/hooks/useSearch';
import { ManagerSidebar } from '@/components/manager/ManagerSidebar';
import { ManagerToolbar } from '@/components/manager/ManagerToolbar';
import { SearchResults } from '@/components/manager/SearchResults';
import LoginScreen from '@/components/screens/LoginScreen';
import SetupScreen from '@/components/screens/SetupScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import { BookmarkTree } from '@/components/shared/BookmarkTree';
import { EmptyTreeState } from '@/components/shared/EmptyTreeState';
import { AddEditBookmarkDialog } from '@/components/shared/AddEditBookmarkDialog';
import { AddFolderDialog } from '@/components/shared/AddFolderDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FolderPicker } from '@/components/shared/FolderPicker';
import { isSessionState } from '@/hooks/useSession';
import { removeItem, moveItem, isFolder, getFolderByPath } from '@/lib/data-model';
import type { BookmarkDialogMode } from '@/components/shared/AddEditBookmarkDialog';
import type { FolderDialogMode } from '@/components/shared/AddFolderDialog';
import type { ItemAction } from '@/components/shared/BookmarkTree';
import type { Bookmark, BookmarkNode, Folder } from '@/lib/types';

type DialogState =
  | { readonly type: 'none' }
  | { readonly type: 'add-bookmark' }
  | { readonly type: 'add-folder' }
  | { readonly type: 'edit-bookmark'; readonly path: readonly number[]; readonly bookmark: Bookmark }
  | { readonly type: 'edit-folder'; readonly path: readonly number[]; readonly folder: Folder }
  | { readonly type: 'confirm-delete'; readonly path: readonly number[]; readonly node: BookmarkNode }
  | { readonly type: 'move'; readonly path: readonly number[]; readonly node: BookmarkNode };

const DIALOG_NONE: DialogState = { type: 'none' };
const ROOT_PATH: readonly number[] = [];

const CENTERED_SCREENS: Partial<Record<Screen, React.ComponentType>> = {
  login: LoginScreen,
  setup: SetupScreen,
  settings: SettingsScreen,
};

function ManagerTreePanel(): React.JSX.Element {
  const sendMessage = useSendMessage();
  const { tree, error, save } = useTree();
  const [selectedFolderPath, setSelectedFolderPath] = useState<readonly number[] | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>(DIALOG_NONE);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { results: searchResults } = useSearch(tree, searchQuery);
  const isActiveSearch = searchQuery.trim() !== '';

  const state = useSessionState();
  const dispatch = useSessionDispatch();

  const visibleNodes = useMemo(() => {
    if (tree === null) return [];
    if (selectedFolderPath === null) return tree.children;
    const result = getFolderByPath(tree, selectedFolderPath);
    if (!result.success) return tree.children;
    return result.data.children;
  }, [tree, selectedFolderPath]);

  const parentPath = selectedFolderPath ?? ROOT_PATH;

  const closeDialog = useCallback(() => {
    setActionError(null);
    setDialogState(DIALOG_NONE);
  }, []);

  const handleAction = useCallback((action: ItemAction) => {
    setActionError(null);
    switch (action.type) {
      case 'delete':
        setDialogState({ type: 'confirm-delete', path: action.path, node: action.node });
        break;
      case 'edit-bookmark':
        setDialogState({ type: 'edit-bookmark', path: action.path, bookmark: action.bookmark });
        break;
      case 'edit-folder':
        setDialogState({ type: 'edit-folder', path: action.path, folder: action.folder });
        break;
      case 'move':
        setDialogState({ type: 'move', path: action.path, node: action.node });
        break;
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (dialogState.type !== 'confirm-delete' || tree === null) return;
    const result = removeItem(tree, dialogState.path);
    if (!result.success) { setActionError('Failed to delete item'); return; }
    try {
      const ok = await save(result.data);
      if (ok) { setDialogState(DIALOG_NONE); return; }
      setActionError('Failed to save changes');
    } catch {
      setActionError('Failed to save changes');
    }
  }, [dialogState, tree, save]);

  const handleMoveSelect = useCallback(async (folderPath: readonly number[], childrenCount: number) => {
    if (dialogState.type !== 'move' || tree === null) return;
    const result = moveItem(tree, dialogState.path, folderPath, childrenCount);
    if (!result.success) { setActionError('Failed to move item'); return; }
    try {
      const ok = await save(result.data);
      if (ok) { setDialogState(DIALOG_NONE); return; }
      setActionError('Failed to save changes');
    } catch {
      setActionError('Failed to save changes');
    }
  }, [dialogState, tree, save]);

  const bookmarkDialogMode = useMemo<BookmarkDialogMode>(() => {
    if (dialogState.type === 'edit-bookmark') {
      return { mode: 'edit', path: dialogState.path, bookmark: dialogState.bookmark };
    }
    return { mode: 'add', parentPath };
  }, [dialogState, parentPath]);

  const folderDialogMode = useMemo<FolderDialogMode>(() => {
    if (dialogState.type === 'edit-folder') {
      return { mode: 'edit', path: dialogState.path, folder: dialogState.folder };
    }
    return { mode: 'add', parentPath };
  }, [dialogState, parentPath]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() !== '') {
      setSelectedFolderPath(null);
    }
  }, []);

  const handleLock = useCallback(async () => {
    try {
      await sendMessage({ type: 'LOCK' });
      const response = await sendMessage({ type: 'GET_STATE' });
      if (response.success && isSessionState(response.data)) {
        dispatch({ type: 'SET_SESSION', session: response.data });
        return;
      }
      setActionError('Failed to lock session');
    } catch {
      setActionError('Failed to lock session');
    }
  }, [sendMessage, dispatch]);

  const hasChildren = visibleNodes.length > 0;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside
        className="flex w-62.5 flex-none flex-col border-r bg-sidebar"
        data-testid="manager-sidebar"
      >
        <ManagerSidebar
          tree={tree}
          session={state.session}
          selectedPath={selectedFolderPath}
          onSelectFolder={setSelectedFolderPath}
          onLock={handleLock}
          onSettings={() => dispatch({ type: 'NAVIGATE', to: 'settings' })}
        />
      </aside>
      <main
        className="flex min-w-0 flex-1 flex-col overflow-y-auto"
        data-testid="manager-main"
      >
        <ManagerToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onAddBookmark={() => { setActionError(null); setDialogState({ type: 'add-bookmark' }); }}
          onAddFolder={() => { setActionError(null); setDialogState({ type: 'add-folder' }); }}
          disabled={tree === null}
        />
        {(error ?? actionError) && (
          <p className="px-4 py-2 text-sm text-destructive" role="alert">
            {error ?? actionError}
          </p>
        )}
        <div className="p-4">
          {isActiveSearch && tree !== null ? (
            <SearchResults results={searchResults} tree={tree} onAction={handleAction} />
          ) : hasChildren ? (
            <BookmarkTree nodes={visibleNodes} onAction={handleAction} />
          ) : (
            <EmptyTreeState
              onAddBookmark={tree !== null ? () => setDialogState({ type: 'add-bookmark' }) : undefined}
            />
          )}
        </div>
        {tree !== null && (
          <>
            <AddEditBookmarkDialog
              open={dialogState.type === 'add-bookmark' || dialogState.type === 'edit-bookmark'}
              onOpenChange={(open) => { if (!open) closeDialog(); }}
              dialogMode={bookmarkDialogMode}
              tree={tree}
              onSave={save}
            />
            <AddFolderDialog
              open={dialogState.type === 'add-folder' || dialogState.type === 'edit-folder'}
              onOpenChange={(open) => { if (!open) closeDialog(); }}
              dialogMode={folderDialogMode}
              tree={tree}
              onSave={save}
            />
            <ConfirmDialog
              open={dialogState.type === 'confirm-delete'}
              onOpenChange={(open) => { if (!open) closeDialog(); }}
              title={`Delete "${dialogState.type === 'confirm-delete' ? (isFolder(dialogState.node) ? dialogState.node.name : dialogState.node.title) : ''}"?`}
              description="This action cannot be undone."
              confirmLabel="Delete"
              variant="destructive"
              onConfirm={() => void handleConfirmDelete()}
            />
            <FolderPicker
              open={dialogState.type === 'move'}
              onOpenChange={(open) => { if (!open) closeDialog(); }}
              tree={tree}
              excludePath={dialogState.type === 'move' ? dialogState.path : ROOT_PATH}
              onSelect={(path, count) => void handleMoveSelect(path, count)}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default function ManagerApp(): React.JSX.Element {
  const provider = useSessionProvider();
  const { state, dispatch, treeValue, hookLoading } = provider;

  if (hookLoading && state.loading) {
    return (
      <div
        data-testid="loading-spinner"
        className="flex h-screen items-center justify-center bg-background"
      >
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (state.error && !state.session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6 text-destructive" role="alert">
        {state.error}
      </div>
    );
  }

  const CenteredScreen = CENTERED_SCREENS[state.screen];
  if (CenteredScreen) {
    return (
      <div className="flex h-screen items-center justify-center overflow-y-auto bg-background text-foreground">
        <div className="my-auto w-full max-w-lg p-8">
          <SessionProvider state={state} dispatch={dispatch} treeValue={treeValue}>
            <CenteredScreen />
          </SessionProvider>
        </div>
      </div>
    );
  }

  return (
    <SessionProvider state={state} dispatch={dispatch} treeValue={treeValue}>
      <ManagerTreePanel />
    </SessionProvider>
  );
}
