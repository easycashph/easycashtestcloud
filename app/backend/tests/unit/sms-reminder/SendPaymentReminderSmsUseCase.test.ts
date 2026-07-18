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
    ...overrides,
  };
}

describe('SendPaymentReminderSmsUseCase', () => {
  it('skips a candidate that already has a logged reminder for its installment (idempotency)', async () => {
    const smsReminderRepository = {
      findCandidatesDueOn: vi.fn().mockResolvedValue([buildCandidate()]),
      existsForInstallment: vi.fn().mockResolvedValue(true),
      logSent: vi.fn(),
      logFailed: vi.fn(),
      updateDeliveryStatus: vi.fn(),
    };
    const smsGateway = { send: vi.fn() };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: true });

    const result = await useCase.execute(new Date());

    expect(smsGateway.send).not.toHaveBeenCalled();
    expect(smsReminderRepository.logSent).not.toHaveBeenCalled();
    expect(result).toEqual({ candidateCount: 1, sentCount: 0, skippedCount: 1, failedCount: 0 });
  });

  it('logs a dry-run send (smsEnabled=false) without calling the real gateway', async () => {
    const smsReminderRepository = {
      findCandidatesDueOn: vi.fn().mockResolvedValue([buildCandidate()]),
      existsForInstallment: vi.fn().mockResolvedValue(false),
      logSent: vi.fn(),
      logFailed: vi.fn(),
      updateDeliveryStatus: vi.fn(),
    };
    const smsGateway = { send: vi.fn() };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: false });

    const result = await useCase.execute(new Date());

    expect(smsGateway.send).not.toHaveBeenCalled();
    expect(smsReminderRepository.logSent).toHaveBeenCalledWith(
      expect.objectContaining({ installmentId: 'installment-1', providerTransId: 'DRY-RUN-installment-1' }),
    );
    expect(result).toEqual({ candidateCount: 1, sentCount: 1, skippedCount: 0, failedCount: 0 });
  });

  it('sends via the gateway and logs the real providerTransId when smsEnabled=true', async () => {
    const smsReminderRepository = {
      findCandidatesDueOn: vi.fn().mockResolvedValue([buildCandidate()]),
      existsForInstallment: vi.fn().mockResolvedValue(false),
      logSent: vi.fn(),
      logFailed: vi.fn(),
      updateDeliveryStatus: vi.fn(),
    };
    const smsGateway = { send: vi.fn().mockResolvedValue({ providerTransId: 'M360-abc123' }) };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: true });

    const result = await useCase.execute(new Date());

    expect(smsGateway.send).toHaveBeenCalledWith('09171234567', expect.stringContaining('Juan Dela Cruz'));
    expect(smsReminderRepository.logSent).toHaveBeenCalledWith(expect.objectContaining({ providerTransId: 'M360-abc123' }));
    expect(result).toEqual({ candidateCount: 1, sentCount: 1, skippedCount: 0, failedCount: 0 });
  });

  it('logs a failure and continues (one bad number does not sink the whole batch)', async () => {
    const smsReminderRepository = {
      findCandidatesDueOn: vi.fn().mockResolvedValue([buildCandidate({ installmentId: 'bad-1' }), buildCandidate({ installmentId: 'good-1' })]),
      existsForInstallment: vi.fn().mockResolvedValue(false),
      logSent: vi.fn(),
      logFailed: vi.fn(),
      updateDeliveryStatus: vi.fn(),
    };
    const smsGateway = {
      send: vi
        .fn()
        .mockRejectedValueOnce(new Error('M360 rejected the send (code 401 Unauthorized): bad credentials'))
        .mockResolvedValueOnce({ providerTransId: 'M360-good' }),
    };
    const useCase = new SendPaymentReminderSmsUseCase({ smsReminderRepository, smsGateway, smsEnabled: true });

    const result = await useCase.execute(new Date());

    expect(smsReminderRepository.logFailed).toHaveBeenCalledWith(
      expect.objectContaining({ installmentId: 'bad-1', errorMessage: expect.stringContaining('Unauthorized') }),
    );
    expect(smsReminderRepository.logSent).toHaveBeenCalledWith(expect.objectContaining({ installmentId: 'good-1' }));
    expect(result).toEqual({ candidateCount: 2, sentCount: 1, skippedCount: 0, failedCount: 1 });
  });
});
