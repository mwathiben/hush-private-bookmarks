// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetManagement } from '@/components/settings/SetManagement';
import type { SendMessageFn } from '@/hooks/useSendMessage';
import type { SessionState } from '@/lib/background-types';

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

vi.mock('@/hooks/useSessionProvider', () => ({
  useSessionState: vi.fn(),
  useSessionDispatch: vi.fn(),
}));

import { useSendMessage } from '@/hooks/useSendMessage';
import { useSessionState, useSessionDispatch } from '@/hooks/useSessionProvider';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const MOCK_SESSION: SessionState = {
  isUnlocked: true,
  activeSetId: 'default',
  sets: [
    { id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true },
    { id: 'work', name: 'Work', createdAt: 1, lastAccessedAt: 1, isDefault: false },
  ],
  tree: { type: 'folder', id: 'root', name: 'Root', children: [], dateAdded: 0 },
  incognitoMode: 'normal_mode',
  hasData: true,
  proStatus: { isPro: false, expiresAt: null, trialDaysLeft: null, canTrial: true },
};

function setupMocks(overrides?: {
  sendMessage?: SendMessageFn;
  session?: SessionState;
}): { sendMessage: SendMessageFn; dispatch: ReturnType<typeof vi.fn> } {
  const sendMessage = overrides?.sendMessage ?? vi.fn<SendMessageFn>();
  const dispatch = vi.fn();
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);
  vi.mocked(useSessionDispatch).mockReturnValue(dispatch);
  vi.mocked(useSessionState).mockReturnValue({
    screen: 'settings',
    session: overrides?.session ?? MOCK_SESSION,
    loading: false,
    error: null,
  });
  return { sendMessage, dispatch };
}

describe('SetManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('lists sets from session context with names', () => {
    // #given
    setupMocks();

    // #when
    render(<SetManagement />);

    // #then
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('shows Default badge on default set', () => {
    // #given
    setupMocks();

    // #when
    render(<SetManagement />);

    // #then
    const badges = screen.getAllByText('default');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('create set sends CREATE_SET and dispatches SET_SESSION', async () => {
    // #given
    const newSession = { ...MOCK_SESSION, sets: [...MOCK_SESSION.sets, { id: 'new', name: 'New Set', createdAt: 2, lastAccessedAt: 2, isDefault: false }] };
    const { sendMessage, dispatch } = setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({ success: true, data: newSession }),
    });
    const user = userEvent.setup();
    render(<SetManagement />);

    // #when
    await user.click(screen.getByRole('button', { name: /create set/i }));
    await user.type(screen.getByPlaceholderText(/set name/i), 'New Set');
    await user.type(screen.getByPlaceholderText(/password/i), 'testpass');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    // #then
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'CREATE_SET',
        name: 'New Set',
        password: 'testpass',
      });
    });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SESSION', session: newSession });
    });
  });

  it('cannot delete default set (delete button disabled)', () => {
    // #given
    setupMocks();

    // #when
    render(<SetManagement />);

    // #then
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    const firstDelete = deleteButtons[0]!;
    expect(firstDelete).toBeDisabled();
  });

  it('rename set sends RENAME_SET and refreshes session', async () => {
    // #given
    const refreshedSession = { ...MOCK_SESSION };
    const { sendMessage, dispatch } = setupMocks({
      sendMessage: vi.fn<SendMessageFn>()
        .mockResolvedValueOnce({ success: true, data: null })
        .mockResolvedValueOnce({ success: true, data: refreshedSession }),
    });
    const user = userEvent.setup();
    render(<SetManagement />);

    // #when
    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    await user.click(renameButtons[1]!);
    const nameInput = screen.getByPlaceholderText(/new name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed');
    await user.click(screen.getByRole('button', { name: /^rename$/i }));

    // #then
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'RENAME_SET',
        setId: 'work',
        newName: 'Renamed',
      });
    });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SESSION', session: refreshedSession });
    });
  });

  it('delete non-default set sends DELETE_SET and refreshes session', async () => {
    // #given
    const refreshedSession = { ...MOCK_SESSION, sets: [MOCK_SESSION.sets[0]!] };
    const { sendMessage, dispatch } = setupMocks({
      sendMessage: vi.fn<SendMessageFn>()
        .mockResolvedValueOnce({ success: true, data: null })
        .mockResolvedValueOnce({ success: true, data: refreshedSession }),
    });
    const user = userEvent.setup();
    render(<SetManagement />);

    // #when
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[1]!);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    // #then
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'DELETE_SET',
        setId: 'work',
      });
    });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SESSION', session: refreshedSession });
    });
  });

  it('shows error when create set fails', async () => {
    // #given
    setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({ success: false, error: 'Name taken' }),
    });
    const user = userEvent.setup();
    render(<SetManagement />);

    // #when
    await user.click(screen.getByRole('button', { name: /create set/i }));
    await user.type(screen.getByPlaceholderText(/set name/i), 'Dup');
    await user.type(screen.getByPlaceholderText(/password/i), 'pass123');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByText('Name taken')).toBeInTheDocument();
    });
  });

  it('shows error when rename fails', async () => {
    // #given
    setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({ success: false, error: 'Rename failed' }),
    });
    const user = userEvent.setup();
    render(<SetManagement />);

    // #when
    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    await user.click(renameButtons[0]!);
    const nameInput = screen.getByPlaceholderText(/new name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'NewName');
    await user.click(screen.getByRole('button', { name: /^rename$/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByText('Rename failed')).toBeInTheDocument();
    });
  });

  it('shows error when delete fails', async () => {
    // #given
    setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({ success: false, error: 'Delete failed' }),
    });
    const user = userEvent.setup();
    render(<SetManagement />);

    // #when
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await user.click(deleteButtons[1]!);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });
  });
});
