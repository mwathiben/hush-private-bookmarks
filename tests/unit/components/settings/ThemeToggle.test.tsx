// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '@/components/settings/ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders three theme buttons (Light, Dark, System)', () => {
    // #given / #when
    render(<ThemeToggle />);

    // #then
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
  });

  it('clicking Dark writes localStorage and adds .dark class', async () => {
    // #given
    const user = userEvent.setup();
    render(<ThemeToggle />);

    // #when
    await user.click(screen.getByRole('button', { name: /dark/i }));

    // #then
    expect(localStorage.getItem('hush-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('clicking System removes localStorage key and defers to matchMedia', async () => {
    // #given
    localStorage.setItem('hush-theme', 'dark');
    document.documentElement.classList.add('dark');
    const user = userEvent.setup();
    render(<ThemeToggle />);

    // #when
    await user.click(screen.getByRole('button', { name: /system/i }));

    // #then
    expect(localStorage.getItem('hush-theme')).toBe('system');
  });
});
