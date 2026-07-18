import { describe, expect, it, vi } from 'vitest';
import { SendPaymentReminderSmsUseCase } from '@modules/sms-reminder/application/use-cases/SendPaymentReminderSmsUseCase';
import type { SmsReminderCandidate } from '@modules/sms-reminder/application/ports/ISmsReminderRepository';

function buildCandidate(overrides: Partial<SmsReminderCandidate> = {}): SmsReminderCandidate {
  return {
    installmentId: 'installment-1',
    loanAccountId: 'loan-1',
    loanCode: 'SML-REG_00001',
    branchId: 'branch-1',
    borrowerName: 'Juan Dela Cruz',
    phoneNumber: '09171234567',
    dueDate: new Date('2026-07-23T00:00:00Z'),
    amountDueTotal: '1500',
    daysLate: null,
    totalAmountDue: null,
    ...overrides,
  };
}

// A Wednesday (Asia/Manila) - PAST_DUE_WEEKLY should NOT run on this date.
const WEDNESDAY = new Date('2026-07-15T04:00:00Z'); // 2026-07-15 is a Wednesday
// A Monday (Asia/Manila) - PAST_DUE_WEEKLY SHOULD run on this date.
const MONDAY = new Date('2026-07-13T04:00:00Z'); // 2026-07-13 is a Monday

function buildRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findCandidatesDueOn: vi.fn().mockResolvedValue([]),
    findPastDueCandidates: vi.fn().mockResolvedValue([]),
    existsForTrigger: vi.fn().mockResolvedValue(false),
    logSent: vi.fn(),
    logFailed: vi.fn(),
    updateDeliveryStatus: vi.fn(),
    listLogs: vi.fn(),
    ...overrides,
  };
}

describe('SendPaymentReminderSmsUseCase', () => {
  it('checks all 4 date-anchored triggers every run, and skips PAST_DUE_WEEKLY on a non-Monday', async () => {
    const smsReminderRepository = buildRepository();
    const smsGateway = { send: vi.fn() };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: true });

    await useCase.execute(WEDNESDAY);

    expect(smsReminderRepository.findCandidatesDueOn).toHaveBeenCalledTimes(4);
    expect(smsReminderRepository.findPastDueCandidates).not.toHaveBeenCalled();
  });

  it('also runs PAST_DUE_WEEKLY when today is a Monday (Asia/Manila)', async () => {
    const smsReminderRepository = buildRepository({
      findPastDueCandidates: vi.fn().mockResolvedValue([buildCandidate({ installmentId: null, dueDate: null, daysLate: 14, totalAmountDue: '5000' })]),
    });
    const smsGateway = { send: vi.fn().mockResolvedValue({ providerTransId: 'M360-past-due' }) };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: true });

    const result = await useCase.execute(MONDAY);

    expect(smsReminderRepository.findPastDueCandidates).toHaveBeenCalledTimes(1);
    expect(smsGateway.send).toHaveBeenCalledWith('09171234567', expect.stringContaining('14 day(s) past due'));
    expect(smsReminderRepository.logSent).toHaveBeenCalledWith(expect.objectContaining({ triggerType: 'PAST_DUE_WEEKLY', installmentId: null }));
    expect(result.sentCount).toBe(1);
  });

  it('skips a candidate that already has a logged reminder for that exact (loan, trigger, day) - idempotency', async () => {
    const smsReminderRepository = buildRepository({
      findCandidatesDueOn: vi.fn().mockResolvedValue([buildCandidate()]),
      existsForTrigger: vi.fn().mockResolvedValue(true),
    });
    const smsGateway = { send: vi.fn() };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: true });

    const result = await useCase.execute(WEDNESDAY);

    expect(smsGateway.send).not.toHaveBeenCalled();
    expect(smsReminderRepository.logSent).not.toHaveBeenCalled();
    expect(result.skippedCount).toBe(4); // same candidate found for all 4 date-anchored triggers, all skipped
  });

  it('logs a dry-run send (smsEnabled=false) without calling the real gateway', async () => {
    const smsReminderRepository = buildRepository({
      findCandidatesDueOn: vi.fn().mockResolvedValueOnce([buildCandidate()]).mockResolvedValue([]),
    });
    const smsGateway = { send: vi.fn() };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: false });

    const result = await useCase.execute(WEDNESDAY);

    expect(smsGateway.send).not.toHaveBeenCalled();
    expect(smsReminderRepository.logSent).toHaveBeenCalledWith(
      expect.objectContaining({ providerTransId: 'DRY-RUN-loan-1-FIVE_DAYS_BEFORE', triggerType: 'FIVE_DAYS_BEFORE' }),
    );
    expect(result.sentCount).toBe(1);
  });

  it('sends via the gateway and logs the real providerTransId when smsEnabled=true', async () => {
    const smsReminderRepository = buildRepository({
      findCandidatesDueOn: vi.fn().mockResolvedValueOnce([buildCandidate()]).mockResolvedValue([]),
    });
    const smsGateway = { send: vi.fn().mockResolvedValue({ providerTransId: 'M360-abc123' }) };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: true });

    const result = await useCase.execute(WEDNESDAY);

    expect(smsGateway.send).toHaveBeenCalledWith('09171234567', expect.stringContaining('Juan Dela Cruz'));
    expect(smsReminderRepository.logSent).toHaveBeenCalledWith(expect.objectContaining({ providerTransId: 'M360-abc123' }));
    expect(result.sentCount).toBe(1);
  });

  it('logs a failure and continues (one bad number does not sink the whole batch)', async () => {
    const smsReminderRepository = buildRepository({
      findCandidatesDueOn: vi
        .fn()
        .mockResolvedValueOnce([buildCandidate({ installmentId: 'bad-1', loanAccountId: 'loan-bad' }), buildCandidate({ installmentId: 'good-1', loanAccountId: 'loan-good' })])
        .mockResolvedValue([]),
    });
    const smsGateway = {
      send: vi
        .fn()
        .mockRejectedValueOnce(new Error('M360 rejected the send (code 401 Unauthorized): bad credentials'))
        .mockResolvedValueOnce({ providerTransId: 'M360-good' }),
    };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: true });

    const result = await useCase.execute(WEDNESDAY);

    expect(smsReminderRepository.logFailed).toHaveBeenCalledWith(
      expect.objectContaining({ loanAccountId: 'loan-bad', errorMessage: expect.stringContaining('Unauthorized') }),
    );
    expect(smsReminderRepository.logSent).toHaveBeenCalledWith(expect.objectContaining({ loanAccountId: 'loan-good' }));
    expect(result.sentCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });
});
