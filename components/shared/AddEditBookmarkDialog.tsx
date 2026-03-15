import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { addBookmark, updateBookmark } from '@/lib/data-model';
import type { Bookmark, BookmarkTree } from '@/lib/types';

interface AddBookmarkMode {
  readonly mode: 'add';
  readonly parentPath: readonly number[];
}

interface EditBookmarkMode {
  readonly mode: 'edit';
  readonly path: readonly number[];
  readonly bookmark: Bookmark;
}

export type BookmarkDialogMode = AddBookmarkMode | EditBookmarkMode;

export interface AddEditBookmarkDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly dialogMode: BookmarkDialogMode;
  readonly tree: BookmarkTree;
  readonly onSave: (newTree: BookmarkTree) => Promise<boolean>;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function AddEditBookmarkDialog({
  open,
  onOpenChange,
  dialogMode,
  tree,
  onSave,
}: AddEditBookmarkDialogProps): React.JSX.Element {
  const isEdit = dialogMode.mode === 'edit';

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(isEdit ? dialogMode.bookmark.title : '');
      setUrl(isEdit ? dialogMode.bookmark.url : '');
      setError(null);
      setSaving(false);
    }
  }, [open, isEdit, dialogMode]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (trimmedTitle.length === 0) {
      setError('Title is required');
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setError('Invalid URL format');
      return;
    }

    setError(null);
    setSaving(true);

    let newTree: BookmarkTree;

    if (dialogMode.mode === 'add') {
      const result = addBookmark(tree, dialogMode.parentPath, {
        type: 'bookmark',
        title: trimmedTitle,
        url: trimmedUrl,
        dateAdded: Date.now(),
      });
      if (!result.success) {
        setError('Failed to add bookmark');
        setSaving(false);
        return;
      }
      newTree = result.data;
    } else {
      const result = updateBookmark(tree, dialogMode.path, {
        title: trimmedTitle,
        url: trimmedUrl,
      });
      if (!result.success) {
        setError('Failed to update bookmark');
        setSaving(false);
        return;
      }
      newTree = result.data;
    }

    let ok: boolean;
    try {
      ok = await onSave(newTree);
    } catch {
      ok = false;
    }
    setSaving(false);

    if (ok) {
      onOpenChange(false);
    } else {
      setError('Failed to save bookmark');
    }
  }, [title, url, dialogMode, tree, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Bookmark' : 'Add Bookmark'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the bookmark details.' : 'Enter a title and URL for the bookmark.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bookmark-title">Title</Label>
            <Input
              id="bookmark-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bookmark-url">URL</Label>
            <Input
              id="bookmark-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={saving}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Bookmark'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
