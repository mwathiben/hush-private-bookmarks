// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginScreen from '@/components/screens/LoginScreen';
import type { BackgroundResponse, SessionState } from '@/lib/background-types';
import type { SendMessageFn } from '@/hooks/useSendMessage';

vi.mock('@/entrypoints/popup/App', () => ({
  useSessionState: vi.fn(),
  useSessionDispatch: vi.fn(),
}));

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

import { useSessionState, useSessionDispatch } from '@/entrypoints/popup/App';
import { useSendMessage } from '@/hooks/useSendMessage';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const BASE_SESSION: SessionState = {
  isUnlocked: false,
  activeSetId: 'default',
  hasData: true,
  sets: [{ id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true }],
  tree: null,
  incognitoMode: 'normal_mode',
};

function setupMocks(
  sessionOverrides?: Partial<SessionState>,
  sendMessageImpl?: SendMessageFn,
): { dispatch: ReturnType<typeof vi.fn>; sendMessage: SendMessageFn } {
  const session = { ...BASE_SESSION, ...sessionOverrides };
  const dispatch = vi.fn();
  const sendMessage = sendMessageImpl ?? vi.fn<SendMessageFn>();

  vi.mocked(useSessionState).mockReturnValue({
    screen: 'login' as const,
    session,
    loading: false,
    error: null,
  });
  vi.mocked(useSessionDispatch).mockReturnValue(dispatch);
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);

  return { dispatch, sendMessage };
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders password input and unlock button', () => {
    setupMocks();
    render(<LoginScreen />);

    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument();
  });

  it('shows set picker when multiple sets exist', () => {
    setupMocks({
      sets: [
        { id: 'set-1', name: 'Personal', createdAt: 0, lastAccessedAt: 0, isDefault: true },
        { id: 'set-2', name: 'Work', createdAt: 0, lastAccessedAt: 0, isDefault: false },
      ],
      activeSetId: 'set-1',
    });
    render(<LoginScreen />);

    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('sends UNLOCK message with password and selected setId', async () => {
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({
      success: true,
      data: { ...BASE_SESSION, isUnlocked: true, hasData: true },
    });
    setupMocks(undefined, sendMessage);

    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Password'), 'mypass');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'UNLOCK',
      password: 'mypass',
      setId: 'default',
    });
  });

  it('disables unlock button during send, re-enables on failure', async () => {
    let resolvePromise!: (value: BackgroundResponse) => void;
    const sendMessage = vi.fn<SendMessageFn>().mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; }),
    );
    setupMocks(undefined, sendMessage);

    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Password'), 'test');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    expect(screen.getByRole('button', { name: /unlocking/i })).toBeDisabled();

    resolvePromise({ success: false, error: 'Invalid password', code: 'INVALID_PASSWORD' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /unlock/i })).toBeEnabled();
    });
  });

  it('dispatches SET_SESSION on successful unlock', async () => {
    const unlockedSession: SessionState = {
      ...BASE_SESSION,
      isUnlocked: true,
      hasData: true,
      tree: { type: 'folder', id: 'root', name: 'Root', children: [], dateAdded: 0 },
    };
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({ success: true, data: unlockedSession });
    const { dispatch } = setupMocks(undefined, sendMessage);

    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Password'), 'correct');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_SESSION',
        session: unlockedSession,
      });
    });
  });

  it('shows error message without clearing input on wrong password', async () => {
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({
      success: false,
      error: 'Invalid password',
      code: 'INVALID_PASSWORD',
    });
    setupMocks(undefined, sendMessage);

    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid password')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Password')).toHaveValue('wrongpass');
  });

  it('toggles password visibility', async () => {
    setupMocks();
    render(<LoginScreen />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /toggle password/i }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /toggle password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows incognito badge when incognitoMode is incognito_not_allowed', () => {
    setupMocks({ incognitoMode: 'incognito_not_allowed' });
    render(<LoginScreen />);

    expect(screen.getByText(/not enabled for incognito/i)).toBeInTheDocument();
  });

  it('shows connection error when sendMessage throws', async () => {
    const sendMessage = vi.fn<SendMessageFn>().mockRejectedValue(new Error('Network'));
    setupMocks(undefined, sendMessage);

    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Password'), 'anypass');
    await user.click(screen.getByRole('button', { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to connect to extension')).toBeInTheDocument();
    });
  });

  it('submits on Enter key press', async () => {
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({
      success: true,
      data: { ...BASE_SESSION, isUnlocked: true, hasData: true },
    });
    const { dispatch } = setupMocks(undefined, sendMessage);

    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Password'), 'mypass{Enter}');

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'UNLOCK',
        password: 'mypass',
        setId: 'default',
      });
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalled();
    });
  });
});
