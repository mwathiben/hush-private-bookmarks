import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Textarea } from '@/components/ui/textarea';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useTree } from '@/hooks/useTree';
import type { ImportStats } from '@/lib/bookmark-import';
import type { BookmarkTree } from '@/lib/types';

type ImportStatus = 'idle' | 'importing' | 'success';

interface HushImportData {
  readonly tree: BookmarkTree;
  readonly stats: ImportStats;
}

function isHushImportData(data: unknown): data is HushImportData {
  if (data === null || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.tree !== null && typeof d.tree === 'object' && d.stats !== null && typeof d.stats === 'object';
}

function appendImportedFolder(current: BookmarkTree, imported: BookmarkTree): BookmarkTree {
  return { ...current, children: [...current.children, imported] };
}

export function HushImportSection(): React.JSX.Element {
  const sendMessage = useSendMessage();
  const { tree, save } = useTree();

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [blob, setBlob] = useState('');
  const [password, setPassword] = useState('');

  const isImporting = status === 'importing';
  const canSubmit = blob.trim() !== '' && password !== '' && !isImporting;

  useEffect(() => {
    return (): void => {
      setPassword('');
    };
  }, []);

  const handleImport = useCallback(async (): Promise<void> => {
    if (!tree) return;

    setError(null);
    setStats(null);
    setStatus('importing');

    try {
      const response = await sendMessage({ type: 'IMPORT_HUSH', blob: blob.trim(), password });

      if (!response.success) {
        setError(response.error);
        setStatus('idle');
        return;
      }

      if (!isHushImportData(response.data)) {
        setError('Invalid import response');
        setStatus('idle');
        return;
      }

      const merged = appendImportedFolder(tree, response.data.tree);
      const saved = await save(merged);
      if (!saved) {
        setError('Failed to save imported bookmarks');
        setStatus('idle');
        return;
      }
      setStats(response.data.stats);
      setPassword('');
      setStatus('success');
    } catch {
      setError('Failed to import Hush data');
      setStatus('idle');
    }
  }, [sendMessage, tree, save, blob, password]);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void handleImport();
  }, [handleImport]);

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <Label htmlFor="hush-blob" className="sr-only">Encrypted data</Label>
          <Textarea
            id="hush-blob"
            value={blob}
            onChange={(e) => setBlob(e.target.value)}
            placeholder="Paste encrypted data from Hush extension..."
            disabled={isImporting}
            rows={4}
          />
        </div>
        <div>
          <Label htmlFor="hush-password" className="sr-only">Hush Password</Label>
          <PasswordInput
            id="hush-password"
            value={password}
            onChange={setPassword}
            disabled={isImporting}
            placeholder="Hush Password"
            autocomplete="off"
          />
        </div>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {isImporting ? 'Importing...' : 'Import from Hush'}
        </Button>
      </form>
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {stats && (
        <p className="text-sm text-primary" role="status">
          Imported {stats.bookmarksImported} bookmarks, {stats.foldersImported}{' '}
          {stats.foldersImported === 1 ? 'folder' : 'folders'}
        </p>
      )}
    </div>
  );
}
