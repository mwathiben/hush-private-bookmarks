import {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import type { Dispatch, ReactNode } from 'react';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useSession } from '@/hooks/useSession';
import type { SessionState } from '@/lib/background-types';
import type { BookmarkTree } from '@/lib/types';

export type Screen = 'login' | 'setup' | 'tree' | 'settings' | 'import';

export type SessionAction =
  | { type: 'SET_SESSION'; session: SessionState }
  | { type: 'NAVIGATE'; to: Screen }
  | { type: 'SET_ERROR'; error: string };

export interface SessionStateValue {
  readonly screen: Screen;
  readonly session: SessionState | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export interface TreeContextValue {
  readonly tree: BookmarkTree | null;
  readonly setTree: (tree: BookmarkTree | null) => void;
}

export const TRANSITIONS: Record<Screen, readonly Screen[]> = {
  login: ['tree', 'setup'],
  setup: ['tree'],
  tree: ['settings', 'login'],
  settings: ['tree', 'import', 'login', 'setup'],
  import: ['settings', 'tree'],
};

const SessionStateContext = createContext<SessionStateValue | null>(null);
const SessionDispatchContext = createContext<Dispatch<SessionAction> | null>(null);
const TreeContext = createContext<TreeContextValue | null>(null);

export function useSessionState(): SessionStateValue {
  const ctx = use(SessionStateContext);
  if (!ctx) throw new Error('useSessionState must be used within a SessionProvider');
  return ctx;
}

export function useSessionDispatch(): Dispatch<SessionAction> {
  const ctx = use(SessionDispatchContext);
  if (!ctx) throw new Error('useSessionDispatch must be used within a SessionProvider');
  return ctx;
}

export function useTreeContext(): TreeContextValue {
  const ctx = use(TreeContext);
  if (!ctx) throw new Error('useTreeContext must be used within a SessionProvider');
  return ctx;
}

export function deriveScreen(session: SessionState): Screen {
  if (session.isUnlocked) return 'tree';
  if (!session.hasData) return 'setup';
  return 'login';
}

export const INITIAL_STATE: SessionStateValue = {
  screen: 'login',
  session: null,
  loading: true,
  error: null,
};

export function sessionReducer(state: SessionStateValue, action: SessionAction): SessionStateValue {
  switch (action.type) {
    case 'SET_SESSION': {
      const screen = deriveScreen(action.session);
      return { ...state, session: action.session, screen, loading: false, error: null };
    }
    case 'NAVIGATE': {
      if (!TRANSITIONS[state.screen].includes(action.to)) {
        return state;
      }
      return { ...state, screen: action.to };
    }
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
  }
}

export interface SessionProviderReturn {
  readonly state: SessionStateValue;
  readonly dispatch: Dispatch<SessionAction>;
  readonly treeValue: TreeContextValue;
  readonly hookLoading: boolean;
}

export function useSessionProvider(): SessionProviderReturn {
  const sendMessage = useSendMessage();
  const { loading, error, session } = useSession(sendMessage);
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_STATE);
  const [tree, setTree] = useState<BookmarkTree | null>(null);

  useEffect(() => {
    if (session) dispatch({ type: 'SET_SESSION', session });
    else if (error) dispatch({ type: 'SET_ERROR', error });
  }, [session, error]);

  const treeValue = useMemo(() => ({ tree, setTree }), [tree]);

  return { state, dispatch, treeValue, hookLoading: loading };
}

export interface SessionProviderProps {
  readonly state: SessionStateValue;
  readonly dispatch: Dispatch<SessionAction>;
  readonly treeValue: TreeContextValue;
  readonly children: ReactNode;
}

export function SessionProvider({ state, dispatch, treeValue, children }: SessionProviderProps): React.JSX.Element {
  return (
    <SessionStateContext value={state}>
      <SessionDispatchContext value={dispatch}>
        <TreeContext value={treeValue}>
          {children}
        </TreeContext>
      </SessionDispatchContext>
    </SessionStateContext>
  );
}
