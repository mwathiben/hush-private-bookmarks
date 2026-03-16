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
import { useSessionProvider, deriveScreen } from '@/hooks/useSessionProvider';
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

describe('ManagerApp — dialogs and actions', () => {
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

  it('+ Bookmark button opens add bookmark dialog', async () => {
    // #given
    setupUnlocked();
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    const main = screen.getByTestId('manager-main');
    await user.click(within(main).getByText('+ Bookmark'));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('+ Folder button opens add folder dialog', async () => {
    // #given
    setupUnlocked();
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    const main = screen.getByTestId('manager-main');
    await user.click(within(main).getByText('+ Folder'));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('bookmark actions menu opens edit dialog', async () => {
    // #given
    setupUnlocked();
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    expect(screen.getByText('Example')).toBeInTheDocument();
    const actionsButtons = screen.getAllByLabelText('Actions');
    await user.click(actionsButtons[0]!);
    await user.click(screen.getByText('Edit'));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('bookmark actions menu opens delete confirmation', async () => {
    // #given
    setupUnlocked();
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    expect(screen.getByText('Example')).toBeInTheDocument();
    const actionsButtons = screen.getAllByLabelText('Actions');
    await user.click(actionsButtons[0]!);
    await user.click(screen.getByText('Delete'));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Delete "Example"/)).toBeInTheDocument();
    });
  });

  it('confirming delete calls save with updated tree', async () => {
    // #given
    const mockSave = vi.fn().mockResolvedValue(true);
    setupUnlocked();
    vi.mocked(useTree).mockReturnValue({
      tree: MOCK_TREE,
      saving: false,
      error: null,
      save: mockSave,
    });
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    expect(screen.getByText('Example')).toBeInTheDocument();
    const actionsButtons = screen.getAllByLabelText('Actions');
    await user.click(actionsButtons[0]!);
    await user.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /delete/i }));

    // #then
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
    });
  });

  it('bookmark actions menu opens move dialog', async () => {
    // #given
    setupUnlocked();
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    expect(screen.getByText('Example')).toBeInTheDocument();
    const actionsButtons = screen.getAllByLabelText('Actions');
    await user.click(actionsButtons[0]!);
    await user.click(screen.getByText('Move to...'));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('settings button in sidebar dispatches navigate to settings', async () => {
    // #given
    const session = { ...BASE_STATE, isUnlocked: true, tree: MOCK_TREE, hasData: true };
    const mockDispatch = vi.fn();
    vi.mocked(useSessionProvider).mockReturnValue({
      ...makeProviderReturn(session),
      dispatch: mockDispatch,
    });
    vi.mocked(useTree).mockReturnValue({
      tree: MOCK_TREE,
      saving: false,
      error: null,
      save: vi.fn().mockResolvedValue(true),
    });
    const user = userEvent.setup();

    // #when
    render(<ManagerApp />);
    const sidebar = screen.getByTestId('manager-sidebar');
    await user.click(within(sidebar).getByLabelText('Settings'));

    // #then
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', to: 'settings' });
  });
});
