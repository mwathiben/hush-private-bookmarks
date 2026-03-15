// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing';
import { BookmarkItem } from '@/components/shared/BookmarkItem';
import type { ItemAction } from '@/components/shared/BookmarkTree';
import type { Bookmark } from '@/lib/types';

const TEST_BOOKMARK: Bookmark = {
  type: 'bookmark',
  id: 'b1',
  title: 'Example Site',
  url: 'https://www.example.com/very/long/path/that/should/be/truncated',
  dateAdded: 0,
};

describe('BookmarkItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeBrowser.reset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders bookmark title', () => {
    // #when
    render(<BookmarkItem bookmark={TEST_BOOKMARK} />);

    // #then
    expect(screen.getByText('Example Site')).toBeInTheDocument();
  });

  it('renders bookmark URL', () => {
    // #when
    render(<BookmarkItem bookmark={TEST_BOOKMARK} />);

    // #then
    expect(screen.getByText(TEST_BOOKMARK.url)).toBeInTheDocument();
  });

  it('opens URL in new tab on click', async () => {
    // #given
    const createSpy = vi.fn();
    fakeBrowser.tabs.create = createSpy;
    render(<BookmarkItem bookmark={TEST_BOOKMARK} />);
    const user = userEvent.setup();

    // #when
    await user.click(screen.getByRole('button'));

    // #then
    expect(createSpy).toHaveBeenCalledWith({
      url: TEST_BOOKMARK.url,
    });
  });

  it('has accessible button label', () => {
    // #when
    render(<BookmarkItem bookmark={TEST_BOOKMARK} />);

    // #then
    expect(screen.getByRole('button', { name: /example site/i })).toBeInTheDocument();
  });

  it('renders context menu trigger when onAction provided', () => {
    // #given
    const onAction = vi.fn<(action: ItemAction) => void>();

    // #when
    render(<BookmarkItem bookmark={TEST_BOOKMARK} path={[0]} onAction={onAction} />);

    // #then
    expect(screen.getByLabelText('Actions')).toBeInTheDocument();
  });

  it('does not render trigger when onAction absent', () => {
    // #when
    render(<BookmarkItem bookmark={TEST_BOOKMARK} />);

    // #then
    expect(screen.queryByLabelText('Actions')).not.toBeInTheDocument();
  });

  it('Edit calls onAction with edit-bookmark', async () => {
    // #given
    const user = userEvent.setup();
    const onAction = vi.fn<(action: ItemAction) => void>();
    render(<BookmarkItem bookmark={TEST_BOOKMARK} path={[2]} onAction={onAction} />);

    // #when
    await user.click(screen.getByLabelText('Actions'));
    await user.click(screen.getByText('Edit'));

    // #then
    expect(onAction).toHaveBeenCalledWith({
      type: 'edit-bookmark',
      path: [2],
      bookmark: TEST_BOOKMARK,
    });
  });

  it('Delete calls onAction with delete', async () => {
    // #given
    const user = userEvent.setup();
    const onAction = vi.fn<(action: ItemAction) => void>();
    render(<BookmarkItem bookmark={TEST_BOOKMARK} path={[0]} onAction={onAction} />);

    // #when
    await user.click(screen.getByLabelText('Actions'));
    await user.click(screen.getByText('Delete'));

    // #then
    expect(onAction).toHaveBeenCalledWith({
      type: 'delete',
      path: [0],
      node: TEST_BOOKMARK,
    });
  });

  it('Move calls onAction with move', async () => {
    // #given
    const user = userEvent.setup();
    const onAction = vi.fn<(action: ItemAction) => void>();
    render(<BookmarkItem bookmark={TEST_BOOKMARK} path={[1]} onAction={onAction} />);

    // #when
    await user.click(screen.getByLabelText('Actions'));
    await user.click(screen.getByText('Move to...'));

    // #then
    expect(onAction).toHaveBeenCalledWith({
      type: 'move',
      path: [1],
      node: TEST_BOOKMARK,
    });
  });
});
