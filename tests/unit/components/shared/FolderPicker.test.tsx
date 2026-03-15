// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderPicker, collectPickableFolders } from '@/components/shared/FolderPicker';
import type { BookmarkTree } from '@/lib/types';

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
        { type: 'bookmark', id: 'b2', title: 'Slack', url: 'https://slack.com', dateAdded: 0 },
        {
          type: 'folder',
          id: 'f2',
          name: 'Projects',
          children: [],
          dateAdded: 0,
        },
      ],
      dateAdded: 0,
    },
  ],
  dateAdded: 0,
};

describe('collectPickableFolders', () => {
  it('returns root and nested folders with correct paths and depths', () => {
    // #given / #when
    const folders = collectPickableFolders(TEST_TREE, [999]);

    // #then
    expect(folders).toEqual([
      { name: 'Root', path: [], depth: 0, childrenCount: 2 },
      { name: 'Work', path: [1], depth: 1, childrenCount: 2 },
      { name: 'Projects', path: [1, 1], depth: 2, childrenCount: 0 },
    ]);
  });

  it('excludes folder at excludePath and its descendants', () => {
    // #given / #when
    const folders = collectPickableFolders(TEST_TREE, [1]);

    // #then
    expect(folders).toEqual([
      { name: 'Root', path: [], depth: 0, childrenCount: 2 },
    ]);
  });
});

describe('FolderPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows root and nested folders', () => {
    // #given
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    // #when
    render(
      <FolderPicker
        open={true}
        onOpenChange={onOpenChange}
        tree={TEST_TREE}
        excludePath={[999]}
        onSelect={onSelect}
      />,
    );

    // #then
    expect(screen.getByRole('button', { name: /root/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /work/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /projects/i })).toBeInTheDocument();
  });

  it('clicking folder calls onSelect with correct path and childrenCount', async () => {
    // #given
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <FolderPicker
        open={true}
        onOpenChange={onOpenChange}
        tree={TEST_TREE}
        excludePath={[999]}
        onSelect={onSelect}
      />,
    );

    // #when
    await user.click(screen.getByRole('button', { name: /work/i }));

    // #then
    expect(onSelect).toHaveBeenCalledWith([1], 2);
  });

  it('cancel closes without selection', async () => {
    // #given
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <FolderPicker
        open={true}
        onOpenChange={onOpenChange}
        tree={TEST_TREE}
        excludePath={[999]}
        onSelect={onSelect}
      />,
    );

    // #when
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // #then
    expect(onSelect).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
