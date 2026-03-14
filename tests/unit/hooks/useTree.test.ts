// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/entrypoints/popup/App', () => ({
  useSessionState: vi.fn(),
  useTreeContext: vi.fn(),
}));

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

import { useSessionState, useTreeContext } from '@/entrypoints/popup/App';
import { useSendMessage } from '@/hooks/useSendMessage';
import type { SessionState } from '@/lib/background-types';
import type { SendMessageFn } from '@/hooks/useSendMessage';
import type { BookmarkTree } from '@/lib/types';
import { useTree } from '@/hooks/useTree';

const TEST_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [
    { type: 'bookmark', id: 'b1', title: 'Test', url: 'https://example.com', dateAdded: 0 },
  ],
  dateAdded: 0,
};

const BASE_SESSION: SessionState = {
  isUnlocked: true,
  activeSetId: 'default',
  hasData: true,
  sets: [{ id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true }],
  tree: TEST_TREE,
  incognitoMode: 'normal_mode',
};

function setupMocks(overrides?: {
  session?: Partial<SessionState>;
  tree?: BookmarkTree | null;
  sendMessage?: SendMessageFn;
}): { setTree: ReturnType<typeof vi.fn>; sendMessage: SendMessageFn } {
  const session = { ...BASE_SESSION, ...overrides?.session };
  const setTree = vi.fn();
  const tree = overrides?.tree !== undefined ? overrides.tree : null;
  const sendMessage = overrides?.sendMessage ?? vi.fn<SendMessageFn>();

  vi.mocked(useSessionState).mockReturnValue({
    screen: 'tree' as const,
    session,
    loading: false,
    error: null,
  });

  vi.mocked(useTreeContext).mockReturnValue({ tree, setTree });
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);

  return { setTree, sendMessage };
}

describe('useTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs session.tree to TreeContext on first render when tree is null', async () => {
    // #given
    const { setTree } = setupMocks({ tree: null });

    // #when
    renderHook(() => useTree());

    // #then
    await waitFor(() => {
      expect(setTree).toHaveBeenCalledWith(TEST_TREE);
    });
  });

  it('does not overwrite TreeContext when tree is already set', () => {
    // #given
    const { setTree } = setupMocks({ tree: TEST_TREE });

    // #when
    renderHook(() => useTree());

    // #then
    expect(setTree).not.toHaveBeenCalled();
  });

  it('returns tree from TreeContext', () => {
    // #given
    setupMocks({ tree: TEST_TREE });

    // #when
    const { result } = renderHook(() => useTree());

    // #then
    expect(result.current.tree).toBe(TEST_TREE);
  });

  it('returns saving=false and error=null initially', () => {
    // #given
    setupMocks({ tree: TEST_TREE });

    // #when
    const { result } = renderHook(() => useTree());

    // #then
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('save() sends SAVE message and updates TreeContext on success', async () => {
    // #given
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({
      success: true,
    });
    const { setTree } = setupMocks({ tree: TEST_TREE, sendMessage });

    const newTree: BookmarkTree = {
      ...TEST_TREE,
      children: [
        ...TEST_TREE.children,
        { type: 'bookmark', id: 'b2', title: 'New', url: 'https://new.com', dateAdded: 1 },
      ],
    };

    // #when
    const { result } = renderHook(() => useTree());
    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.save(newTree);
    });

    // #then
    expect(sendMessage).toHaveBeenCalledWith({ type: 'SAVE', tree: newTree });
    expect(setTree).toHaveBeenCalledWith(newTree);
    expect(success).toBe(true);
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('save() sets error on failure and does not update TreeContext', async () => {
    // #given
    const sendMessage = vi.fn<SendMessageFn>().mockResolvedValue({
      success: false,
      error: 'Storage full',
      code: 'STORAGE_ERROR',
    });
    const { setTree } = setupMocks({ tree: TEST_TREE, sendMessage });

    // #when
    const { result } = renderHook(() => useTree());
    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.save(TEST_TREE);
    });

    // #then
    expect(success).toBe(false);
    expect(result.current.error).toBe('Storage full');
    expect(setTree).not.toHaveBeenCalled();
  });

  it('save() sets error when sendMessage throws', async () => {
    // #given
    const sendMessage = vi.fn<SendMessageFn>().mockRejectedValue(new Error('Network'));
    const { setTree } = setupMocks({ tree: TEST_TREE, sendMessage });

    // #when
    const { result } = renderHook(() => useTree());
    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.save(TEST_TREE);
    });

    // #then
    expect(success).toBe(false);
    expect(result.current.error).toBe('Failed to save bookmarks');
    expect(setTree).not.toHaveBeenCalled();
  });
});
