import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ProStatus } from '@/lib/types';
import { ProGateError } from '@/lib/errors';

const mockGetUser = vi.fn();
const mockOpenPaymentPage = vi.fn();
const mockOpenTrialPage = vi.fn();

vi.mock('extpay', () => ({
  default: vi.fn(() => ({
    getUser: mockGetUser,
    openPaymentPage: mockOpenPaymentPage,
    openTrialPage: mockOpenTrialPage,
    startBackground: vi.fn(),
    onPaid: { addListener: vi.fn() },
    onTrialStarted: { addListener: vi.fn() },
  })),
}));

const ROOT = resolve(process.cwd());

describe('pro-gate', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const { _resetForTesting } = await import('@/lib/pro-gate');
    _resetForTesting();
  });

  describe('checkProStatus', () => {
    it('returns isPro:true for active subscriber', async () => {
      // #given
      mockGetUser.mockResolvedValue({
        paid: true,
        paidAt: new Date('2026-01-15'),
        trialStartedAt: null,
        subscriptionCancelAt: undefined,
      });

      // #when
      const { checkProStatus } = await import('@/lib/pro-gate');
      const result: ProStatus = await checkProStatus();

      // #then
      expect(result.isPro).toBe(true);
      expect(result.expiresAt).toBeNull();
      expect(result.trialDaysLeft).toBeNull();
      expect(result.canTrial).toBe(false);
    });

    it('returns isPro:true with expiresAt for canceling subscriber', async () => {
      // #given
      const cancelDate = new Date('2026-04-15');
      mockGetUser.mockResolvedValue({
        paid: true,
        paidAt: new Date('2026-01-15'),
        trialStartedAt: null,
        subscriptionCancelAt: cancelDate,
      });

      // #when
      const { checkProStatus } = await import('@/lib/pro-gate');
      const result = await checkProStatus();

      // #then
      expect(result.isPro).toBe(true);
      expect(result.expiresAt).toBe(cancelDate.getTime());
    });

    it('returns isPro:false for expired subscriber (cancelAt in past)', async () => {
      // #given
      const pastCancel = new Date('2025-01-01');
      mockGetUser.mockResolvedValue({
        paid: true,
        paidAt: new Date('2024-01-15'),
        trialStartedAt: null,
        subscriptionCancelAt: pastCancel,
      });

      // #when
      const { checkProStatus } = await import('@/lib/pro-gate');
      const result = await checkProStatus();

      // #then
      expect(result.isPro).toBe(false);
      expect(result.expiresAt).toBe(pastCancel.getTime());
    });

    it('returns canTrial:true for new user (no sub, no trial)', async () => {
      // #given
      mockGetUser.mockResolvedValue({
        paid: false,
        paidAt: null,
        trialStartedAt: null,
        subscriptionCancelAt: undefined,
      });

      // #when
      const { checkProStatus } = await import('@/lib/pro-gate');
      const result = await checkProStatus();

      // #then
      expect(result.isPro).toBe(false);
      expect(result.canTrial).toBe(true);
      expect(result.trialDaysLeft).toBeNull();
    });

    it('returns isPro:true + trialDaysLeft for active trial', async () => {
      // #given — trial started 3 days ago
      const now = Date.now();
      const trialStart = new Date(now - 3 * 24 * 60 * 60 * 1000);
      mockGetUser.mockResolvedValue({
        paid: false,
        paidAt: null,
        trialStartedAt: trialStart,
        subscriptionCancelAt: undefined,
      });

      // #when
      const { checkProStatus } = await import('@/lib/pro-gate');
      const result = await checkProStatus();

      // #then
      expect(result.isPro).toBe(true);
      expect(result.trialDaysLeft).toBeGreaterThanOrEqual(3);
      expect(result.trialDaysLeft).toBeLessThanOrEqual(4);
      expect(result.canTrial).toBe(false);
    });

    it('returns isPro:false + trialDaysLeft:0 for expired trial', async () => {
      // #given — trial started 10 days ago (exceeds 7-day window)
      const trialStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockGetUser.mockResolvedValue({
        paid: false,
        paidAt: null,
        trialStartedAt: trialStart,
        subscriptionCancelAt: undefined,
      });

      // #when
      const { checkProStatus } = await import('@/lib/pro-gate');
      const result = await checkProStatus();

      // #then
      expect(result.isPro).toBe(false);
      expect(result.trialDaysLeft).toBe(0);
      expect(result.canTrial).toBe(false);
    });

    it('returns free-tier defaults when getUser() throws', async () => {
      // #given
      mockGetUser.mockRejectedValue(new Error('network down'));

      // #when
      const { checkProStatus } = await import('@/lib/pro-gate');
      const result = await checkProStatus();

      // #then
      expect(result.isPro).toBe(false);
      expect(result.expiresAt).toBeNull();
      expect(result.trialDaysLeft).toBeNull();
      expect(result.canTrial).toBe(false);
    });

    it('returns free-tier defaults when SDK fails to init', async () => {
      // #given — make ExtPay constructor throw
      const extpayModule = await import('extpay');
      vi.mocked(extpayModule.default).mockImplementation(() => {
        throw new Error('SDK init failed');
      });

      // #when
      const { _resetForTesting, checkProStatus } = await import('@/lib/pro-gate');
      _resetForTesting();
      const result = await checkProStatus();

      // #then
      expect(result.isPro).toBe(false);
      expect(result.canTrial).toBe(false);
    });

    it('reuses singleton across multiple calls', async () => {
      // #given
      mockGetUser.mockResolvedValue({
        paid: false,
        paidAt: null,
        trialStartedAt: null,
        subscriptionCancelAt: undefined,
      });
      const extpayModule = await import('extpay');

      // #when
      const { checkProStatus } = await import('@/lib/pro-gate');
      await checkProStatus();
      await checkProStatus();

      // #then — ExtPay constructor called only once
      expect(extpayModule.default).toHaveBeenCalledTimes(1);
    });
  });

  describe('openPaymentPage', () => {
    it('delegates to ExtPay.openPaymentPage', async () => {
      // #given
      mockOpenPaymentPage.mockResolvedValue(undefined);

      // #when
      const { openPaymentPage } = await import('@/lib/pro-gate');
      await openPaymentPage('monthly');

      // #then
      expect(mockOpenPaymentPage).toHaveBeenCalledWith('monthly');
    });

    it('throws ProGateError on SDK failure', async () => {
      expect.assertions(3);
      // #given
      mockOpenPaymentPage.mockRejectedValue(new Error('tab creation failed'));

      // #when
      const { openPaymentPage } = await import('@/lib/pro-gate');

      // #then
      try {
        await openPaymentPage();
      } catch (err) {
        expect(err).toBeInstanceOf(ProGateError);
        expect((err as ProGateError).context.code).toBe('SDK_UNAVAILABLE');
        expect((err as ProGateError).cause).toBeInstanceOf(Error);
      }
    });
  });

  describe('openTrialPage', () => {
    it('delegates to ExtPay.openTrialPage', async () => {
      // #given
      mockOpenTrialPage.mockResolvedValue(undefined);

      // #when
      const { openTrialPage } = await import('@/lib/pro-gate');
      await openTrialPage('Try 7 days free');

      // #then
      expect(mockOpenTrialPage).toHaveBeenCalledWith('Try 7 days free');
    });

    it('throws ProGateError on SDK failure', async () => {
      expect.assertions(2);
      // #given
      mockOpenTrialPage.mockRejectedValue(new Error('window creation failed'));

      // #when
      const { openTrialPage } = await import('@/lib/pro-gate');

      // #then
      try {
        await openTrialPage();
      } catch (err) {
        expect(err).toBeInstanceOf(ProGateError);
        expect((err as ProGateError).context.code).toBe('SDK_UNAVAILABLE');
      }
    });
  });

  describe('module purity', () => {
    it('has zero React imports', () => {
      const content = readFileSync(resolve(ROOT, 'lib/pro-gate.ts'), 'utf-8');
      expect(content).not.toMatch(/from\s+['"]react['"]/);
      expect(content).not.toMatch(/from\s+['"]react-dom['"]/);
    });

    it('has zero console.log', () => {
      const content = readFileSync(resolve(ROOT, 'lib/pro-gate.ts'), 'utf-8');
      expect(content).not.toContain('console.log');
    });

    it('has zero DOM APIs', () => {
      const content = readFileSync(resolve(ROOT, 'lib/pro-gate.ts'), 'utf-8');
      expect(content).not.toContain('document.');
      expect(content).not.toContain('window.');
    });
  });
});
