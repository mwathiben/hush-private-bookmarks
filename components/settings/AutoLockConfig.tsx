import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSendMessage } from '@/hooks/useSendMessage';

type ConfigStatus = 'idle' | 'pending' | 'success';

export function AutoLockConfig(): React.JSX.Element {
  const sendMessage = useSendMessage();
  const [minutes, setMinutes] = useState('10');
  const [status, setStatus] = useState<ConfigStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const isPending = status === 'pending';

  const handleSubmit = useCallback(async (): Promise<void> => {
    setError(null);
    const parsed = Number(minutes);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError('Enter a positive whole number');
      return;
    }

    setStatus('pending');
    try {
      const response = await sendMessage({ type: 'UPDATE_AUTO_LOCK', minutes: parsed });
      if (response.success) {
        setStatus('success');
      } else {
        setError(response.error);
        setStatus('idle');
      }
    } catch {
      setError('Failed to update auto-lock');
      setStatus('idle');
    }
  }, [minutes, sendMessage]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="number"
          min="1"
          step="1"
          value={minutes}
          onChange={(e) => { setMinutes(e.target.value); setStatus('idle'); }}
          disabled={isPending}
          className="w-20"
        />
        <span className="self-center text-sm text-muted-foreground">minutes</span>
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={isPending}
        onClick={() => void handleSubmit()}
      >
        {isPending ? 'Updating...' : 'Update Auto-Lock'}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {status === 'success' && (
        <p className="text-sm text-green-600" role="status">Auto-lock updated</p>
      )}
    </div>
  );
}
