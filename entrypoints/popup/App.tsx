import {
  createContext,
  use,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import type { ComponentType, Dispatch } from 'react';
import { useSendMessage } from '@/hooks/useSendMessage';
import { useSession } from '@/hooks/useSession';
import type { SessionState } from '@/lib/background-types';
import type { BookmarkTree } from '@/lib/types';
import LoginScreen from '@/components/screens/LoginScreen';
import SetupScreen from '@/components/screens/SetupScreen';
import TreeScreen from '@/components/screens/TreeScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';

type Screen = 'login' | 'setup' | 'tree' | 'settings' | 'import';

type SessionAction =
  | { type: 'SET_SESSION'; session: SessionState }
  | { type: 'NAVIGATE'; to: Screen }
  | { type: 'SET_ERROR'; error: string };

interface SessionStateValue {
  readonly screen: Screen;
  readonly session: SessionState | null;
  readonly loading: boolean;
  readonly error: string | null;
}

interface TreeContextValue {
  readonly tree: BookmarkTree | null;
  readonly setTree: (tree: BookmarkTree | null) => void;
}

export const TRANSITIONS: Record<Screen, readonly Screen[]> = {
  login: ['tree', 'setup'],
  setup: ['tree'],
  tree: ['settings', 'login'],
  settings: ['tree', 'import', 'login'],
  import: ['settings', 'tree'],
};

const SessionStateContext = createContext<SessionStateValue | null>(null);
const SessionDispatchContext = createContext<Dispatch<SessionAction> | null>(null);
const TreeContext = createContext<TreeContextValue | null>(null);

export function useSessionState(): SessionStateValue {
  const ctx = use(SessionStateContext);
  if (!ctx) throw new Error('useSessionState must be used within App');
  return ctx;
}

export function useSessionDispatch(): Dispatch<SessionAction> {
  const ctx = use(SessionDispatchContext);
  if (!ctx) throw new Error('useSessionDispatch must be used within App');
  return ctx;
}

export function useTreeContext(): TreeContextValue {
  const ctx = use(TreeContext);
  if (!ctx) throw new Error('useTreeContext must be used within App');
  return ctx;
}

function deriveScreen(session: SessionState): Screen {
  if (session.isUnlocked) return 'tree';
  if (!session.hasData) return 'setup';
  return 'login';
}

const INITIAL_STATE: SessionStateValue = {
  screen: 'login',
  session: null,
  loading: true,
  error: null,
};

function sessionReducer(state: SessionStateValue, action: SessionAction): SessionStateValue {
  switch (action.type) {
    case 'SET_SESSION': {
      const screen = deriveScreen(action.session);
      return { ...state, session: action.session, screen, loading: false, error: null };
    }
    case 'NAVIGATE': {
      if (!TRANSITIONS[state.screen].includes(action.to)) {
        throw new Error(`Invalid transition: ${state.screen} → ${action.to}`);
      }
      return { ...state, screen: action.to };
    }
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
  }
}

const SCREEN_MAP: Record<Screen, ComponentType> = {
  login: LoginScreen,
  setup: SetupScreen,
  tree: TreeScreen,
  settings: SettingsScreen,
  import: TreeScreen,
};

export default function App(): React.JSX.Element {
  const sendMessage = useSendMessage();
  const { loading, error, session } = useSession(sendMessage);
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_STATE);
  const [tree, setTree] = useState<BookmarkTree | null>(null);

  useEffect(() => {
    if (session) dispatch({ type: 'SET_SESSION', session });
    else if (error) dispatch({ type: 'SET_ERROR', error });
  }, [session, error]);

  const treeValue = useMemo(() => ({ tree, setTree }), [tree]);

  if (loading && state.loading) {
    return (
      <div
        data-testid="loading-spinner"
        className="flex h-100 w-95 items-center justify-center bg-background"
      >
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (state.error && !state.session) {
    return (
      <div className="flex h-100 w-95 items-center justify-center bg-background p-6 text-destructive">
        {state.error}
      </div>
    );
  }

  const CurrentScreen = SCREEN_MAP[state.screen];
  return (
    <div className="w-95 max-h-137.5 overflow-y-auto bg-background text-foreground">
      <SessionStateContext value={state}>
        <SessionDispatchContext value={dispatch}>
          <TreeContext value={treeValue}>
            <CurrentScreen />
          </TreeContext>
        </SessionDispatchContext>
      </SessionStateContext>
    </div>
  );
}
