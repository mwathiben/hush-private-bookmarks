// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from '@/components/ui/accordion';
import { FolderItem } from '@/components/shared/FolderItem';
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
});
