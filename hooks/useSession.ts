import { useState, useEffect } from 'react';
import type { SessionState } from '@/lib/background-types';
import type { SendMessageFn } from '@/hooks/useSendMessage';

export interface UseSessionResult {
  readonly loading: boolean;
  readonly error: string | null;
  readonly session: SessionState | null;
}

function isIncognitoMode(value: unknown): value is SessionState['incognitoMode'] {
  return value === 'incognito_active' || value === 'normal_mode' || value === 'incognito_not_allowed';
}

function isPasswordSetInfoArray(value: unknown): value is SessionState['sets'] {
  if (!Array.isArray(value)) return false;

  return value.every((set) =>
    typeof set === 'object'
    && set !== null
    && 'id' in set
    && typeof set.id === 'string'
    && 'name' in set
    && typeof set.name === 'string'
    && 'createdAt' in set
    && typeof set.createdAt === 'number'
    && 'lastAccessedAt' in set
    && typeof set.lastAccessedAt === 'number'
    && 'isDefault' in set
    && typeof set.isDefault === 'boolean');
}

function isSessionState(data: unknown): data is SessionState {
  if (typeof data !== 'object' || data === null) return false;

  if (!('isUnlocked' in data) || typeof data.isUnlocked !== 'boolean') return false;
  if (!('hasData' in data) || typeof data.hasData !== 'boolean') return false;
  if (!('activeSetId' in data) || typeof data.activeSetId !== 'string') return false;
  if (!('sets' in data) || !isPasswordSetInfoArray(data.sets)) return false;
  if (!('tree' in data) || (data.tree !== null && typeof data.tree !== 'object')) return false;
  if (!('incognitoMode' in data) || !isIncognitoMode(data.incognitoMode)) return false;

  return true;
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
