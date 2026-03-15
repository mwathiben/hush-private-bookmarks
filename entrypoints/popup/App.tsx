import type { ComponentType } from 'react';
import type { Screen } from '@/hooks/useSessionProvider';
import { useSessionProvider, SessionProvider } from '@/hooks/useSessionProvider';
import LoginScreen from '@/components/screens/LoginScreen';
import SetupScreen from '@/components/screens/SetupScreen';
import TreeScreen from '@/components/screens/TreeScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';

const SCREEN_MAP: Record<Screen, ComponentType> = {
  login: LoginScreen,
  setup: SetupScreen,
  tree: TreeScreen,
  settings: SettingsScreen,
  import: TreeScreen,
};

export default function App(): React.JSX.Element {
  const { state, dispatch, treeValue, hookLoading } = useSessionProvider();

  if (hookLoading && state.loading) {
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
      <SessionProvider state={state} dispatch={dispatch} treeValue={treeValue}>
        <CurrentScreen />
      </SessionProvider>
    </div>
  );
}
