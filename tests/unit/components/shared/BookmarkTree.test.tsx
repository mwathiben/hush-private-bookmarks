// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookmarkTree } from '@/components/shared/BookmarkTree';
import type { BookmarkNode } from '@/lib/types';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const FLAT_NODES: readonly BookmarkNode[] = [
  { type: 'bookmark', id: 'b1', title: 'GitHub', url: 'https://github.com', dateAdded: 0 },
  { type: 'bookmark', id: 'b2', title: 'Google', url: 'https://google.com', dateAdded: 0 },
];

const NESTED_NODES: readonly BookmarkNode[] = [
  { type: 'bookmark', id: 'b1', title: 'Root Bookmark', url: 'https://root.com', dateAdded: 0 },
  {
    type: 'folder',
    id: 'f1',
    name: 'Dev Tools',
    children: [
      { type: 'bookmark', id: 'b2', title: 'VSCode', url: 'https://code.visualstudio.com', dateAdded: 0 },
      {
        type: 'folder',
        id: 'f2',
        name: 'Nested Folder',
        children: [
          { type: 'bookmark', id: 'b3', title: 'Deep Link', url: 'https://deep.com', dateAdded: 0 },
        ],
        dateAdded: 0,
      },
    ],
    dateAdded: 0,
  },
];

describe('BookmarkTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders flat list of bookmarks', () => {
    // #when
    render(<BookmarkTree nodes={FLAT_NODES} />);

    // #then
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('renders folder alongside bookmarks', () => {
    // #when
    render(<BookmarkTree nodes={NESTED_NODES} />);

    // #then
    expect(screen.getByText('Root Bookmark')).toBeInTheDocument();
    expect(screen.getByText('Dev Tools')).toBeInTheDocument();
  });

  it('renders nested children when folder is expanded', async () => {
    // #given
    render(<BookmarkTree nodes={NESTED_NODES} />);
    const user = userEvent.setup();

    // #when
    await user.click(screen.getByText('Dev Tools'));

    // #then
    expect(screen.getByText('VSCode')).toBeInTheDocument();
    expect(screen.getByText('Nested Folder')).toBeInTheDocument();
  });

  it('renders deeply nested bookmarks when all folders expanded', async () => {
    // #given
    render(<BookmarkTree nodes={NESTED_NODES} />);
    const user = userEvent.setup();

    // #when
    await user.click(screen.getByText('Dev Tools'));
    await user.click(screen.getByText('Nested Folder'));

    // #then
    expect(screen.getByText('Deep Link')).toBeInTheDocument();
  });

  it('renders nothing for empty nodes', () => {
    // #when
    const { container } = render(<BookmarkTree nodes={[]} />);

    // #then
    const accordion = container.querySelector('[data-slot="accordion"]');
    expect(accordion).toBeInTheDocument();
    expect(accordion?.children).toHaveLength(0);
  });
});
