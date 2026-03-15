// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClearDataSection } from '@/components/settings/ClearDataSection';
import type { SendMessageFn } from '@/hooks/useSendMessage';
import type { SessionState } from '@/lib/background-types';

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

vi.mock('@/hooks/useSessionProvider', () => ({
  useSessionDispatch: vi.fn(),
}));

import { useSendMessage } from '@/hooks/useSendMessage';
import { useSessionDispatch } from '@/hooks/useSessionProvider';

const CLEARED_SESSION: SessionState = {
  isUnlocked: false,
  activeSetId: '',
  sets: [],
  tree: null,
  incognitoMode: 'normal_mode',
  hasData: false,
};

function setupMocks(sendMessageImpl?: SendMessageFn): { sendMessage: SendMessageFn; dispatch: ReturnType<typeof vi.fn> } {
  const sendMessage = sendMessageImpl ?? vi.fn<SendMessageFn>();
  const dispatch = vi.fn();
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);
  vi.mocked(useSessionDispatch).mockReturnValue(dispatch);
  return { sendMessage, dispatch };
}

describe('ClearDataSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Delete All Data button', () => {
    // #given
    setupMocks();

    // #when
    render(<ClearDataSection />);

    // #then
    expect(screen.getByRole('button', { name: /delete all data/i })).toBeInTheDocument();
  });

  it('clicking button shows type-to-confirm input with disabled confirm', async () => {
    // #given
    setupMocks();
    const user = userEvent.setup();
    render(<ClearDataSection />);

    // #when
    await user.click(screen.getByRole('button', { name: /delete all data/i }));

    // #then
    expect(screen.getByPlaceholderText(/type delete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });

  it('confirm button enables only when user types DELETE', async () => {
    // #given
    setupMocks();
    const user = userEvent.setup();
    render(<ClearDataSection />);
    await user.click(screen.getByRole('button', { name: /delete all data/i }));

    // #when
    await user.type(screen.getByPlaceholderText(/type delete/i), 'DELETE');

    // #then
    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled();
  });

  it('sends CLEAR_ALL on confirm and dispatches SET_SESSION with refreshed state', async () => {
    // #given
    const { sendMessage, dispatch } = setupMocks(
      vi.fn<SendMessageFn>()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true, data: CLEARED_SESSION }),
    );
    const user = userEvent.setup();
    render(<ClearDataSection />);

    // #when
    await user.click(screen.getByRole('button', { name: /delete all data/i }));
    await user.type(screen.getByPlaceholderText(/type delete/i), 'DELETE');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    // #then
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'CLEAR_ALL', confirmation: 'DELETE' });
    });
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'GET_STATE' });
    });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SESSION', session: CLEARED_SESSION });
    });
  });
});
