import { describe, expect, it, vi } from 'vitest';
import { SendPaymentReminderEmailUseCase } from '@modules/email-reminder/application/use-cases/SendPaymentReminderEmailUseCase';
import type { EmailReminderCandidate } from '@modules/email-reminder/application/ports/IEmailReminderRepository';

function buildCandidate(overrides: Partial<EmailReminderCandidate> = {}): EmailReminderCandidate {
  return {
    installmentId: 'installment-1',
    loanAccountId: 'loan-1',
    loanCode: 'SML-REG_00001',
    branchId: 'branch-1',
    borrowerName: 'Juan Dela Cruz',
    email: 'juan@example.com',
    dueDate: new Date('2026-07-23T00:00:00Z'),
    amountDueTotal: '1500',
    daysLate: null,
    totalAmountDue: null,
    ...overrides,
  };
}

const WEDNESDAY = new Date('2026-07-15T04:00:00Z');
const MONDAY = new Date('2026-07-13T04:00:00Z');

function buildRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findCandidatesDueOn: vi.fn().mockResolvedValue([]),
    findPastDueCandidates: vi.fn().mockResolvedValue([]),
    existsForTrigger: vi.fn().mockResolvedValue(false),
    logSent: vi.fn(),
    logFailed: vi.fn(),
    listLogs: vi.fn(),
    ...overrides,
  };
}

function buildSettingsRepository(emailEnabled: boolean) {
  return { get: vi.fn().mockResolvedValue({ smsEnabled: false, emailEnabled, updatedAt: new Date(), updatedByUserId: null }) };
}

describe('SendPaymentReminderEmailUseCase', () => {
  it('checks all 4 date-anchored triggers every run, and skips PAST_DUE_WEEKLY on a non-Monday', async () => {
    const emailReminderRepository = buildRepository();
    const emailGateway = { send: vi.fn() };
    const useCase = new SendPaymentReminderEmailUseCase({ emailReminderRepository, emailGateway, reminderSettingsRepository: buildSettingsRepository(true) });

    await useCase.execute(WEDNESDAY);

    expect(emailReminderRepository.findCandidatesDueOn).toHaveBeenCalledTimes(4);
    expect(emailReminderRepository.findPastDueCandidates).not.toHaveBeenCalled();
  });

  it('also runs PAST_DUE_WEEKLY when today is a Monday (Asia/Manila)', async () => {
    const emailReminderRepository = buildRepository({
      findPastDueCandidates: vi.fn().mockResolvedValue([buildCandidate({ installmentId: null, dueDate: null, daysLate: 14, totalAmountDue: '5000' })]),
    });
    const emailGateway = { send: vi.fn().mockResolvedValue(undefined) };
    const useCase = new SendPaymentReminderEmailUseCase({ emailReminderRepository, emailGateway, reminderSettingsRepository: buildSettingsRepository(true) });

    const result = await useCase.execute(MONDAY);

    expect(emailGateway.send).toHaveBeenCalledWith('juan@example.com', expect.any(String), expect.stringContaining('14 day(s) past due'));
    expect(emailReminderRepository.logSent).toHaveBeenCalledWith(expect.objectContaining({ triggerType: 'PAST_DUE_WEEKLY', installmentId: null }));
    expect(result.sentCount).toBe(1);
  });

  it('logs a dry-run send (emailEnabled=false) without calling the real gateway', async () => {
    const emailReminderRepository = buildRepository({
      findCandidatesDueOn: vi.fn().mockResolvedValueOnce([buildCandidate()]).mockResolvedValue([]),
    });
    const emailGateway = { send: vi.fn() };
    const useCase = new SendPaymentReminderEmailUseCase({ emailReminderRepository, emailGateway, reminderSettingsRepository: buildSettingsRepository(false) });

    const result = await useCase.execute(WEDNESDAY);

    expect(emailGateway.send).not.toHaveBeenCalled();
    expect(emailReminderRepository.logSent).toHaveBeenCalledWith(expect.objectContaining({ triggerType: 'FIVE_DAYS_BEFORE' }));
    expect(result.sentCount).toBe(1);
  });

  it('logs a failure and continues when the gateway throws', async () => {
    const emailReminderRepository = buildRepository({
      findCandidatesDueOn: vi.fn().mockResolvedValueOnce([buildCandidate()]).mockResolvedValue([]),
    });
    const emailGateway = { send: vi.fn().mockRejectedValue(new Error('SMTP send failed: bad credentials')) };
    const useCase = new SendPaymentReminderEmailUseCase({ emailReminderRepository, emailGateway, reminderSettingsRepository: buildSettingsRepository(true) });

    const result = await useCase.execute(WEDNESDAY);

    expect(emailReminderRepository.logFailed).toHaveBeenCalledWith(expect.objectContaining({ errorMessage: expect.stringContaining('bad credentials') }));
    expect(result.failedCount).toBe(1);
  });
});
