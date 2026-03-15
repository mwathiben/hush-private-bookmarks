import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useTree } from '@/hooks/useTree';
import { parseHtmlBookmarks, type ImportStats } from '@/lib/bookmark-import';
import type { BookmarkTree } from '@/lib/types';

type ImportStatus = 'idle' | 'importing' | 'success';

interface ChromeImportData {
  readonly tree: BookmarkTree;
  readonly stats: ImportStats;
}

interface BackupImportData {
  readonly tree: BookmarkTree;
}

function isChromeImportData(data: unknown): data is ChromeImportData {
  if (data === null || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.tree !== null && typeof d.tree === 'object' && d.stats !== null && typeof d.stats === 'object';
}

function isBackupImportData(data: unknown): data is BackupImportData {
  if (data === null || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.tree !== null && typeof d.tree === 'object';
}

function appendImportedFolder(current: BookmarkTree, imported: BookmarkTree): BookmarkTree {
  return { ...current, children: [...current.children, imported] };
}

export function ImportSection(): React.JSX.Element {
  const sendMessage = useSendMessage();
  const { tree, save } = useTree();
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [backupPrompt, setBackupPrompt] = useState<{ blob: string } | null>(null);
  const [backupPassword, setBackupPassword] = useState('');

  const isImporting = status === 'importing';

  useEffect(() => {
    return (): void => {
      setBackupPassword('');
    };
  }, []);

  const handleChromeImport = useCallback(async (): Promise<void> => {
    if (!tree) return;
    setError(null);
    setStats(null);
    setStatus('importing');

    try {
      const response = await sendMessage({ type: 'IMPORT_CHROME_BOOKMARKS' });

      if (!response.success) {
        setError(response.error);
        setStatus('idle');
        return;
      }

      if (!isChromeImportData(response.data)) {
        setError('Invalid import response');
        setStatus('idle');
        return;
      }

      const merged = appendImportedFolder(tree, response.data.tree);
      await save(merged);
      setStats(response.data.stats);
      setStatus('success');
    } catch {
      setError('Failed to import Chrome bookmarks');
      setStatus('idle');
    }
  }, [sendMessage, tree, save]);

  const handleHtmlFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || !tree) {
      input.value = '';
      return;
    }

    setError(null);
    setStats(null);
    setStatus('importing');

    try {
      if (file.size > 5 * 1024 * 1024) {
        setError('File too large (max 5MB)');
        setStatus('idle');
        return;
      }

      const html = await file.text();
      const result = parseHtmlBookmarks(html);

      if (!result.success) {
        setError('Failed to parse bookmarks file');
        setStatus('idle');
        return;
      }

      const merged = appendImportedFolder(tree, result.data.tree);
      await save(merged);
      setStats(result.data.stats);
      setStatus('success');
    } catch {
      setError('Failed to import HTML file');
      setStatus('idle');
    } finally {
      input.value = '';
    }
  }, [tree, save]);

  const handleBackupFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      input.value = '';
      return;
    }

    try {
      const blob = await file.text();
      setBackupPrompt({ blob });
      setBackupPassword('');
      setError(null);
      setStats(null);
    } catch {
      setError('Failed to read backup file');
    } finally {
      input.value = '';
    }
  }, []);

  const handleBackupSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!backupPrompt) return;

    setError(null);
    setStatus('importing');

    try {
      const response = await sendMessage({
        type: 'IMPORT_BACKUP',
        blob: backupPrompt.blob,
        password: backupPassword,
      });

      if (!response.success) {
        setError(response.error);
        setStatus('idle');
        return;
      }

      if (!isBackupImportData(response.data)) {
        setError('Invalid backup response');
        setStatus('idle');
        return;
      }

      await save(response.data.tree);
      setBackupPrompt(null);
      setBackupPassword('');
      setStatus('success');
    } catch {
      setError('Failed to restore backup');
      setStatus('idle');
    }
  }, [sendMessage, backupPrompt, backupPassword, save]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <Button
          onClick={() => void handleChromeImport()}
          disabled={isImporting}
          size="sm"
          variant="outline"
          className="w-full"
        >
          Import Chrome Bookmarks
        </Button>
        <Button
          onClick={() => htmlInputRef.current?.click()}
          disabled={isImporting}
          size="sm"
          variant="outline"
          className="w-full"
        >
          Import HTML File
        </Button>
        <input
          ref={htmlInputRef}
          type="file"
          accept=".html,.htm"
          className="hidden"
          onChange={(e) => void handleHtmlFile(e)}
        />
        <Button
          onClick={() => backupInputRef.current?.click()}
          disabled={isImporting}
          size="sm"
          variant="outline"
          className="w-full"
        >
          Restore Backup
        </Button>
        <input
          ref={backupInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => void handleBackupFile(e)}
        />
      </div>
      {backupPrompt && (
        <form onSubmit={(e) => void handleBackupSubmit(e)} className="space-y-2">
          <Label htmlFor="backup-password" className="sr-only">Backup password</Label>
          <PasswordInput
            id="backup-password"
            value={backupPassword}
            onChange={setBackupPassword}
            placeholder="Backup password"
          />
          <Button type="submit" size="sm" disabled={isImporting}>
            Import
          </Button>
        </form>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {stats && (
        <p className="text-sm text-primary" role="status">
          Imported {stats.bookmarksImported} bookmarks, {stats.foldersImported} {stats.foldersImported === 1 ? 'folder' : 'folders'}
        </p>
      )}
    </div>
  );
}
