// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HushImportSection } from '@/components/settings/HushImportSection';
import type { SendMessageFn } from '@/hooks/useSendMessage';
import type { UseTreeReturn } from '@/hooks/useTree';
import type { BookmarkTree } from '@/lib/types';
import type { BackgroundResponse } from '@/lib/background-types';

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

vi.mock('@/hooks/useTree', () => ({
  useTree: vi.fn(),
}));

vi.mock('@/entrypoints/popup/App', () => ({
  useSessionState: vi.fn(),
  useSessionDispatch: vi.fn(),
  useTreeContext: vi.fn(),
}));

import { useSendMessage } from '@/hooks/useSendMessage';
import { useTree } from '@/hooks/useTree';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const ROOT_TREE: BookmarkTree = {
  type: 'folder',
  id: 'root',
  name: 'Root',
  children: [
    { type: 'bookmark', id: 'b1', title: 'Existing', url: 'http://existing.com', dateAdded: 0 },
  ],
  dateAdded: 0,
};

const IMPORTED_FOLDER: BookmarkTree = {
  type: 'folder',
  id: 'hush-1',
  name: 'Hush Import',
  children: [
    { type: 'bookmark', id: 'hb1', title: 'Hush Bookmark', url: 'http://hush.com', dateAdded: 0 },
    { type: 'bookmark', id: 'hb2', title: 'Hush Bookmark 2', url: 'http://hush2.com', dateAdded: 0 },
    { type: 'bookmark', id: 'hb3', title: 'Hush Bookmark 3', url: 'http://hush3.com', dateAdded: 0 },
  ],
  dateAdded: 0,
};

function setupMocks(overrides?: {
  sendMessage?: SendMessageFn;
  tree?: BookmarkTree | null;
  save?: UseTreeReturn['save'];
}): { sendMessage: SendMessageFn; save: UseTreeReturn['save'] } {
  const sendMessage = overrides?.sendMessage ?? vi.fn<SendMessageFn>();
  const save = overrides?.save ?? vi.fn<UseTreeReturn['save']>().mockResolvedValue(true);
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);
  vi.mocked(useTree).mockReturnValue({
    tree: overrides?.tree !== undefined ? overrides.tree : ROOT_TREE,
    saving: false,
    error: null,
    save,
  });
  return { sendMessage, save };
}

describe('HushImportSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders textarea, password input, and import button', () => {
    // #given
    setupMocks();

    // #when
    render(<HushImportSection />);

    // #then
    expect(screen.getByPlaceholderText('Paste encrypted data from Hush extension...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Hush Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import from hush/i })).toBeInTheDocument();
  });

  it('import button disabled when textarea empty', () => {
    // #given
    setupMocks();

    // #when
    render(<HushImportSection />);

    // #then
    expect(screen.getByRole('button', { name: /import from hush/i })).toBeDisabled();
  });

  it('import button disabled when password empty', async () => {
    // #given
    setupMocks();
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), 'some blob');

    // #then
    expect(screen.getByRole('button', { name: /import from hush/i })).toBeDisabled();
  });

  it('import button enabled when both fields filled', async () => {
    // #given
    setupMocks();
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), 'some blob');
    await user.type(screen.getByPlaceholderText('Hush Password'), 'pw123');

    // #then
    expect(screen.getByRole('button', { name: /import from hush/i })).toBeEnabled();
  });

  it('sends IMPORT_HUSH with blob and password on submit', async () => {
    // #given
    const { sendMessage } = setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
        success: true,
        data: {
          tree: IMPORTED_FOLDER,
          stats: { bookmarksImported: 3, foldersImported: 1, errors: [] },
        },
      }),
    });
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), '  blob data  ');
    await user.type(screen.getByPlaceholderText('Hush Password'), 'secret');
    await user.click(screen.getByRole('button', { name: /import from hush/i }));

    // #then
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'IMPORT_HUSH',
        blob: 'blob data',
        password: 'secret',
      });
    });
  });

  it('shows "Importing..." loading state during import', async () => {
    // #given
    let resolveMessage!: (value: BackgroundResponse) => void;
    const sendMessage = vi.fn<SendMessageFn>().mockReturnValue(
      new Promise((resolve) => { resolveMessage = resolve; }),
    );
    setupMocks({ sendMessage });
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), 'blob');
    await user.type(screen.getByPlaceholderText('Hush Password'), 'pw');
    await user.click(screen.getByRole('button', { name: /import from hush/i }));

    // #then
    expect(screen.getByRole('button', { name: /importing/i })).toBeDisabled();

    resolveMessage({
      success: true,
      data: {
        tree: IMPORTED_FOLDER,
        stats: { bookmarksImported: 3, foldersImported: 1, errors: [] },
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /import from hush/i })).toBeInTheDocument();
    });
  });

  it('displays stats on success', async () => {
    // #given
    setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
        success: true,
        data: {
          tree: IMPORTED_FOLDER,
          stats: { bookmarksImported: 3, foldersImported: 1, errors: [] },
        },
      }),
    });
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), 'blob');
    await user.type(screen.getByPlaceholderText('Hush Password'), 'pw');
    await user.click(screen.getByRole('button', { name: /import from hush/i }));

    // #then
    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Imported 3 bookmarks, 1 folder');
    });
  });

  it('clears password on success, keeps textarea', async () => {
    // #given
    setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
        success: true,
        data: {
          tree: IMPORTED_FOLDER,
          stats: { bookmarksImported: 3, foldersImported: 1, errors: [] },
        },
      }),
    });
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), 'blob data');
    await user.type(screen.getByPlaceholderText('Hush Password'), 'secret');
    await user.click(screen.getByRole('button', { name: /import from hush/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Hush Password')).toHaveValue('');
    expect(screen.getByPlaceholderText('Paste encrypted data from Hush extension...')).toHaveValue('blob data');
  });

  it('merges imported folder into current tree via save', async () => {
    // #given
    const { save } = setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
        success: true,
        data: {
          tree: IMPORTED_FOLDER,
          stats: { bookmarksImported: 3, foldersImported: 1, errors: [] },
        },
      }),
    });
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), 'blob');
    await user.type(screen.getByPlaceholderText('Hush Password'), 'pw');
    await user.click(screen.getByRole('button', { name: /import from hush/i }));

    // #then
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          children: expect.arrayContaining([
            expect.objectContaining({ id: 'b1' }),
            expect.objectContaining({ id: 'hush-1', name: 'Hush Import' }),
          ]),
        }),
      );
    });
  });

  it('displays error message on failure', async () => {
    // #given
    setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
        success: false,
        error: 'Invalid password',
        code: 'INVALID_PASSWORD',
      }),
    });
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), 'blob');
    await user.type(screen.getByPlaceholderText('Hush Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /import from hush/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid password');
    });
  });

  it('does NOT clear inputs on failure (retry scenario)', async () => {
    // #given
    setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
        success: false,
        error: 'Invalid password',
        code: 'INVALID_PASSWORD',
      }),
    });
    const user = userEvent.setup();
    render(<HushImportSection />);

    // #when
    await user.type(screen.getByPlaceholderText('Paste encrypted data from Hush extension...'), 'my blob');
    await user.type(screen.getByPlaceholderText('Hush Password'), 'wrong-pw');
    await user.click(screen.getByRole('button', { name: /import from hush/i }));

    // #then
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Paste encrypted data from Hush extension...')).toHaveValue('my blob');
    expect(screen.getByPlaceholderText('Hush Password')).toHaveValue('wrong-pw');
  });
});
