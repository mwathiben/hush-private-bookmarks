// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TreeScreen from '@/components/screens/TreeScreen';
import type { BookmarkTree } from '@/lib/types';

vi.mock('@/hooks/useTree', () => ({
  useTree: vi.fn(),
}));

import { useTree } from '@/hooks/useTree';
import type { UseTreeReturn } from '@/hooks/useTree';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const TEST_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [
    { type: 'bookmark', id: 'b1', title: 'GitHub', url: 'https://github.com', dateAdded: 0 },
    {
      type: 'folder',
      id: 'f1',
      name: 'Work',
      children: [
        { type: 'bookmark', id: 'b2', title: 'Jira', url: 'https://jira.example.com', dateAdded: 0 },
      ],
      dateAdded: 0,
    },
  ],
  dateAdded: 0,
};

function setupMock(overrides?: Partial<UseTreeReturn>): void {
  const defaults: UseTreeReturn = {
    tree: TEST_TREE,
    saving: false,
    error: null,
    save: vi.fn(),
    ...overrides,
  };
  vi.mocked(useTree).mockReturnValue(defaults);
}

describe('TreeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with data-testid tree-screen', () => {
    // #given
    setupMock();

    // #when
    render(<TreeScreen />);

    // #then
    expect(screen.getByTestId('tree-screen')).toBeInTheDocument();
  });

  it('renders toolbar with heading', () => {
    // #given
    setupMock();

    // #when
    render(<TreeScreen />);

    // #then
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
  });

  it('renders bookmark tree when tree has children', () => {
    // #given
    setupMock();

    // #when
    render(<TreeScreen />);

    // #then
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('shows empty state when tree has no children', () => {
    // #given
    const emptyTree: BookmarkTree = {
      type: 'folder',
      id: 'root',
      name: 'Root',
      children: [],
      dateAdded: 0,
    };
    setupMock({ tree: emptyTree });

    // #when
    render(<TreeScreen />);

    // #then
    expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
  });

  it('shows empty state when tree is null', () => {
    // #given
    setupMock({ tree: null });

    // #when
    render(<TreeScreen />);

    // #then
    expect(screen.getByText('No bookmarks yet')).toBeInTheDocument();
  });

  it('renders disabled add buttons in toolbar', () => {
    // #given
    setupMock();

    // #when
    render(<TreeScreen />);

    // #then
    const addBookmarkBtn = screen.getByRole('button', { name: /add bookmark/i });
    const addFolderBtn = screen.getByRole('button', { name: /add folder/i });
    expect(addBookmarkBtn).toBeDisabled();
    expect(addFolderBtn).toBeDisabled();
  });

  it('shows error message when useTree has error', () => {
    // #given
    setupMock({ error: 'Failed to save' });

    // #when
    render(<TreeScreen />);

    // #then
    expect(screen.getByText('Failed to save')).toBeInTheDocument();
  });
});
