// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from '@/components/ui/accordion';
import { FolderItem } from '@/components/shared/FolderItem';
import type { ItemAction } from '@/components/shared/BookmarkTree';
import type { Folder } from '@/lib/types';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const TEST_FOLDER: Folder = {
  type: 'folder',
  id: 'f1',
  name: 'Work Bookmarks',
  children: [
    { type: 'bookmark', id: 'b1', title: 'GitHub', url: 'https://github.com', dateAdded: 0 },
    { type: 'bookmark', id: 'b2', title: 'Docs', url: 'https://docs.example.com', dateAdded: 0 },
  ],
  dateAdded: 0,
};

const EMPTY_FOLDER: Folder = {
  type: 'folder',
  id: 'f2',
  name: 'Empty Folder',
  children: [],
  dateAdded: 0,
};

function renderInAccordion(folder: Folder, depth = 0): void {
  render(
    <Accordion type="multiple">
      <FolderItem folder={folder} depth={depth} />
    </Accordion>,
  );
}

describe('FolderItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders folder name', () => {
    // #when
    renderInAccordion(TEST_FOLDER);

    // #then
    expect(screen.getByText('Work Bookmarks')).toBeInTheDocument();
  });

  it('shows child count badge', () => {
    // #when
    renderInAccordion(TEST_FOLDER);

    // #then
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows 0 count for empty folder', () => {
    // #when
    renderInAccordion(EMPTY_FOLDER);

    // #then
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('expands to show children on click', async () => {
    // #given
    renderInAccordion(TEST_FOLDER);
    const user = userEvent.setup();

    // #when
    await user.click(screen.getByText('Work Bookmarks'));

    // #then
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
  });

  it('renders context menu trigger when onAction provided', () => {
    // #given
    const onAction = vi.fn<(action: ItemAction) => void>();

    // #when
    render(
      <Accordion type="multiple">
        <FolderItem folder={TEST_FOLDER} depth={0} path={[1]} onAction={onAction} />
      </Accordion>,
    );

    // #then
    expect(screen.getByLabelText('Folder actions')).toBeInTheDocument();
  });

  it('Rename calls onAction with edit-folder', async () => {
    // #given
    const user = userEvent.setup();
    const onAction = vi.fn<(action: ItemAction) => void>();

    render(
      <Accordion type="multiple">
        <FolderItem folder={TEST_FOLDER} depth={0} path={[1]} onAction={onAction} />
      </Accordion>,
    );

    // #when
    await user.click(screen.getByLabelText('Folder actions'));
    await user.click(screen.getByText('Rename'));

    // #then
    expect(onAction).toHaveBeenCalledWith({
      type: 'edit-folder',
      path: [1],
      folder: TEST_FOLDER,
    });
  });

  it('Delete calls onAction with delete (destructive)', async () => {
    // #given
    const user = userEvent.setup();
    const onAction = vi.fn<(action: ItemAction) => void>();

    render(
      <Accordion type="multiple">
        <FolderItem folder={TEST_FOLDER} depth={0} path={[0]} onAction={onAction} />
      </Accordion>,
    );

    // #when
    await user.click(screen.getByLabelText('Folder actions'));
    await user.click(screen.getByText('Delete'));

    // #then
    expect(onAction).toHaveBeenCalledWith({
      type: 'delete',
      path: [0],
      node: TEST_FOLDER,
    });
  });

  it('Move calls onAction with move', async () => {
    // #given
    const user = userEvent.setup();
    const onAction = vi.fn<(action: ItemAction) => void>();

    render(
      <Accordion type="multiple">
        <FolderItem folder={TEST_FOLDER} depth={0} path={[0]} onAction={onAction} />
      </Accordion>,
    );

    // #when
    await user.click(screen.getByLabelText('Folder actions'));
    await user.click(screen.getByText('Move to...'));

    // #then
    expect(onAction).toHaveBeenCalledWith({
      type: 'move',
      path: [0],
      node: TEST_FOLDER,
    });
  });
});
