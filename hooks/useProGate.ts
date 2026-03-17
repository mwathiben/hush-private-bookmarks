import { useState, useEffect, useCallback, useRef } from 'react';
import type { ProStatus } from '@/lib/types';
import { checkProStatus, openPaymentPage, openTrialPage } from '@/lib/pro-gate';

export interface UseProGateResult {
  readonly isPro: boolean;
  readonly loading: boolean;
  readonly expiresAt: number | null;
  readonly trialDaysLeft: number | null;
  readonly canTrial: boolean;
  readonly showUpgrade: () => Promise<void>;
  readonly startTrial: () => Promise<void>;
}

export function useProGate(): UseProGateResult {
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    checkProStatus().then((result) => {
      setStatus(result);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState === 'visible') {
        checkProStatus().then((result) => {
          setStatus(result);
          setLoading(false);
        });
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return (): void => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const showUpgrade = useCallback((): Promise<void> => openPaymentPage(), []);
  const startTrial = useCallback((): Promise<void> => openTrialPage(), []);

  return {
    isPro: status?.isPro ?? false,
    loading,
    expiresAt: status?.expiresAt ?? null,
    trialDaysLeft: status?.trialDaysLeft ?? null,
    canTrial: status?.canTrial ?? false,
    showUpgrade,
    startTrial,
  };
}
