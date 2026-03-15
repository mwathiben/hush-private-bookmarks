import { useState } from 'react';
import { useSessionState, useSessionDispatch } from '@/hooks/useSessionProvider';
import { useSendMessage } from '@/hooks/useSendMessage';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { SetPicker } from '@/components/ui/SetPicker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getIncognitoMessage } from '@/lib/incognito';
import { isSessionState } from '@/hooks/useSession';

export default function LoginScreen(): React.JSX.Element {
  const { session } = useSessionState();
  const dispatch = useSessionDispatch();
  const sendMessage = useSendMessage();

  const [password, setPassword] = useState('');
  const [selectedSetId, setSelectedSetId] = useState(
    session?.activeSetId ?? 'default',
  );
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock(): Promise<void> {
    if (!password.trim() || unlocking) return;

    setUnlocking(true);
    setError(null);

    try {
      const response = await sendMessage({
        type: 'UNLOCK',
        password,
        setId: selectedSetId,
      });

      if (response.success && isSessionState(response.data)) {
        setPassword('');
        dispatch({
          type: 'SET_SESSION',
          session: response.data,
        });
      } else if (response.success) {
        setError('Invalid session data from background');
        setUnlocking(false);
      } else {
        setError(response.error);
        setUnlocking(false);
      }
    } catch {
      setError('Failed to connect to extension');
      setUnlocking(false);
    }
  }

  const incognitoMode = session?.incognitoMode;
  const incognitoMessage = incognitoMode
    ? getIncognitoMessage(incognitoMode)
    : null;

  return (
    <div data-testid="login-screen" className="flex flex-col gap-4 p-6">
      <h1 className="text-center text-lg font-semibold">
        Hush Private Bookmarks
      </h1>

      {incognitoMode === 'incognito_active' && (
        <Badge variant="secondary" className="self-center">
          Incognito
        </Badge>
      )}

      {incognitoMode === 'incognito_not_allowed' && incognitoMessage && (
        <Badge variant="destructive" className="self-center text-wrap">
          {incognitoMessage}
        </Badge>
      )}

      {session && (
        <SetPicker
          sets={session.sets}
          value={selectedSetId}
          onChange={setSelectedSetId}
          disabled={unlocking}
        />
      )}

      <PasswordInput
        value={password}
        onChange={setPassword}
        onSubmit={handleUnlock}
        disabled={unlocking}
        autoFocus
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        onClick={handleUnlock}
        disabled={unlocking || !password.trim()}
        className="w-full"
      >
        {unlocking ? 'Unlocking...' : 'Unlock'}
      </Button>
    </div>
  );
}
