// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders title and description when open', () => {
    // #given
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    // #when
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete bookmark?"
        description="This action cannot be undone."
        onConfirm={onConfirm}
      />,
    );

    // #then
    expect(screen.getByText('Delete bookmark?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('confirm button calls onConfirm', async () => {
    // #given
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Gone forever."
        onConfirm={onConfirm}
      />,
    );

    // #when
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    // #then
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel button closes without calling onConfirm', async () => {
    // #given
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Gone forever."
        onConfirm={onConfirm}
      />,
    );

    // #when
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // #then
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('destructive variant applies destructive styling to confirm button', () => {
    // #given
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    // #when
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Gone forever."
        onConfirm={onConfirm}
        variant="destructive"
        confirmLabel="Delete"
      />,
    );

    // #then
    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    expect(confirmBtn.className).toMatch(/destructive/);
  });
});
