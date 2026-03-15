// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '@/components/ErrorBoundary';

vi.mock('@/lib/sentry', () => ({
  captureException: vi.fn(),
}));

import { captureException } from '@/lib/sentry';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }): React.JSX.Element {
  if (shouldThrow) throw new Error('Test error');
  return <div>Content rendered</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    // #given / #when
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    // #then
    expect(screen.getByText('Content rendered')).toBeInTheDocument();
  });

  it('shows default error UI when child throws', () => {
    // #given / #when
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    // #then
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/Your bookmarks are safe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report bug/i })).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    // #given / #when
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    // #then
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('calls captureException on error', () => {
    // #given / #when
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    // #then
    expect(captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('recovers when Try Again is clicked', async () => {
    // #given
    const user = userEvent.setup();
    let shouldThrow = true;

    function Conditional(): React.JSX.Element {
      if (shouldThrow) throw new Error('boom');
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Conditional />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // #when
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));
    rerender(
      <ErrorBoundary>
        <Conditional />
      </ErrorBoundary>,
    );

    // #then
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('Report Bug button opens window', async () => {
    // #given
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    // #when
    await user.click(screen.getByRole('button', { name: /report bug/i }));

    // #then
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('github.com'),
      '_blank',
      'noopener',
    );
  });
});
