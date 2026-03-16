// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ManagerApp from '@/entrypoints/manager/ManagerApp';
import type { SessionState } from '@/lib/background-types';
import type { BookmarkTree } from '@/lib/types';

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

vi.mock('@/hooks/useTree', () => ({
  useTree: vi.fn(),
}));

vi.mock('@/hooks/useSessionProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useSessionProvider')>();
  return { ...actual, useSessionProvider: vi.fn() };
});

import { useSendMessage } from '@/hooks/useSendMessage';
import { useTree } from '@/hooks/useTree';
import { useSessionProvider, deriveScreen, INITIAL_STATE } from '@/hooks/useSessionProvider';
import type { UseTreeReturn } from '@/hooks/useTree';
import type { SessionProviderReturn, SessionStateValue } from '@/hooks/useSessionProvider';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const MOCK_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  dateAdded: 0,
  children: [
    {
      type: 'folder',
      id: 'f-1',
      name: 'Work',
      dateAdded: 100,
      children: [
        { type: 'bookmark', id: 'bm-1', title: 'GitHub', url: 'https://github.com', dateAdded: 200 },
      ],
    },
    { type: 'bookmark', id: 'bm-2', title: 'Example', url: 'https://example.com', dateAdded: 300 },
  ],
};

const BASE_STATE: SessionState = {
  isUnlocked: false,
  activeSetId: 'default',
  sets: [{ id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true }],
  tree: null,
  incognitoMode: 'normal_mode',
  hasData: true,
};

function makeProviderReturn(
  session: SessionState | null,
  overrides?: Partial<Pick<SessionProviderReturn, 'hookLoading'>>,
): SessionProviderReturn {
  const screen: SessionStateValue['screen'] = session ? deriveScreen(session) : 'login';
  const state: SessionStateValue = {
    screen,
    session,
    loading: !session,
    error: null,
  };
  return {
    state,
    dispatch: vi.fn(),
    treeValue: { tree: session?.tree ?? null, setTree: vi.fn() },
    hookLoading: overrides?.hookLoading ?? false,
  };
}

function setupUnlocked(session?: SessionState): void {
  const s = session ?? { ...BASE_STATE, isUnlocked: true, tree: MOCK_TREE, hasData: true };
  vi.mocked(useSessionProvider).mockReturnValue(makeProviderReturn(s));
  const tree = s.tree;
  if (tree) {
    vi.mocked(useTree).mockReturnValue({
      tree,
      saving: false,
      error: null,
      save: vi.fn().mockResolvedValue(true),
    });
  }
}

describe('ManagerApp', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSendMessage).mockReturnValue(vi.fn());
    vi.mocked(useTree).mockReturnValue({
      tree: null,
      saving: false,
      error: null,
      save: vi.fn().mockResolvedValue(true),
    } satisfies UseTreeReturn);
    vi.mocked(useSessionProvider).mockReturnValue(makeProviderReturn(null));
  });

  it('shows LoginScreen when locked', () => {
    // #given
    vi.mocked(useSessionProvider).mockReturnValue(
      makeProviderReturn({ ...BASE_STATE, hasData: true }),
    );

    // #when
    render(<ManagerApp />);

    // #then
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('shows SetupScreen for first-time user', () => {
    // #given
    vi.mocked(useSessionProvider).mockReturnValue(
      makeProviderReturn({ ...BASE_STATE, hasData: false }),
    );

    // #when
    render(<ManagerApp />);

    // #then
    expect(screen.getByTestId('setup-screen')).toBeInTheDocument();
  });

  it('shows sidebar and main content panel when unlocked', () => {
    // #given
    setupUnlocked();

    // #when
    render(<ManagerApp />);

    // #then
    expect(screen.getByTestId('manager-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('manager-main')).toBeInTheDocument();
  });

  it('shows bookmark titles in main panel when unlocked', () => {
    // #given
    setupUnlocked();

    // #when
    render(<ManagerApp />);

    // #then
    expect(screen.getByText('Example')).toBeInTheDocument();
  });

  it('shows folder names in sidebar', () => {
    // #given
    setupUnlocked();

    // #when
    render(<ManagerApp />);

    // #then
    const sidebar = screen.getByTestId('manager-sidebar');
    expect(within(sidebar).getByText('All Bookmarks')).toBeInTheDocument();
    expect(within(sidebar).getByText('Work')).toBeInTheDocument();
  });

  it('clicking folder in sidebar filters main panel', async () => {
    // #given
    setupUnlocked();
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    const sidebar = screen.getByTestId('manager-sidebar');
    await user.click(within(sidebar).getByText('Work'));

    // #then
    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
  });

  it('shows loading spinner while fetching state', () => {
    // #given
    vi.mocked(useSessionProvider).mockReturnValue({
      ...makeProviderReturn(null),
      hookLoading: true,
      state: { ...INITIAL_STATE, loading: true },
    });

    // #when
    render(<ManagerApp />);

    // #then
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows error state when session fetch fails without session', () => {
    // #given
    vi.mocked(useSessionProvider).mockReturnValue({
      ...makeProviderReturn(null),
      state: { screen: 'login', session: null, loading: false, error: 'Connection failed' },
    });

    // #when
    render(<ManagerApp />);

    // #then
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows + Bookmark and + Folder buttons in toolbar', () => {
    // #given
    setupUnlocked();

    // #when
    render(<ManagerApp />);

    // #then
    const main = screen.getByTestId('manager-main');
    expect(within(main).getByText('+ Bookmark')).toBeInTheDocument();
    expect(within(main).getByText('+ Folder')).toBeInTheDocument();
  });

  it('shows empty state when tree has no children', () => {
    // #given
    const emptyTree: BookmarkTree = {
      type: 'folder', id: 'root', name: 'Root', dateAdded: 0, children: [],
    };
    setupUnlocked({ ...BASE_STATE, isUnlocked: true, tree: emptyTree, hasData: true });

    // #when
    render(<ManagerApp />);

    // #then
    expect(screen.getByTestId('empty-tree-state')).toBeInTheDocument();
  });

  it('lock button sends LOCK', async () => {
    // #given
    const lockedSession = { ...BASE_STATE, isUnlocked: false, hasData: true };
    const mockSend = vi.fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true, data: lockedSession });
    vi.mocked(useSendMessage).mockReturnValue(mockSend);
    setupUnlocked();
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    expect(screen.getByTestId('manager-sidebar')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Lock'));

    // #then
    await waitFor(() => {
      expect(mockSend).toHaveBeenCalledWith({ type: 'LOCK' });
    });
  });

  it('shows settings screen when navigated to settings', () => {
    // #given
    const session = { ...BASE_STATE, isUnlocked: true, tree: MOCK_TREE, hasData: true };
    vi.mocked(useSessionProvider).mockReturnValue({
      ...makeProviderReturn(session),
      state: { screen: 'settings', session, loading: false, error: null },
    });

    // #when
    render(<ManagerApp />);

    // #then
    expect(screen.getByTestId('settings-screen')).toBeInTheDocument();
  });

  it('shows set picker in sidebar when multiple sets exist', () => {
    // #given
    const multiSetSession = {
      ...BASE_STATE,
      isUnlocked: true,
      tree: MOCK_TREE,
      hasData: true,
      sets: [
        { id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true },
        { id: 'work', name: 'Work Set', createdAt: 1, lastAccessedAt: 1, isDefault: false },
      ],
    };
    setupUnlocked(multiSetSession);

    // #when
    render(<ManagerApp />);

    // #then
    const sidebar = screen.getByTestId('manager-sidebar');
    expect(within(sidebar).getByText('Default')).toBeInTheDocument();
  });

  it('All Bookmarks is selected by default in sidebar', () => {
    // #given
    setupUnlocked();

    // #when
    render(<ManagerApp />);

    // #then
    const sidebar = screen.getByTestId('manager-sidebar');
    const allBtn = within(sidebar).getByText('All Bookmarks');
    expect(allBtn.closest('button')).toHaveClass('bg-sidebar-accent');
  });

});
