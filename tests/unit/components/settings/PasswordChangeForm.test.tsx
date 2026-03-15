// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm';
import type { SendMessageFn } from '@/hooks/useSendMessage';

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

import { useSendMessage } from '@/hooks/useSendMessage';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

function setupMocks(sendMessageImpl?: SendMessageFn): { sendMessage: SendMessageFn } {
  const sendMessage = sendMessageImpl ?? vi.fn<SendMessageFn>();
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);
  return { sendMessage };
}

describe('PasswordChangeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders three password inputs with correct placeholders', () => {
    // #given
    setupMocks();

    // #when
    render(<PasswordChangeForm />);

    // #then
    expect(screen.getByPlaceholderText('Current password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument();
  });

  it('shows error when new and confirm passwords do not match', async () => {
    // #given
    setupMocks();
    const user = userEvent.setup();
    render(<PasswordChangeForm />);

    // #when
    await user.type(screen.getByPlaceholderText('Current password'), 'old-pass');
    await user.type(screen.getByPlaceholderText('New password'), 'new-pass-1');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'new-pass-2');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
    });
  });

  it('sends CHANGE_PASSWORD message and shows success on valid submit', async () => {
    // #given
    const { sendMessage } = setupMocks(
      vi.fn<SendMessageFn>().mockResolvedValue({ success: true }),
    );
    const user = userEvent.setup();
    render(<PasswordChangeForm />);

    // #when
    await user.type(screen.getByPlaceholderText('Current password'), 'old-pass');
    await user.type(screen.getByPlaceholderText('New password'), 'new-pass');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'new-pass');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    // #then
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'CHANGE_PASSWORD',
        currentPassword: 'old-pass',
        newPassword: 'new-pass',
      });
    });
    expect(screen.getByText('Password changed successfully')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Current password')).toHaveValue('');
  });

  it('shows error from background when CHANGE_PASSWORD fails', async () => {
    // #given
    setupMocks(
      vi.fn<SendMessageFn>().mockResolvedValue({
        success: false,
        error: 'Invalid password',
        code: 'INVALID_PASSWORD',
      }),
    );
    const user = userEvent.setup();
    render(<PasswordChangeForm />);

    // #when
    await user.type(screen.getByPlaceholderText('Current password'), 'wrong-pass');
    await user.type(screen.getByPlaceholderText('New password'), 'new-pass');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'new-pass');
    await user.click(screen.getByRole('button', { name: /change password/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid password');
    });
  });
});
