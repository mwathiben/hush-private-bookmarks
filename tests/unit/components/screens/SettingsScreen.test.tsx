// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsScreen from '@/components/screens/SettingsScreen';
import type { SendMessageFn } from '@/hooks/useSendMessage';

vi.mock('@/entrypoints/popup/App', () => ({
  useSessionDispatch: vi.fn(),
}));

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

vi.mock('@/lib/recovery', () => ({
  validateMnemonic: vi.fn(),
}));

import { useSessionDispatch } from '@/entrypoints/popup/App';
import { useSendMessage } from '@/hooks/useSendMessage';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

function setupMocks(): { dispatch: ReturnType<typeof vi.fn> } {
  const dispatch = vi.fn();
  vi.mocked(useSessionDispatch).mockReturnValue(dispatch);
  vi.mocked(useSendMessage).mockReturnValue(vi.fn<SendMessageFn>());
  return { dispatch };
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders section headings', () => {
    // #given
    setupMocks();

    // #when
    render(<SettingsScreen />);

    // #then
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('dispatches NAVIGATE to tree when back button is clicked', async () => {
    // #given
    const { dispatch } = setupMocks();
    const user = userEvent.setup();
    render(<SettingsScreen />);

    // #when
    await user.click(screen.getByRole('button', { name: /back/i }));

    // #then
    expect(dispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', to: 'tree' });
  });
});
