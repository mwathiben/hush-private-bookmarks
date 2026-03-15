import { useState, useCallback, useMemo } from 'react';
import { useTree } from '@/hooks/useTree';
import { BookmarkTree } from '@/components/shared/BookmarkTree';
import { EmptyTreeState } from '@/components/shared/EmptyTreeState';
import { AddEditBookmarkDialog } from '@/components/shared/AddEditBookmarkDialog';
import { AddFolderDialog } from '@/components/shared/AddFolderDialog';
import { Button } from '@/components/ui/button';
import type { BookmarkDialogMode } from '@/components/shared/AddEditBookmarkDialog';

type OpenDialog = 'bookmark' | 'folder' | null;

const ROOT_PATH: readonly number[] = [];

export default function TreeScreen(): React.JSX.Element {
  const { tree, error, save } = useTree();
  const hasChildren = tree !== null && tree.children.length > 0;
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  const openBookmarkDialog = useCallback(() => setOpenDialog('bookmark'), []);
  const openFolderDialog = useCallback(() => setOpenDialog('folder'), []);
  const handleBookmarkOpenChange = useCallback((open: boolean) => {
    if (!open) setOpenDialog(null);
  }, []);

  const handleFolderOpenChange = useCallback((open: boolean) => {
    if (!open) setOpenDialog(null);
  }, []);

  const addDialogMode = useMemo<BookmarkDialogMode>(() => ({
    mode: 'add', parentPath: ROOT_PATH,
  }), []);

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
        </div>
      </div>
      {error && (
        <p className="px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {hasChildren ? (
        <div className="px-2 py-1">
          <BookmarkTree nodes={tree.children} />
        </div>
      ) : (
        <EmptyTreeState onAddBookmark={tree !== null ? openBookmarkDialog : undefined} />
      )}
      {tree !== null && (
        <>
          <AddEditBookmarkDialog
            open={openDialog === 'bookmark'}
            onOpenChange={handleBookmarkOpenChange}
            dialogMode={addDialogMode}
            tree={tree}
            onSave={save}
          />
          <AddFolderDialog
            open={openDialog === 'folder'}
            onOpenChange={handleFolderOpenChange}
            parentPath={ROOT_PATH}
            tree={tree}
            onSave={save}
          />
        </>
      )}
    </div>
  );
}
