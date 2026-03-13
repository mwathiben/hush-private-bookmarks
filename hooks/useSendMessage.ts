import { useCallback } from 'react';
import type { BackgroundMessage, BackgroundResponse } from '@/lib/background-types';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 100;

export type SendMessageFn = (msg: BackgroundMessage) => Promise<BackgroundResponse>;

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('Could not establish connection')
    || error.message.includes('Extension context invalidated');
}

function isBackgroundResponse(raw: unknown): raw is BackgroundResponse {
  return typeof raw === 'object' && raw !== null && 'success' in raw;
}

export function useSendMessage(): SendMessageFn {
  return useCallback(async (msg: BackgroundMessage): Promise<BackgroundResponse> => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw: unknown = await browser.runtime.sendMessage(msg);
        if (!isBackgroundResponse(raw)) {
          throw new Error('Invalid response from background');
        }
        return raw;
      } catch (error: unknown) {
        if (!isRetryableError(error) || attempt === MAX_RETRIES) throw error;
        await new Promise(r => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
      }
    }
    throw new Error('Unreachable');
  }, []);
}
