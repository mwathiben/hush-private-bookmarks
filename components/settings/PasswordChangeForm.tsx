import { useState } from 'react';
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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
  };

  const isPending = status === 'pending';

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="current-password">Current password</Label>
        <PasswordInput
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Current password"
          autocomplete="current-password"
          disabled={isPending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-password">New password</Label>
        <PasswordInput
          value={newPassword}
          onChange={setNewPassword}
          placeholder="New password"
          autocomplete="new-password"
          disabled={isPending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <PasswordInput
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm new password"
          autocomplete="new-password"
          disabled={isPending}
        />
      </div>
      {error !== null && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {status === 'success' && (
        <p className="text-sm text-green-600">Password changed successfully</p>
      )}
      <Button type="submit" size="sm" className="w-full" disabled={isPending}>
        {isPending ? 'Changing...' : 'Change Password'}
      </Button>
    </form>
  );
}
