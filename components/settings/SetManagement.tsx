import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useSessionState, useSessionDispatch } from '@/entrypoints/popup/App';
import { isSessionState } from '@/hooks/useSession';
import type { PasswordSetInfo } from '@/lib/types';

export function SetManagement(): React.JSX.Element {
  const sendMessage = useSendMessage();
  const { session } = useSessionState();
  const dispatch = useSessionDispatch();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<PasswordSetInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PasswordSetInfo | null>(null);
  const [newSetName, setNewSetName] = useState('');
  const [newSetPassword, setNewSetPassword] = useState('');
  const [renameName, setRenameName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const sets = session?.sets ?? [];

  const refreshSession = useCallback(async (): Promise<void> => {
    const resp = await sendMessage({ type: 'GET_STATE' });
    if (resp.success && isSessionState(resp.data)) {
      dispatch({ type: 'SET_SESSION', session: resp.data });
    }
  }, [sendMessage, dispatch]);

  const handleCreate = useCallback(async (): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      const response = await sendMessage({ type: 'CREATE_SET', name: newSetName, password: newSetPassword });
      if (!response.success) {
        setError(response.error);
        return;
      }
      if (isSessionState(response.data)) {
        dispatch({ type: 'SET_SESSION', session: response.data });
      }
      setCreateOpen(false);
      setNewSetName('');
      setNewSetPassword('');
    } catch {
      setError('Failed to create set');
    } finally {
      setPending(false);
    }
  }, [newSetName, newSetPassword, sendMessage, dispatch]);

  const handleRename = useCallback(async (): Promise<void> => {
    if (!renameTarget) return;
    setError(null);
    setPending(true);
    try {
      const response = await sendMessage({ type: 'RENAME_SET', setId: renameTarget.id, newName: renameName });
      if (!response.success) {
        setError(response.error);
        return;
      }
      await refreshSession();
      setRenameTarget(null);
      setRenameName('');
    } catch {
      setError('Failed to rename set');
    } finally {
      setPending(false);
    }
  }, [renameTarget, renameName, sendMessage, refreshSession]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;
    setError(null);
    setPending(true);
    try {
      const response = await sendMessage({ type: 'DELETE_SET', setId: deleteTarget.id });
      if (!response.success) {
        setError(response.error);
        return;
      }
      await refreshSession();
      setDeleteTarget(null);
    } catch {
      setError('Failed to delete set');
    } finally {
      setPending(false);
    }
  }, [deleteTarget, sendMessage, refreshSession]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {sets.map((set) => (
          <div key={set.id} className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{set.name}</span>
              {set.isDefault && <Badge variant="secondary">default</Badge>}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Rename ${set.name}`}
                onClick={() => { setRenameTarget(set); setRenameName(set.name); }}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete ${set.name}`}
                disabled={set.isDefault}
                onClick={() => setDeleteTarget(set)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="mr-1 size-3.5" />
        Create Set
      </Button>

      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setNewSetName(''); setNewSetPassword(''); } setCreateOpen(open); }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Create New Set</DialogTitle>
            <DialogDescription>Enter a name and password for the new set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Set name"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              disabled={pending}
            />
            <PasswordInput
              value={newSetPassword}
              onChange={setNewSetPassword}
              placeholder="Password"
              autocomplete="new-password"
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={pending || !newSetName.trim() || !newSetPassword}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Rename Set</DialogTitle>
            <DialogDescription>Enter a new name for this set.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="New name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              disabled={pending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleRename()}
              disabled={pending || !renameName.trim()}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Set"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
