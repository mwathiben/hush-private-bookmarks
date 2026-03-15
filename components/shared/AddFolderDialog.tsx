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
import { addFolder } from '@/lib/data-model';
import type { BookmarkTree } from '@/lib/types';

export interface AddFolderDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly parentPath: readonly number[];
  readonly tree: BookmarkTree;
  readonly onSave: (newTree: BookmarkTree) => Promise<boolean>;
}

export function AddFolderDialog({
  open,
  onOpenChange,
  parentPath,
  tree,
  onSave,
}: AddFolderDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      setError('Name is required');
      return;
    }

    setError(null);
    setSaving(true);

    const result = addFolder(tree, parentPath, trimmedName);
    if (!result.success) {
      setError('Failed to add folder');
      setSaving(false);
      return;
    }

    let ok: boolean;
    try {
      ok = await onSave(result.data);
    } catch {
      ok = false;
    }
    setSaving(false);

    if (ok) {
      onOpenChange(false);
    } else {
      setError('Failed to save folder');
    }
  }, [name, parentPath, tree, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Folder</DialogTitle>
          <DialogDescription>
            Enter a name for the new folder.
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
              {saving ? 'Adding...' : 'Add Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
