// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddEditBookmarkDialog } from '@/components/shared/AddEditBookmarkDialog';
import type { BookmarkTree, Bookmark } from '@/lib/types';

const TEST_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [
    { type: 'bookmark', id: 'b1', title: 'GitHub', url: 'https://github.com', dateAdded: 0 },
  ],
  dateAdded: 0,
};

const TEST_BOOKMARK: Bookmark = {
  type: 'bookmark',
  id: 'b1',
  title: 'GitHub',
  url: 'https://github.com',
  dateAdded: 0,
};

describe('AddEditBookmarkDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders title and URL inputs with labels', () => {
    // #given
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>();
    const onOpenChange = vi.fn();

    // #when
    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'add', parentPath: [] }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #then
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toBeInTheDocument();
  });

  it('add mode sends SAVE with updated tree containing new bookmark', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockResolvedValue(true);
    const onOpenChange = vi.fn();

    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'add', parentPath: [] }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Title'), 'New Site');
    await user.type(screen.getByLabelText('URL'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: /add bookmark/i }));

    // #then
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const savedTree = onSave.mock.calls[0]![0];
    expect(savedTree.children).toHaveLength(2);
    const newBookmark = savedTree.children[1]!;
    expect(newBookmark).toMatchObject({
      type: 'bookmark',
      title: 'New Site',
      url: 'https://example.com',
    });
  });

  it('edit mode pre-fills existing bookmark title and URL', () => {
    // #given
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>();
    const onOpenChange = vi.fn();

    // #when
    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'edit', path: [0], bookmark: TEST_BOOKMARK }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #then
    expect(screen.getByLabelText('Title')).toHaveValue('GitHub');
    expect(screen.getByLabelText('URL')).toHaveValue('https://github.com');
  });

  it('validates URL format — invalid URL shows error, onSave not called', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>();
    const onOpenChange = vi.fn();

    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'add', parentPath: [] }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Title'), 'Bad URL Site');
    await user.type(screen.getByLabelText('URL'), 'not-a-valid-url');
    await user.click(screen.getByRole('button', { name: /add bookmark/i }));

    // #then
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows loading state during SAVE and closes on success', async () => {
    // #given
    const user = userEvent.setup();
    let resolveSave!: (value: boolean) => void;
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const onOpenChange = vi.fn();

    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'add', parentPath: [] }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Title'), 'Test');
    await user.type(screen.getByLabelText('URL'), 'https://test.com');
    await user.click(screen.getByRole('button', { name: /add bookmark/i }));

    // #then — loading state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });

    // #when — save succeeds
    await act(async () => {
      resolveSave(true);
    });

    // #then — dialog closes
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows error and stays open on SAVE failure', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockResolvedValue(false);
    const onOpenChange = vi.fn();

    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'add', parentPath: [] }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Title'), 'Test');
    await user.type(screen.getByLabelText('URL'), 'https://test.com');
    await user.click(screen.getByRole('button', { name: /add bookmark/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('validates empty title — shows error, onSave not called', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>();
    const onOpenChange = vi.fn();

    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'add', parentPath: [] }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('URL'), 'https://example.com');
    await user.click(screen.getByRole('button', { name: /add bookmark/i }));

    // #then
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('edit mode submits updated bookmark via updateBookmark', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockResolvedValue(true);
    const onOpenChange = vi.fn();

    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'edit', path: [0], bookmark: TEST_BOOKMARK }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated GitHub');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    // #then
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const savedTree = onSave.mock.calls[0]![0];
    const updated = savedTree.children[0]!;
    expect(updated).toMatchObject({
      type: 'bookmark',
      title: 'Updated GitHub',
      url: 'https://github.com',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('handles onSave throwing by showing error', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockRejectedValue(new Error('Network error'));
    const onOpenChange = vi.fn();

    render(
      <AddEditBookmarkDialog
        open={true}
        onOpenChange={onOpenChange}
        dialogMode={{ mode: 'add', parentPath: [] }}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Title'), 'Test');
    await user.type(screen.getByLabelText('URL'), 'https://test.com');
    await user.click(screen.getByRole('button', { name: /add bookmark/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
