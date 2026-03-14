// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing';
import { BookmarkItem } from '@/components/shared/BookmarkItem';
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
});
