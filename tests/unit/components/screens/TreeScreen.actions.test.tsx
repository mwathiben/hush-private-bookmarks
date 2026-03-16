// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TreeScreen from '@/components/screens/TreeScreen';
import type { BookmarkTree } from '@/lib/types';

vi.mock('@/hooks/useTree', () => ({
  useTree: vi.fn(),
}));

vi.mock('@/hooks/useSessionProvider', () => ({
  useSessionDispatch: vi.fn(),
}));

import { useTree } from '@/hooks/useTree';
import { useSessionDispatch } from '@/hooks/useSessionProvider';
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
  vi.mocked(useSessionDispatch).mockReturnValue(vi.fn());
}

describe('TreeScreen — context actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('delete action opens ConfirmDialog with node title', async () => {
    // #given
    const user = userEvent.setup();
    setupMock();
    render(<TreeScreen />);

    // #when
    const actionBtns = screen.getAllByLabelText('Actions');
    await user.click(actionBtns[0]!);
    await user.click(screen.getByText('Delete'));

    // #then
    expect(screen.getByText(/Delete "GitHub"/)).toBeInTheDocument();
  });

  it('confirming delete calls save with tree minus item', async () => {
    // #given
    const user = userEvent.setup();
    const saveMock = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockResolvedValue(true);
    setupMock({ save: saveMock });
    render(<TreeScreen />);

    // #when
    const actionBtns = screen.getAllByLabelText('Actions');
    await user.click(actionBtns[0]!);
    await user.click(screen.getByText('Delete'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // #then
    expect(saveMock).toHaveBeenCalledTimes(1);
    const savedTree = saveMock.mock.calls[0]![0];
    expect(savedTree.children).toHaveLength(1);
    expect(savedTree.children[0]).toMatchObject({ type: 'folder', name: 'Work' });
  });

  it('canceling delete closes dialog without saving', async () => {
    // #given
    const user = userEvent.setup();
    const saveMock = vi.fn<(tree: BookmarkTree) => Promise<boolean>>();
    setupMock({ save: saveMock });
    render(<TreeScreen />);

    // #when
    const actionBtns = screen.getAllByLabelText('Actions');
    await user.click(actionBtns[0]!);
    await user.click(screen.getByText('Delete'));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // #then
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('edit bookmark action opens AddEditBookmarkDialog in edit mode', async () => {
    // #given
    const user = userEvent.setup();
    setupMock();
    render(<TreeScreen />);

    // #when
    const actionBtns = screen.getAllByLabelText('Actions');
    await user.click(actionBtns[0]!);
    await user.click(screen.getByText('Edit'));

    // #then
    expect(screen.getByLabelText('Title')).toHaveValue('GitHub');
    expect(screen.getByLabelText('URL')).toHaveValue('https://github.com');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('edit folder action opens AddFolderDialog in edit mode', async () => {
    // #given
    const user = userEvent.setup();
    setupMock();
    render(<TreeScreen />);

    // #when
    const folderActionBtns = screen.getAllByLabelText('Folder actions');
    await user.click(folderActionBtns[0]!);
    await user.click(screen.getByText('Rename'));

    // #then
    expect(screen.getByLabelText('Name')).toHaveValue('Work');
    expect(screen.getByText('Rename Folder')).toBeInTheDocument();
  });

  it('move action opens FolderPicker', async () => {
    // #given
    const user = userEvent.setup();
    setupMock();
    render(<TreeScreen />);

    // #when
    const actionBtns = screen.getAllByLabelText('Actions');
    await user.click(actionBtns[0]!);
    await user.click(screen.getByText('Move to...'));

    // #then
    expect(screen.getByText('Move to folder')).toBeInTheDocument();
  });

  it('selecting folder in FolderPicker saves moved tree', async () => {
    // #given
    const user = userEvent.setup();
    const saveMock = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockResolvedValue(true);
    setupMock({ save: saveMock });
    render(<TreeScreen />);

    // #when
    const actionBtns = screen.getAllByLabelText('Actions');
    await user.click(actionBtns[0]!);
    await user.click(screen.getByText('Move to...'));
    await user.click(screen.getByRole('button', { name: /work/i }));

    // #then
    expect(saveMock).toHaveBeenCalledTimes(1);
    const savedTree = saveMock.mock.calls[0]![0];
    const workFolder = savedTree.children[0]!;
    expect(workFolder).toMatchObject({ type: 'folder', name: 'Work' });
    expect('children' in workFolder && workFolder.children).toHaveLength(2);
  });

  it('Open Manager button calls browser.tabs.create with manager URL', async () => {
    // #given
    setupMock();
    const createSpy = vi.fn().mockResolvedValue({ id: 1 });
    browser.tabs.create = createSpy;
    const user = userEvent.setup();

    // #when
    render(<TreeScreen />);
    await user.click(screen.getByLabelText('Open Manager'));

    // #then
    expect(createSpy).toHaveBeenCalledWith({
      url: browser.runtime.getURL('/manager.html'),
    });
  });
});
