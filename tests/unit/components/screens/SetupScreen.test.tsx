// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetupScreen from '@/components/screens/SetupScreen';
import type { BackgroundResponse, SessionState } from '@/lib/background-types';
import type { SendMessageFn } from '@/hooks/useSendMessage';

vi.mock('@/entrypoints/popup/App', () => ({
  useSessionState: vi.fn(),
  useSessionDispatch: vi.fn(),
}));

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

vi.mock('@/lib/recovery', () => ({
  generateMnemonic: vi.fn(
    () => 'abandon ability able about above absent absorb abstract absurd abuse access accident',
  ),
}));

import { useSessionState, useSessionDispatch } from '@/entrypoints/popup/App';
import { useSendMessage } from '@/hooks/useSendMessage';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  }
});

const BASE_SESSION: SessionState = {
  isUnlocked: false,
  activeSetId: '',
  hasData: false,
  sets: [],
  tree: null,
  incognitoMode: 'normal_mode',
};

function setupMocks(
  sendMessageImpl?: SendMessageFn,
): { dispatch: ReturnType<typeof vi.fn>; sendMessage: SendMessageFn } {
  const dispatch = vi.fn();
  const sendMessage = sendMessageImpl ?? vi.fn<SendMessageFn>();

  vi.mocked(useSessionState).mockReturnValue({
    screen: 'setup' as const,
    session: BASE_SESSION,
    loading: false,
    error: null,
  });
  vi.mocked(useSessionDispatch).mockReturnValue(dispatch);
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);

  return { dispatch, sendMessage };
}

async function fillPasswordAndConfirm(
  user: ReturnType<typeof userEvent.setup>,
  password = 'mypassword',
): Promise<void> {
  await user.type(screen.getByPlaceholderText('Create password'), password);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await user.type(screen.getByPlaceholderText('Confirm password'), password);
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
}

async function advanceToConfirmBackup(
  user: ReturnType<typeof userEvent.setup>,
  password = 'mypassword',
): Promise<void> {
  await fillPasswordAndConfirm(user, password);
  await user.click(screen.getByRole('button', { name: /saved my recovery phrase/i }));
}

describe('SetupScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders password creation form with disabled Next button', () => {
    setupMocks();
    render(<SetupScreen />);

    expect(screen.getByPlaceholderText('Create password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('enables Next button when password >= 8 characters', async () => {
    setupMocks();
    render(<SetupScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Create password'), 'short');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.clear(screen.getByPlaceholderText('Create password'));
    await user.type(screen.getByPlaceholderText('Create password'), 'longpassword');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('rejects mismatched password confirmation with error message', async () => {
    setupMocks();
    render(<SetupScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Create password'), 'mypassword');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.type(screen.getByPlaceholderText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('after password confirmed, generates and displays 12-word mnemonic', async () => {
    setupMocks();
    render(<SetupScreen />);
    const user = userEvent.setup();

    await fillPasswordAndConfirm(user);

    expect(screen.getByTestId('mnemonic-display')).toBeInTheDocument();
    expect(screen.getByText('abandon')).toBeInTheDocument();
    expect(screen.getByText('accident')).toBeInTheDocument();
  });

  it('sends CREATE_SET with name "Default" and password on confirm', async () => {
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({
      success: true,
      data: { ...BASE_SESSION, isUnlocked: true, hasData: true },
    });
    setupMocks(sendMessage);

    render(<SetupScreen />);
    const user = userEvent.setup();

    await advanceToConfirmBackup(user, 'mypassword');
    await user.click(screen.getByRole('button', { name: 'Create Vault' }));

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'CREATE_SET',
      name: 'Default',
      password: 'mypassword',
    });
  });

  it('dispatches SET_SESSION on successful creation', async () => {
    const unlockedSession: SessionState = {
      ...BASE_SESSION,
      isUnlocked: true,
      hasData: true,
      tree: { type: 'folder', id: 'root', name: 'Root', children: [], dateAdded: 0 },
    };
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({
      success: true,
      data: unlockedSession,
    });
    const { dispatch } = setupMocks(sendMessage);

    render(<SetupScreen />);
    const user = userEvent.setup();

    await advanceToConfirmBackup(user);
    await user.click(screen.getByRole('button', { name: 'Create Vault' }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_SESSION',
        session: unlockedSession,
      });
    });
  });

  it('shows loading state during vault creation', async () => {
    let resolvePromise!: (value: BackgroundResponse) => void;
    const sendMessage = vi.fn<SendMessageFn>().mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; }),
    );
    setupMocks(sendMessage);

    render(<SetupScreen />);
    const user = userEvent.setup();

    await advanceToConfirmBackup(user);
    await user.click(screen.getByRole('button', { name: 'Create Vault' }));

    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();

    resolvePromise({ success: false, error: 'NOT_IMPLEMENTED', code: 'CREATE_SET' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Vault' })).toBeEnabled();
    });
  });

  it('shows error and returns to confirm-backup step on failure', async () => {
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({
      success: false,
      error: 'NOT_IMPLEMENTED',
      code: 'CREATE_SET',
    });
    setupMocks(sendMessage);

    render(<SetupScreen />);
    const user = userEvent.setup();

    await advanceToConfirmBackup(user);
    await user.click(screen.getByRole('button', { name: 'Create Vault' }));

    await waitFor(() => {
      expect(screen.getByText('NOT_IMPLEMENTED')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Create Vault' })).toBeEnabled();
  });

  it('shows connection error when sendMessage throws', async () => {
    const sendMessage = vi.fn<SendMessageFn>().mockRejectedValue(new Error('Network'));
    setupMocks(sendMessage);

    render(<SetupScreen />);
    const user = userEvent.setup();

    await advanceToConfirmBackup(user);
    await user.click(screen.getByRole('button', { name: 'Create Vault' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to connect to extension')).toBeInTheDocument();
    });
  });
});

describe('MnemonicDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders 12 numbered words in grid with copy button', async () => {
    setupMocks();
    render(<SetupScreen />);
    const user = userEvent.setup();

    await fillPasswordAndConfirm(user);

    const display = screen.getByTestId('mnemonic-display');
    expect(display).toBeInTheDocument();

    const words = 'abandon ability able about above absent absorb abstract absurd abuse access accident'.split(' ');
    for (const word of words) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }

    expect(screen.getByTestId('copy-mnemonic-button')).toBeInTheDocument();
    expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();

    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);

    await user.click(screen.getByTestId('copy-mnemonic-button'));

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
    expect(writeTextSpy).toHaveBeenCalledWith(words.join(' '));
  });
});
