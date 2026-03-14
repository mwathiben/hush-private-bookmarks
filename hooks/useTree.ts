import { useState, useEffect, useCallback } from 'react';
import { useSessionState, useTreeContext } from '@/entrypoints/popup/App';
import { useSendMessage } from '@/hooks/useSendMessage';
import type { BookmarkTree } from '@/lib/types';

export interface UseTreeReturn {
  readonly tree: BookmarkTree | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly save: (newTree: BookmarkTree) => Promise<boolean>;
}

export function useTree(): UseTreeReturn {
  const { session } = useSessionState();
  const { tree, setTree } = useTreeContext();
  const sendMessage = useSendMessage();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tree === null && session?.tree) {
      setTree(session.tree);
    }
  }, [tree, session?.tree, setTree]);

  const save = useCallback(async (newTree: BookmarkTree): Promise<boolean> => {
    setSaving(true);
    setError(null);

    try {
      const response = await sendMessage({ type: 'SAVE', tree: newTree });

      if (response.success) {
        setTree(newTree);
        return true;
      }

      setError(response.error ?? 'Unknown error');
      return false;
    } catch {
      setError('Failed to save bookmarks');
      return false;
    } finally {
      setSaving(false);
    }
  }, [sendMessage, setTree]);

  return { tree, saving, error, save };
}
