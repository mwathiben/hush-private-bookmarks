import { useState, useEffect } from 'react';
import type { SessionState } from '@/lib/background-types';
import type { SendMessageFn } from '@/hooks/useSendMessage';

export interface UseSessionResult {
  readonly loading: boolean;
  readonly error: string | null;
  readonly session: SessionState | null;
}

function isSessionState(data: unknown): data is SessionState {
  return typeof data === 'object' && data !== null
    && 'isUnlocked' in data && 'hasData' in data;
}

export function useSession(sendMessage: SendMessageFn): UseSessionResult {
  const [state, setState] = useState<UseSessionResult>({
    loading: true,
    error: null,
    session: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchState(): Promise<void> {
      try {
        const response = await sendMessage({ type: 'GET_STATE' });
        if (controller.signal.aborted) return;
        if (response.success && isSessionState(response.data)) {
          setState({ loading: false, error: null, session: response.data });
        } else if (!response.success) {
          setState({ loading: false, error: response.error, session: null });
        } else {
          setState({ loading: false, error: 'Invalid session data', session: null });
        }
      } catch {
        if (controller.signal.aborted) return;
        setState({ loading: false, error: 'Failed to connect to background', session: null });
      }
    }

    void fetchState();
    return (): void => controller.abort();
  }, [sendMessage]);

  return state;
}
