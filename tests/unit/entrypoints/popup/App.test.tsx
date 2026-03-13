// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import App, {
  TRANSITIONS,
  useSessionState,
  useSessionDispatch,
  useTreeContext,
} from '@/entrypoints/popup/App';
import type { SessionState } from '@/lib/background-types';

vi.mock('@/hooks/useSendMessage', () => ({
  useSendMessage: vi.fn(),
}));

vi.mock('@/hooks/useSession', () => ({
  useSession: vi.fn(),
}));

import { useSendMessage } from '@/hooks/useSendMessage';
import { useSession } from '@/hooks/useSession';
import type { UseSessionResult } from '@/hooks/useSession';

const BASE_STATE: SessionState = {
  isUnlocked: false,
  activeSetId: 'default',
  sets: [{ id: 'default', name: 'Default', createdAt: 0, lastAccessedAt: 0, isDefault: true }],
  tree: null,
  incognitoMode: 'normal_mode',
  hasData: true,
};

function mockUseSession(partial: Partial<UseSessionResult>): void {
  const defaults: UseSessionResult = { loading: false, error: null, session: null };
  vi.mocked(useSession).mockReturnValue({ ...defaults, ...partial });
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSendMessage).mockReturnValue(vi.fn());
  });

  it('shows loading spinner while fetching state', () => {
    // #given
    mockUseSession({ loading: true });

    // #when
    render(<App />);

    // #then
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows LoginScreen when session is locked with hasData=true', async () => {
    // #given
    mockUseSession({ session: { ...BASE_STATE, hasData: true } });

    // #when
    render(<App />);

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    });
  });

  it('shows SetupScreen when hasData=false (first-time user)', async () => {
    // #given
    mockUseSession({ session: { ...BASE_STATE, hasData: false } });

    // #when
    render(<App />);

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('setup-screen')).toBeInTheDocument();
    });
  });

  it('shows TreeScreen when session is unlocked', async () => {
    // #given
    const tree = { type: 'folder' as const, id: 'r', name: 'Root', children: [], dateAdded: 0 };
    mockUseSession({
      session: { ...BASE_STATE, isUnlocked: true, tree, hasData: true },
    });

    // #when
    render(<App />);

    // #then
    await waitFor(() => {
      expect(screen.getByTestId('tree-screen')).toBeInTheDocument();
    });
  });

  it('shows error message when session fetch fails', async () => {
    // #given
    mockUseSession({ error: 'Connection failed' });

    // #when
    render(<App />);

    // #then
    await waitFor(() => {
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    });
  });
});

describe('TRANSITIONS map', () => {
  it('login can transition to tree and setup', () => {
    expect(TRANSITIONS.login).toContain('tree');
    expect(TRANSITIONS.login).toContain('setup');
  });

  it('setup can transition to tree', () => {
    expect(TRANSITIONS.setup).toContain('tree');
  });

  it('tree can transition to settings and login', () => {
    expect(TRANSITIONS.tree).toContain('settings');
    expect(TRANSITIONS.tree).toContain('login');
  });
});

describe('context hooks throw outside provider', () => {
  it('useSessionState throws when used outside provider', () => {
    // #given / #when / #then
    expect(() => {
      function TestComponent(): React.JSX.Element {
        useSessionState();
        return <div />;
      }
      render(<TestComponent />);
    }).toThrow();
  });

  it('useSessionDispatch throws when used outside provider', () => {
    // #given / #when / #then
    expect(() => {
      function TestComponent(): React.JSX.Element {
        useSessionDispatch();
        return <div />;
      }
      render(<TestComponent />);
    }).toThrow();
  });

  it('useTreeContext throws when used outside provider', () => {
    // #given / #when / #then
    expect(() => {
      function TestComponent(): React.JSX.Element {
        useTreeContext();
        return <div />;
      }
      render(<TestComponent />);
    }).toThrow();
  });
});
