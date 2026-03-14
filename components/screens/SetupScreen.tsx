import { useState } from 'react';
import { useSessionDispatch } from '@/entrypoints/popup/App';
import { useSendMessage } from '@/hooks/useSendMessage';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { MnemonicDisplay } from '@/components/shared/MnemonicDisplay';
import { Button } from '@/components/ui/button';
import { generateMnemonic } from '@/lib/recovery';
import type { SessionState } from '@/lib/background-types';

type Step =
  | 'create-password'
  | 'confirm-password'
  | 'show-mnemonic'
  | 'confirm-backup'
  | 'creating';

const MIN_PASSWORD_LENGTH = 8;

export default function SetupScreen(): React.JSX.Element {
  const dispatch = useSessionDispatch();
  const sendMessage = useSendMessage();

  const [step, setStep] = useState<Step>('create-password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleNext(): void {
    if (password.length < MIN_PASSWORD_LENGTH) return;
    setError(null);
    setStep('confirm-password');
  }

  function handleConfirmPassword(): void {
    if (confirmPassword !== password) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setMnemonic(generateMnemonic());
    setStep('show-mnemonic');
  }

  async function handleCreate(): Promise<void> {
    setStep('creating');
    setError(null);

    try {
      const response = await sendMessage({
        type: 'CREATE_SET',
        name: 'Default',
        password,
      });

      if (response.success) {
        setPassword('');
        setConfirmPassword('');
        setMnemonic('');
        dispatch({
          type: 'SET_SESSION',
          session: response.data as SessionState,
        });
      } else {
        setError(response.error);
        setStep('confirm-backup');
      }
    } catch {
      setError('Failed to connect to extension');
      setStep('confirm-backup');
    }
  }

  return (
    <div data-testid="setup-screen" className="flex flex-col gap-4 p-6">
      <h1 className="text-center text-lg font-semibold">
        Create Your Vault
      </h1>

      {step === 'create-password' && (
        <>
          <p className="text-sm text-muted-foreground">
            Choose a strong password to encrypt your bookmarks.
          </p>
          <PasswordInput
            value={password}
            onChange={setPassword}
            onSubmit={handleNext}
            placeholder="Create password"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Minimum {MIN_PASSWORD_LENGTH} characters
          </p>
          <Button
            onClick={handleNext}
            disabled={password.length < MIN_PASSWORD_LENGTH}
            className="w-full"
          >
            Next
          </Button>
        </>
      )}

      {step === 'confirm-password' && (
        <>
          <p className="text-sm text-muted-foreground">
            Confirm your password.
          </p>
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            onSubmit={handleConfirmPassword}
            placeholder="Confirm password"
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmPassword('');
                setError(null);
                setStep('create-password');
              }}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleConfirmPassword}
              disabled={!confirmPassword}
              className="flex-1"
            >
              Confirm
            </Button>
          </div>
        </>
      )}

      {step === 'show-mnemonic' && (
        <>
          <p className="text-sm text-muted-foreground">
            Write down your recovery phrase. You will need it to recover your
            data if you forget your password.
          </p>
          <MnemonicDisplay mnemonic={mnemonic} />
          <Button onClick={() => setStep('confirm-backup')} className="w-full">
            I've saved my recovery phrase
          </Button>
        </>
      )}

      {step === 'confirm-backup' && (
        <>
          <p className="text-sm text-muted-foreground">
            Your recovery phrase is the only way to recover your data if you
            forget your password. Make sure you have written it down.
          </p>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setStep('show-mnemonic');
              }}
              className="flex-1"
            >
              Go back
            </Button>
            <Button onClick={handleCreate} className="flex-1">
              Create Vault
            </Button>
          </div>
        </>
      )}

      {step === 'creating' && (
        <Button disabled className="w-full">
          Creating...
        </Button>
      )}
    </div>
  );
}
