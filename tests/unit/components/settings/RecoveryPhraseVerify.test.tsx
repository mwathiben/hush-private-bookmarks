// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecoveryPhraseVerify } from '@/components/settings/RecoveryPhraseVerify';

vi.mock('@/lib/recovery', () => ({
  validateMnemonic: vi.fn(),
}));

import { validateMnemonic } from '@/lib/recovery';

describe('RecoveryPhraseVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders textarea with placeholder', () => {
    // #given / #when
    render(<RecoveryPhraseVerify />);

    // #then
    expect(screen.getByPlaceholderText('Enter your recovery phrase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
  });

  it('normalizes input and calls validateMnemonic with trimmed lowercase phrase', async () => {
    // #given
    vi.mocked(validateMnemonic).mockReturnValue(true);
    const user = userEvent.setup();
    render(<RecoveryPhraseVerify />);

    // #when
    await user.type(
      screen.getByPlaceholderText('Enter your recovery phrase'),
      '  ABANDON  Ability  ABLE  ',
    );
    await user.click(screen.getByRole('button', { name: /verify/i }));

    // #then
    expect(validateMnemonic).toHaveBeenCalledWith('abandon ability able');
    await waitFor(() => {
      expect(screen.getByText('Valid recovery phrase')).toBeInTheDocument();
    });
  });

  it('shows invalid message when validateMnemonic returns false', async () => {
    // #given
    vi.mocked(validateMnemonic).mockReturnValue(false);
    const user = userEvent.setup();
    render(<RecoveryPhraseVerify />);

    // #when
    await user.type(
      screen.getByPlaceholderText('Enter your recovery phrase'),
      'not a valid phrase',
    );
    await user.click(screen.getByRole('button', { name: /verify/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid recovery phrase');
    });
  });
});
