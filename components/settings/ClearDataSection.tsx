import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useSessionDispatch } from '@/hooks/useSessionProvider';
import { isSessionState } from '@/hooks/useSession';

export function ClearDataSection(): React.JSX.Element {
  const sendMessage = useSendMessage();
  const dispatch = useSessionDispatch();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClear = useCallback(async (): Promise<void> => {
    setError(null);
    setPending(true);

    try {
      const response = await sendMessage({ type: 'CLEAR_ALL', confirmation: 'DELETE' });
      if (!response.success) {
        setError(response.error);
        return;
      }

      const stateResponse = await sendMessage({ type: 'GET_STATE' });
      if (stateResponse.success && isSessionState(stateResponse.data)) {
        dispatch({ type: 'SET_SESSION', session: stateResponse.data });
      }
    } catch {
      setError('Failed to clear data');
    } finally {
      setPending(false);
    }
  }, [sendMessage, dispatch]);

  if (!showConfirm) {
    return (
      <div className="space-y-2">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => setShowConfirm(true)}
        >
          Delete All Data
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        This will permanently delete all sets and bookmarks.
      </p>
      <Input
        placeholder="Type DELETE to confirm"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        disabled={pending}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => { setShowConfirm(false); setConfirmText(''); }}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          disabled={confirmText !== 'DELETE' || pending}
          onClick={() => void handleClear()}
        >
          {pending ? 'Deleting...' : 'Confirm Delete'}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}
