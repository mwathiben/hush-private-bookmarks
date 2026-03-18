import type { ProStatus } from '@/lib/types';
import { ProGateError } from '@/lib/errors';
import { captureException } from '@/lib/sentry';
import ExtPay from 'extpay';

export const TRIAL_DURATION_DAYS = 7;
export const PRO_EXTENSION_ID = 'hush-private-bookmarks';

type ExtPayInstance = ReturnType<typeof ExtPay>;

let extpayInstance: ExtPayInstance | null = null;

function getExtPay(): ExtPayInstance {
  if (!extpayInstance) {
    extpayInstance = ExtPay(PRO_EXTENSION_ID);
  }
  return extpayInstance;
}

const ERROR_FALLBACK_STATUS: Readonly<ProStatus> = Object.freeze({
  isPro: false,
  expiresAt: null,
  trialDaysLeft: null,
  canTrial: false,
});

export const INITIAL_PRO_STATUS: Readonly<ProStatus> = Object.freeze({
  isPro: false,
  expiresAt: null,
  trialDaysLeft: null,
  canTrial: true,
});

function computeTrialDaysLeft(trialStartedAt: Date): number {
  const trialEndMs = trialStartedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const remaining = trialEndMs - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

function mapUserToProStatus(user: {
  paid: boolean;
  trialStartedAt: Date | null;
  subscriptionCancelAt?: Date | null;
}): ProStatus {
  if (user.paid) {
    if (user.subscriptionCancelAt) {
      const cancelMs = user.subscriptionCancelAt.getTime();
      const isExpired = cancelMs < Date.now();
      return {
        isPro: !isExpired,
        expiresAt: cancelMs,
        trialDaysLeft: null,
        canTrial: false,
      };
    }
    return {
      isPro: true,
      expiresAt: null,
      trialDaysLeft: null,
      canTrial: false,
    };
  }

  if (user.trialStartedAt) {
    const daysLeft = computeTrialDaysLeft(user.trialStartedAt);
    const trialEndMs = user.trialStartedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
    return {
      isPro: daysLeft > 0,
      expiresAt: trialEndMs,
      trialDaysLeft: daysLeft,
      canTrial: false,
    };
  }

  return {
    isPro: false,
    expiresAt: null,
    trialDaysLeft: null,
    canTrial: true,
  };
}

export async function checkProStatus(): Promise<ProStatus> {
  try {
    const extpay = getExtPay();
    const user = await extpay.getUser();
    return mapUserToProStatus(user);
  } catch (err) {
    captureException(err);
    return { ...ERROR_FALLBACK_STATUS };
  }
}

export async function openPaymentPage(planNickname?: string): Promise<void> {
  try {
    const extpay = getExtPay();
    await extpay.openPaymentPage(planNickname);
  } catch (cause) {
    throw new ProGateError('Failed to open payment page', { code: 'SDK_UNAVAILABLE' }, { cause });
  }
}

export async function openTrialPage(displayText?: string): Promise<void> {
  try {
    const extpay = getExtPay();
    await extpay.openTrialPage(displayText);
  } catch (cause) {
    throw new ProGateError('Failed to open trial page', { code: 'SDK_UNAVAILABLE' }, { cause });
  }
}

export function _resetForTesting(): void {
  extpayInstance = null;
}
