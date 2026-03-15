import { useState, useCallback, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { useTree } from '@/hooks/useTree';
import { useSessionDispatch } from '@/entrypoints/popup/App';
import { BookmarkTree } from '@/components/shared/BookmarkTree';
import { EmptyTreeState } from '@/components/shared/EmptyTreeState';
import { AddEditBookmarkDialog } from '@/components/shared/AddEditBookmarkDialog';
import { AddFolderDialog } from '@/components/shared/AddFolderDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FolderPicker } from '@/components/shared/FolderPicker';
import { Button } from '@/components/ui/button';
import { removeItem, moveItem, isFolder } from '@/lib/data-model';
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

function formatPath(path: readonly number[]): string {
  return path.length === 0 ? 'root' : path.join(' > ');
}

export default function TreeScreen(): React.JSX.Element {
  const dispatch = useSessionDispatch();
  const { tree, error, save } = useTree();
  const hasChildren = tree !== null && tree.children.length > 0;
  const [dialogState, setDialogState] = useState<DialogState>(DIALOG_NONE);
  const [actionError, setActionError] = useState<string | null>(null);

  const openBookmarkDialog = useCallback(() => {
    setActionError(null);
    setDialogState({ type: 'add-bookmark' });
  }, []);

  const openFolderDialog = useCallback(() => {
    setActionError(null);
    setDialogState({ type: 'add-folder' });
  }, []);

  const closeDialog = useCallback(() => {
    setActionError(null);
    setDialogState(DIALOG_NONE);
  }, []);

  const handleBookmarkOpenChange = useCallback((open: boolean) => {
    if (!open) setDialogState(DIALOG_NONE);
  }, []);

  const handleFolderOpenChange = useCallback((open: boolean) => {
    if (!open) setDialogState(DIALOG_NONE);
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

    const sourcePath = formatPath(dialogState.path);
    const result = removeItem(tree, dialogState.path);

    if (!result.success) {
      setActionError(`Failed to delete item at path ${sourcePath}`);
      return;
    }

    try {
      const ok = await save(result.data);
      if (ok) {
        setActionError(null);
        setDialogState(DIALOG_NONE);
        return;
      }

      setActionError('Failed to save changes');
    } catch {
      setActionError('Failed to save changes');
    }
  }, [dialogState, tree, save]);

  const handleMoveSelect = useCallback(async (folderPath: readonly number[], childrenCount: number) => {
    if (dialogState.type !== 'move' || tree === null) return;

    const sourcePath = formatPath(dialogState.path);
    const result = moveItem(tree, dialogState.path, folderPath, childrenCount);

    if (!result.success) {
      setActionError(`Failed to move item from path ${sourcePath}`);
      return;
    }

    try {
      const ok = await save(result.data);
      if (ok) {
        setActionError(null);
        setDialogState(DIALOG_NONE);
        return;
      }

      setActionError('Failed to save changes');
    } catch {
      setActionError('Failed to save changes');
    }
  }, [dialogState, tree, save]);

  const addBookmarkMode = useMemo<BookmarkDialogMode>(() => ({
    mode: 'add', parentPath: ROOT_PATH,
  }), []);

  const bookmarkDialogMode = useMemo<BookmarkDialogMode>(() => {
    if (dialogState.type === 'edit-bookmark') {
      return { mode: 'edit', path: dialogState.path, bookmark: dialogState.bookmark };
    }
    return addBookmarkMode;
  }, [dialogState, addBookmarkMode]);

  const addFolderMode = useMemo<FolderDialogMode>(() => ({
    mode: 'add', parentPath: ROOT_PATH,
  }), []);

  const folderDialogMode = useMemo<FolderDialogMode>(() => {
    if (dialogState.type === 'edit-folder') {
      return { mode: 'edit', path: dialogState.path, folder: dialogState.folder };
    }
    return addFolderMode;
  }, [dialogState, addFolderMode]);

  return (
    <div data-testid="tree-screen" className="flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-semibold">Bookmarks</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={tree === null}
            aria-label="Add bookmark"
            onClick={openBookmarkDialog}
          >
            + Bookmark
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={tree === null}
            aria-label="Add folder"
            onClick={openFolderDialog}
          >
            + Folder
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Settings"
            onClick={() => dispatch({ type: 'NAVIGATE', to: 'settings' })}
          >
            <Settings />
          </Button>
        </div>
      </div>
      {error && (
        <p className="px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {actionError && (
        <p className="px-4 py-2 text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}
      {hasChildren ? (
        <div className="px-2 py-1">
          <BookmarkTree nodes={tree.children} onAction={handleAction} />
        </div>
      ) : (
        <EmptyTreeState onAddBookmark={tree !== null ? openBookmarkDialog : undefined} />
      )}
      {tree !== null && (
        <>
          <AddEditBookmarkDialog
            open={dialogState.type === 'add-bookmark' || dialogState.type === 'edit-bookmark'}
            onOpenChange={handleBookmarkOpenChange}
            dialogMode={bookmarkDialogMode}
            tree={tree}
            onSave={save}
          />
          <AddFolderDialog
            open={dialogState.type === 'add-folder' || dialogState.type === 'edit-folder'}
            onOpenChange={handleFolderOpenChange}
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
    </div>
  );
}
