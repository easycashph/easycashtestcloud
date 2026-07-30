import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerifySigningOtpUseCase } from '@modules/loan-signing/application/use-cases/VerifySigningOtpUseCase';
import { LoanSigningSession } from '@modules/loan-signing/domain/LoanSigningSession';
import { hashSigningSecret } from '@modules/loan-signing/infrastructure/signingTokenHash';

const RAW_TOKEN = 'raw-token-123';
const OTP_CODE = '123456';

function buildSessionWithOtp() {
  const session = LoanSigningSession.create({
    loanAccountId: 'loan-1',
    partyType: 'BORROWER',
    phoneNumber: '09171234567',
    channel: 'SMS',
    tokenHash: hashSigningSecret(RAW_TOKEN),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdByUserId: 'staff-1',
    documents: [{ generatedLoanDocumentId: 'doc-1', sortIndex: 1 }],
  });
  session.setOtp(hashSigningSecret(OTP_CODE), new Date(Date.now() + 5 * 60 * 1000));
  return session;
}

function buildDeps() {
  const loanSigningSessionRepository = { findByTokenHash: vi.fn(), save: vi.fn() };
  const signingNotificationLogRepository = { create: vi.fn(), markLatestOtpVerified: vi.fn().mockResolvedValue(undefined), listLogs: vi.fn() };
  return { loanSigningSessionRepository, signingNotificationLogRepository };
}

describe('VerifySigningOtpUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the latest OTP log row verified when the code matches', async () => {
    const deps = buildDeps();
    const session = buildSessionWithOtp();
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(session);

    const useCase = new VerifySigningOtpUseCase(deps);
    const result = await useCase.execute(RAW_TOKEN, OTP_CODE);

    expect(result).toBe(true);
    expect(deps.signingNotificationLogRepository.markLatestOtpVerified).toHaveBeenCalledWith(session.id, expect.any(Date));
  });

  it('does not mark anything verified when the code is wrong', async () => {
    const deps = buildDeps();
    const session = buildSessionWithOtp();
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(session);

    const useCase = new VerifySigningOtpUseCase(deps);
    const result = await useCase.execute(RAW_TOKEN, '000000');

    expect(result).toBe(false);
    expect(deps.signingNotificationLogRepository.markLatestOtpVerified).not.toHaveBeenCalled();
  });

  it('does not let a logging failure block a successful verification result', async () => {
    const deps = buildDeps();
    const session = buildSessionWithOtp();
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(session);
    deps.signingNotificationLogRepository.markLatestOtpVerified.mockRejectedValue(new Error('log write failed'));

    const useCase = new VerifySigningOtpUseCase(deps);
    await expect(useCase.execute(RAW_TOKEN, OTP_CODE)).resolves.toBe(true);
  });
});
