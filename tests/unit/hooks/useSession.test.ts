// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { useSession, isSessionState } from '@/hooks/useSession';
import type { SendMessageFn } from '@/hooks/useSendMessage';
import type { BackgroundResponse, SessionState } from '@/lib/background-types';

const LOCKED_STATE: SessionState = {
  isUnlocked: false,
  activeSetId: 'default',
  sets: [{ id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true }],
  tree: null,
  incognitoMode: 'normal_mode',
  hasData: true,
  proStatus: { isPro: false, expiresAt: null, trialDaysLeft: null, canTrial: true },
};

const UNLOCKED_STATE: SessionState = {
  ...LOCKED_STATE,
  isUnlocked: true,
  hasData: true,
  tree: { type: 'folder', id: 'r', name: 'Root', children: [], dateAdded: 0 },
};

function createMockSend(response: BackgroundResponse): SendMessageFn {
  return vi.fn<SendMessageFn>().mockResolvedValue(response);
}

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in loading state', () => {
    // #given
    const send = vi.fn<SendMessageFn>().mockReturnValue(new Promise(() => {}));

    // #when
    const { result } = renderHook(() => useSession(send));

    // #then
    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sends GET_STATE on mount and provides session', async () => {
    // #given
    const send = createMockSend({ success: true, data: LOCKED_STATE });

    // #when
    const { result } = renderHook(() => useSession(send));

    // #then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(send).toHaveBeenCalledWith({ type: 'GET_STATE' });
    expect(result.current.session).toEqual(LOCKED_STATE);
    expect(result.current.error).toBeNull();
  });

  it('provides unlocked session state', async () => {
    // #given
    const send = createMockSend({ success: true, data: UNLOCKED_STATE });

    // #when
    const { result } = renderHook(() => useSession(send));

    // #then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.session).toEqual(UNLOCKED_STATE);
  });

  it('sets error when response indicates failure', async () => {
    // #given
    const send = createMockSend({ success: false, error: 'Storage corrupt' });

    // #when
    const { result } = renderHook(() => useSession(send));

    // #then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('Storage corrupt');
    expect(result.current.session).toBeNull();
  });

  it('sets error when sendMessage throws', async () => {
    // #given
    const send = vi.fn<SendMessageFn>().mockRejectedValue(new Error('Connection failed'));

    // #when
    const { result } = renderHook(() => useSession(send));

    // #then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('Failed to connect to background');
    expect(result.current.session).toBeNull();
  });

  it('does not update state after unmount (AbortController)', async () => {
    // #given
    let resolveMessage: (value: BackgroundResponse) => void;
    const send = vi.fn<SendMessageFn>().mockReturnValue(
      new Promise(resolve => { resolveMessage = resolve; }),
    );

    // #when
    const { result, unmount } = renderHook(() => useSession(send));
    expect(result.current.loading).toBe(true);

    unmount();
    await act(async () => {
      resolveMessage!({ success: true, data: LOCKED_STATE });
    });

    // #then — no state update after unmount (no errors thrown)
    expect(result.current.loading).toBe(true);
  });
});

describe('isSessionState', () => {
  it('accepts valid SessionState with proStatus', () => {
    // #given
    const data = { ...LOCKED_STATE };
    // #then
    expect(isSessionState(data)).toBe(true);
  });

  it('rejects data missing proStatus', () => {
    // #given
    const { proStatus: _, ...withoutProStatus } = LOCKED_STATE;
    // #then
    expect(isSessionState(withoutProStatus)).toBe(false);
  });

  it('rejects data with invalid proStatus shape', () => {
    // #given
    const data = { ...LOCKED_STATE, proStatus: { isPro: 'yes' } };
    // #then
    expect(isSessionState(data)).toBe(false);
  });

  it('rejects data with proStatus missing canTrial', () => {
    // #given
    const data = { ...LOCKED_STATE, proStatus: { isPro: false, expiresAt: null, trialDaysLeft: null } };
    // #then
    expect(isSessionState(data)).toBe(false);
  });
});
