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
import { addFolder, renameFolder } from '@/lib/data-model';
import type { BookmarkTree, Folder } from '@/lib/types';

interface AddFolderMode {
  readonly mode: 'add';
  readonly parentPath: readonly number[];
}

interface EditFolderMode {
  readonly mode: 'edit';
  readonly path: readonly number[];
  readonly folder: Folder;
}

export type FolderDialogMode = AddFolderMode | EditFolderMode;

export interface AddFolderDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly dialogMode: FolderDialogMode;
  readonly tree: BookmarkTree;
  readonly onSave: (newTree: BookmarkTree) => Promise<boolean>;
}

function buttonLabel(saving: boolean, isEdit: boolean): string {
  if (saving) return isEdit ? 'Saving...' : 'Adding...';
  if (isEdit) return 'Save Changes';
  return 'Add Folder';
}

export function AddFolderDialog({
  open,
  onOpenChange,
  dialogMode,
  tree,
  onSave,
}: AddFolderDialogProps): React.JSX.Element {
  const isEdit = dialogMode.mode === 'edit';

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- dialog form reset on open/close is a controlled-dialog pattern, not cascading state */
  useEffect(() => {
    if (open) {
      setName(isEdit ? dialogMode.folder.name : '');
      setError(null);
      setSaving(false);
    }
  }, [open, isEdit, dialogMode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      setError('Name is required');
      return;
    }

    setError(null);
    setSaving(true);

    let newTree: BookmarkTree;

    if (dialogMode.mode === 'add') {
      const result = addFolder(tree, dialogMode.parentPath, trimmedName);
      if (!result.success) {
        setError('Failed to add folder');
        setSaving(false);
        return;
      }
      newTree = result.data;
    } else {
      const result = renameFolder(tree, dialogMode.path, trimmedName);
      if (!result.success) {
        setError('Failed to rename folder');
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
      setError('Failed to save folder');
    }
  }, [name, dialogMode, tree, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Rename Folder' : 'Add Folder'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the folder name.' : 'Enter a name for the new folder.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {buttonLabel(saving, isEdit)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
