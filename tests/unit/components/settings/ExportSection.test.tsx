// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportSection } from '@/components/settings/ExportSection';
import type { SendMessageFn } from '@/hooks/useSendMessage';
import type { SessionState } from '@/lib/background-types';

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

vi.mock('@/hooks/useSessionProvider', () => ({
  useSessionState: vi.fn(),
  useSessionDispatch: vi.fn(),
  useTreeContext: vi.fn(),
}));

import { useSendMessage } from '@/hooks/useSendMessage';
import { useSessionState } from '@/hooks/useSessionProvider';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const MOCK_SESSION: SessionState = {
  isUnlocked: true,
  activeSetId: 'default',
  sets: [{ id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true }],
  tree: { type: 'folder', id: 'root', name: 'Root', children: [], dateAdded: 0 },
  incognitoMode: 'normal_mode',
  hasData: true,
};

function setupMocks(overrides?: {
  sendMessage?: SendMessageFn;
  session?: SessionState | null;
}): { sendMessage: SendMessageFn } {
  const sendMessage = overrides?.sendMessage ?? vi.fn<SendMessageFn>();
  vi.mocked(useSendMessage).mockReturnValue(sendMessage);
  vi.mocked(useSessionState).mockReturnValue({
    screen: 'settings',
    session: overrides?.session !== undefined ? overrides.session : MOCK_SESSION,
    loading: false,
    error: null,
  });
  return { sendMessage };
}

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();

describe('ExportSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends EXPORT_BACKUP and triggers file download', async () => {
    // #given
    const { sendMessage } = setupMocks({
      sendMessage: vi.fn<SendMessageFn>().mockResolvedValue({
        success: true,
        data: { blob: '{"version":1,"store":{}}' },
      }),
    });
    const user = userEvent.setup();
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        // Minimal stub — happy-dom lacks full HTMLAnchorElement constructor
        const anchor = { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
        return anchor;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    });
    render(<ExportSection />);

    // #when
    await user.click(screen.getByRole('button', { name: /export backup/i }));

    // #then
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'EXPORT_BACKUP' });
    });
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  it('disables export button when session is locked', () => {
    // #given
    setupMocks({
      session: { ...MOCK_SESSION, isUnlocked: false },
    });

    // #when
    render(<ExportSection />);

    // #then
    expect(screen.getByRole('button', { name: /export backup/i })).toBeDisabled();
    expect(screen.getByText(/unlock to export/i)).toBeInTheDocument();
  });
});
