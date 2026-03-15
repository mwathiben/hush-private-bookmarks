import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useSendMessage } from '@/hooks/useSendMessage';

type FormStatus = 'idle' | 'pending' | 'success';

export function PasswordChangeForm(): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<FormStatus>('idle');
  const sendMessage = useSendMessage();

  useEffect(() => {
    return () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setStatus('pending');

    try {
      const response = await sendMessage({
        type: 'CHANGE_PASSWORD',
        currentPassword,
        newPassword,
      });

      if (response.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setStatus('success');
        return;
      }

      setError(response.error);
      setStatus('idle');
    } catch {
      setError('Failed to change password');
      setStatus('idle');
    }
  }

  const isPending = status === 'pending';

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
      <div>
        <Label htmlFor="current-password" className="sr-only">Current password</Label>
        <PasswordInput
          id="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Current password"
          autocomplete="current-password"
          disabled={isPending}
        />
      </div>
      <div>
        <Label htmlFor="new-password" className="sr-only">New password</Label>
        <PasswordInput
          id="new-password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="New password"
          autocomplete="new-password"
          disabled={isPending}
        />
      </div>
      <div>
        <Label htmlFor="confirm-password" className="sr-only">Confirm new password</Label>
        <PasswordInput
          id="confirm-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm new password"
          autocomplete="new-password"
          disabled={isPending}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {status === 'success' && (
        <p className="text-sm text-green-600" role="status">Password changed successfully</p>
      )}
      <Button type="submit" size="sm" className="w-full" disabled={isPending}>
        {isPending ? 'Changing...' : 'Change Password'}
      </Button>
    </form>
  );
}
