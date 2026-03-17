// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UpgradePrompt } from '@/components/shared/UpgradePrompt';

describe('UpgradePrompt', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders feature name and upgrade button', () => {
    // #given / #when
    render(
      <UpgradePrompt
        featureName="Cloud Sync"
        benefitText="Sync bookmarks across devices"
        canTrial={false}
        onUpgrade={vi.fn()}
      />,
    );

    // #then
    expect(screen.getByText('Cloud Sync')).toBeInTheDocument();
    expect(screen.getByText('Sync bookmarks across devices')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /free trial/i })).not.toBeInTheDocument();
  });

  it('calls onUpgrade when upgrade button is clicked', async () => {
    // #given
    const onUpgrade = vi.fn();
    const user = userEvent.setup();
    render(
      <UpgradePrompt
        featureName="Cloud Sync"
        benefitText="Sync bookmarks across devices"
        canTrial={false}
        onUpgrade={onUpgrade}
      />,
    );

    // #when
    await user.click(screen.getByRole('button', { name: /upgrade to pro/i }));

    // #then
    expect(onUpgrade).toHaveBeenCalledOnce();
  });

  it('shows trial CTA when canTrial is true', async () => {
    // #given
    const onStartTrial = vi.fn();
    const user = userEvent.setup();
    render(
      <UpgradePrompt
        featureName="Tags"
        benefitText="Organize with tags"
        canTrial={true}
        onUpgrade={vi.fn()}
        onStartTrial={onStartTrial}
      />,
    );

    // #then
    const trialButton = screen.getByRole('button', { name: /free trial/i });
    expect(trialButton).toBeInTheDocument();

    // #when
    await user.click(trialButton);

    // #then
    expect(onStartTrial).toHaveBeenCalledOnce();
  });

  it('hides trial button when canTrial is true but onStartTrial is not provided', () => {
    // #given / #when
    render(
      <UpgradePrompt
        featureName="Tags"
        benefitText="Organize with tags"
        canTrial={true}
        onUpgrade={vi.fn()}
      />,
    );

    // #then
    expect(screen.queryByRole('button', { name: /free trial/i })).not.toBeInTheDocument();
  });

  it('has data-testid for targeting', () => {
    // #given / #when
    render(
      <UpgradePrompt
        featureName="Feature"
        benefitText="Benefit"
        canTrial={false}
        onUpgrade={vi.fn()}
      />,
    );

    // #then
    expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument();
  });
});
