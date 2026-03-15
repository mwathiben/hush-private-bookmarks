// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddFolderDialog } from '@/components/shared/AddFolderDialog';
import type { BookmarkTree } from '@/lib/types';

const TEST_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [],
  dateAdded: 0,
};

describe('AddFolderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders name input with label', () => {
    // #given
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>();
    const onOpenChange = vi.fn();

    // #when
    render(
      <AddFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        parentPath={[]}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #then
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('creates folder at parentPath and calls onSave', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockResolvedValue(true);
    const onOpenChange = vi.fn();

    render(
      <AddFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        parentPath={[]}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Name'), 'Work');
    await user.click(screen.getByRole('button', { name: /add folder/i }));

    // #then
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const savedTree = onSave.mock.calls[0]![0];
    expect(savedTree.children).toHaveLength(1);
    const newFolder = savedTree.children[0]!;
    expect(newFolder).toMatchObject({
      type: 'folder',
      name: 'Work',
      children: [],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('validates empty name — shows error, onSave not called', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>();
    const onOpenChange = vi.fn();

    render(
      <AddFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        parentPath={[]}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.click(screen.getByRole('button', { name: /add folder/i }));

    // #then
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows error and stays open on onSave failure', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockResolvedValue(false);
    const onOpenChange = vi.fn();

    render(
      <AddFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        parentPath={[]}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Name'), 'Work');
    await user.click(screen.getByRole('button', { name: /add folder/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('handles onSave throwing by showing error', async () => {
    // #given
    const user = userEvent.setup();
    const onSave = vi.fn<(tree: BookmarkTree) => Promise<boolean>>().mockRejectedValue(new Error('fail'));
    const onOpenChange = vi.fn();

    render(
      <AddFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        parentPath={[]}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Name'), 'Work');
    await user.click(screen.getByRole('button', { name: /add folder/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('shows loading state during save', async () => {
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
      <AddFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        parentPath={[]}
        tree={TEST_TREE}
        onSave={onSave}
      />,
    );

    // #when
    await user.type(screen.getByLabelText('Name'), 'Work');
    await user.click(screen.getByRole('button', { name: /add folder/i }));

    // #then — loading state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();
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
});
