// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoLockConfig } from '@/components/settings/AutoLockConfig';
import type { SendMessageFn } from '@/hooks/useSendMessage';

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

import { useSendMessage } from '@/hooks/useSendMessage';

function setupMocks(sendMessageImpl?: SendMessageFn): { sendMessage: SendMessageFn } {
  const sendMessage = sendMessageImpl ?? vi.fn<SendMessageFn>();
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);
  return { sendMessage };
}

describe('AutoLockConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders input with default value 10', () => {
    // #given
    setupMocks();

    // #when
    render(<AutoLockConfig />);

    // #then
    expect(screen.getByRole('spinbutton')).toHaveValue(10);
  });

  it('sends UPDATE_AUTO_LOCK with parsed integer on submit', async () => {
    // #given
    const { sendMessage } = setupMocks(
      vi.fn<SendMessageFn>().mockResolvedValue({ success: true }),
    );
    const user = userEvent.setup();
    render(<AutoLockConfig />);

    // #when
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '5');
    await user.click(screen.getByRole('button', { name: /update/i }));

    // #then
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'UPDATE_AUTO_LOCK', minutes: 5 });
    });
    await waitFor(() => {
      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });
  });
});
