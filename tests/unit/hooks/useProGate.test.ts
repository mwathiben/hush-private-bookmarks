// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';

import type { ProStatus } from '@/lib/types';

vi.mock('@/lib/pro-gate', () => ({
  checkProStatus: vi.fn(),
  openPaymentPage: vi.fn(),
  openTrialPage: vi.fn(),
}));

import { checkProStatus, openPaymentPage, openTrialPage } from '@/lib/pro-gate';
import { useProGate } from '@/hooks/useProGate';

const PRO_STATUS: ProStatus = {
  isPro: true,
  expiresAt: null,
  trialDaysLeft: null,
  canTrial: false,
};

const FREE_STATUS: ProStatus = {
  isPro: false,
  expiresAt: null,
  trialDaysLeft: null,
  canTrial: true,
};

describe('useProGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkProStatus).mockResolvedValue(FREE_STATUS);
  });

  afterEach(() => {
    cleanup();
  });

  it('returns loading:true initially', () => {
    // #given
    vi.mocked(checkProStatus).mockReturnValue(new Promise(() => {}));

    // #when
    const { result } = renderHook(() => useProGate());

    // #then
    expect(result.current.loading).toBe(true);
    expect(result.current.isPro).toBe(false);
    expect(result.current.expiresAt).toBeNull();
    expect(result.current.trialDaysLeft).toBeNull();
    expect(result.current.canTrial).toBe(false);
  });

  it('returns ProStatus after check completes', async () => {
    // #given
    vi.mocked(checkProStatus).mockResolvedValue(PRO_STATUS);

    // #when
    const { result } = renderHook(() => useProGate());

    // #then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.isPro).toBe(true);
    expect(result.current.expiresAt).toBeNull();
    expect(result.current.trialDaysLeft).toBeNull();
    expect(result.current.canTrial).toBe(false);
  });

  it('showUpgrade calls openPaymentPage', async () => {
    // #given
    vi.mocked(openPaymentPage).mockResolvedValue(undefined);
    const { result } = renderHook(() => useProGate());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // #when
    await act(async () => {
      await result.current.showUpgrade();
    });

    // #then
    expect(openPaymentPage).toHaveBeenCalledOnce();
  });

  it('startTrial calls openTrialPage', async () => {
    // #given
    vi.mocked(openTrialPage).mockResolvedValue(undefined);
    const { result } = renderHook(() => useProGate());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // #when
    await act(async () => {
      await result.current.startTrial();
    });

    // #then
    expect(openTrialPage).toHaveBeenCalledOnce();
  });

  it('caches result and does not re-fetch on re-render', async () => {
    // #given
    vi.mocked(checkProStatus).mockResolvedValue(PRO_STATUS);
    const { result, rerender } = renderHook(() => useProGate());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // #when
    rerender();

    // #then
    expect(checkProStatus).toHaveBeenCalledOnce();
  });

  it('refreshes on document visibilitychange event', async () => {
    // #given
    vi.mocked(checkProStatus).mockResolvedValue(FREE_STATUS);
    const { result } = renderHook(() => useProGate());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.isPro).toBe(false);
    const callsBefore = vi.mocked(checkProStatus).mock.calls.length;

    // #when
    vi.mocked(checkProStatus).mockResolvedValue(PRO_STATUS);
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // #then
    await waitFor(() => {
      expect(result.current.isPro).toBe(true);
    });
    expect(vi.mocked(checkProStatus).mock.calls.length - callsBefore).toBe(1);
  });

  it('does not refresh when document becomes hidden', async () => {
    // #given
    const { result } = renderHook(() => useProGate());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // #when
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // #then
    expect(checkProStatus).toHaveBeenCalledOnce();
  });

  it('cleans up visibilitychange listener on unmount', async () => {
    // #given
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = renderHook(() => useProGate());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // #when
    unmount();

    // #then
    expect(removeSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    removeSpy.mockRestore();
  });
});
