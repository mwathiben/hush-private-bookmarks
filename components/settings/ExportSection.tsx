import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useSessionState } from '@/entrypoints/popup/App';

type ExportStatus = 'idle' | 'pending' | 'success';

interface ExportData {
  readonly blob: string;
}

function isExportData(data: unknown): data is ExportData {
  return data !== null && typeof data === 'object' && 'blob' in data && typeof (data as ExportData).blob === 'string';
}

function triggerDownload(blob: string): void {
  const file = new Blob([blob], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hush-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function ExportSection(): React.JSX.Element {
  const sendMessage = useSendMessage();
  const { session } = useSessionState();
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const isUnlocked = session?.isUnlocked === true;
  const isPending = status === 'pending';

  const handleExport = useCallback(async (): Promise<void> => {
    setError(null);
    setStatus('pending');

    try {
      const response = await sendMessage({ type: 'EXPORT_BACKUP' });

      if (!response.success) {
        setError(response.error);
        setStatus('idle');
        return;
      }

      if (!isExportData(response.data)) {
        setError('Invalid export response');
        setStatus('idle');
        return;
      }

      triggerDownload(response.data.blob);
      setStatus('success');
    } catch {
      setError('Failed to export backup');
      setStatus('idle');
    }
  }, [sendMessage]);

  return (
    <div className="space-y-2">
      <Button
        onClick={() => void handleExport()}
        disabled={!isUnlocked || isPending}
        size="sm"
        variant="outline"
        className="w-full"
      >
        {isPending ? 'Exporting...' : 'Export Backup'}
      </Button>
      {!isUnlocked && (
        <p className="text-xs text-muted-foreground">Unlock to export</p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {status === 'success' && (
        <p className="text-sm text-green-600" role="status">Backup exported</p>
      )}
    </div>
  );
}
