// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportSection } from '@/components/settings/ImportSection';
import type { SendMessageFn } from '@/hooks/useSendMessage';
import type { UseTreeReturn } from '@/hooks/useTree';
import type { BookmarkTree } from '@/lib/types';

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
  id: 'imp-1',
  name: 'Imported',
  children: [
    { type: 'bookmark', id: 'imp-b1', title: 'Imported Bookmark', url: 'http://imported.com', dateAdded: 0 },
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

describe('ImportSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Chrome import', () => {
    it('sends IMPORT_CHROME_BOOKMARKS and shows stats', async () => {
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
      render(<ImportSection />);

      // #when
      await user.click(screen.getByRole('button', { name: /import chrome bookmarks/i }));

      // #then
      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalledWith({ type: 'IMPORT_CHROME_BOOKMARKS' });
      });
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Imported 3 bookmarks, 1 folder');
      });
    });

    it('merges imported folder into current tree via save', async () => {
      // #given
      const { save } = setupMocks({
        sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
          success: true,
          data: {
            tree: IMPORTED_FOLDER,
            stats: { bookmarksImported: 1, foldersImported: 0, errors: [] },
          },
        }),
      });
      const user = userEvent.setup();
      render(<ImportSection />);

      // #when
      await user.click(screen.getByRole('button', { name: /import chrome bookmarks/i }));

      // #then
      await waitFor(() => {
        expect(save).toHaveBeenCalledWith(
          expect.objectContaining({
            children: expect.arrayContaining([
              expect.objectContaining({ id: 'b1' }),
              expect.objectContaining({ id: 'imp-1', name: 'Imported' }),
            ]),
          }),
        );
      });
    });
  });

  describe('HTML import', () => {
    it('reads file and merges parsed bookmarks via save', async () => {
      // #given
      const { save } = setupMocks();
      render(<ImportSection />);

      const htmlContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL>
  <DT><A HREF="http://example.com">Example</A>
</DL>`;
      const file = new File([htmlContent], 'bookmarks.html', { type: 'text/html' });

      // #when — use fireEvent.change (happy-dom issue #940: userEvent.upload fails)
      const input = document.querySelector('input[accept=".html,.htm"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      fireEvent.change(input, { target: { files: [file] } });

      // #then
      await waitFor(() => {
        expect(save).toHaveBeenCalledWith(
          expect.objectContaining({
            children: expect.arrayContaining([
              expect.objectContaining({ id: 'b1' }),
            ]),
          }),
        );
      });
    });
  });

  describe('Backup import', () => {
    it('sends IMPORT_BACKUP with blob and password after file select and password entry', async () => {
      // #given
      const backupTree: BookmarkTree = {
        type: 'folder', id: 'backup-root', name: 'Root',
        children: [{ type: 'bookmark', id: 'bb1', title: 'Backup BM', url: 'http://backup.com', dateAdded: 0 }],
        dateAdded: 0,
      };
      const { sendMessage, save } = setupMocks({
        sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
          success: true,
          data: { tree: backupTree },
        }),
      });
      const user = userEvent.setup();
      render(<ImportSection />);

      // #when — select a .json file
      const backupInput = document.querySelector('input[accept=".json"]') as HTMLInputElement;
      expect(backupInput).not.toBeNull();
      const blobContent = '{"version":1,"store":{}}';
      const file = new File([blobContent], 'backup.json', { type: 'application/json' });
      fireEvent.change(backupInput, { target: { files: [file] } });

      // Wait for password prompt to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Backup password')).toBeInTheDocument();
      });

      // Enter password and submit
      await user.type(screen.getByPlaceholderText('Backup password'), 'mypass');
      await user.click(screen.getByRole('button', { name: /^import$/i }));

      // #then
      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalledWith({
          type: 'IMPORT_BACKUP',
          blob: blobContent,
          password: 'mypass',
        });
      });
      await waitFor(() => {
        expect(save).toHaveBeenCalledWith(backupTree);
      });
    });
  });

  describe('Stats display', () => {
    it('shows import statistics after successful Chrome import', async () => {
      // #given
      setupMocks({
        sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
          success: true,
          data: {
            tree: IMPORTED_FOLDER,
            stats: { bookmarksImported: 5, foldersImported: 2, errors: [] },
          },
        }),
      });
      const user = userEvent.setup();
      render(<ImportSection />);

      // #when
      await user.click(screen.getByRole('button', { name: /import chrome bookmarks/i }));

      // #then
      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent('5 bookmarks');
        expect(status).toHaveTextContent('2 folders');
      });
    });
  });
});
