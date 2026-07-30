import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestSigningOtpUseCase } from '@modules/loan-signing/application/use-cases/RequestSigningOtpUseCase';
import { LoanSigningSession } from '@modules/loan-signing/domain/LoanSigningSession';
import { hashSigningSecret } from '@modules/loan-signing/infrastructure/signingTokenHash';

const RAW_TOKEN = 'raw-token-123';

function buildSession(overrides?: Partial<{ channel: 'SMS' | 'EMAIL'; email?: string }>) {
  return LoanSigningSession.create({
    loanAccountId: 'loan-1',
    partyType: 'BORROWER',
    phoneNumber: '09171234567',
    channel: overrides?.channel ?? 'SMS',
    email: overrides?.email,
    tokenHash: hashSigningSecret(RAW_TOKEN),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdByUserId: 'staff-1',
    documents: [{ generatedLoanDocumentId: 'doc-1', sortIndex: 1 }],
  });
}

function buildDeps() {
  const loanSigningSessionRepository = { findByTokenHash: vi.fn(), save: vi.fn() };
  const signingNotificationLogRepository = { create: vi.fn().mockResolvedValue(undefined), markLatestOtpVerified: vi.fn(), listLogs: vi.fn() };
  const smsGateway = { send: vi.fn().mockResolvedValue({ providerTransId: 'x' }) };
  const emailGateway = { send: vi.fn().mockResolvedValue(undefined) };
  return { loanSigningSessionRepository, signingNotificationLogRepository, smsGateway, emailGateway };
}

describe('RequestSigningOtpUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the OTP via SMS and logs an OTP notification row', async () => {
    const deps = buildDeps();
    const session = buildSession();
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(session);

    const useCase = new RequestSigningOtpUseCase(deps);
    await useCase.execute(RAW_TOKEN);

    expect(deps.smsGateway.send).toHaveBeenCalledWith('09171234567', expect.stringContaining('signing code'));
    expect(deps.emailGateway.send).not.toHaveBeenCalled();
    expect(deps.signingNotificationLogRepository.create).toHaveBeenCalledWith({
      loanSigningSessionId: session.id,
      loanAccountId: 'loan-1',
      type: 'OTP',
      partyType: 'BORROWER',
      channel: 'SMS',
      recipient: '09171234567',
    });
  });

  it('sends the OTP via Email and logs it when the session channel is EMAIL', async () => {
    const deps = buildDeps();
    const session = buildSession({ channel: 'EMAIL', email: 'client@example.com' });
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(session);

    const useCase = new RequestSigningOtpUseCase(deps);
    await useCase.execute(RAW_TOKEN);

    expect(deps.emailGateway.send).toHaveBeenCalledWith('client@example.com', expect.any(String), expect.any(String));
    expect(deps.smsGateway.send).not.toHaveBeenCalled();
    expect(deps.signingNotificationLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'EMAIL', recipient: 'client@example.com' }),
    );
  });

  it('does not let a logging failure block the OTP send from succeeding', async () => {
    const deps = buildDeps();
    const session = buildSession();
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(session);
    deps.signingNotificationLogRepository.create.mockRejectedValue(new Error('log write failed'));

    const useCase = new RequestSigningOtpUseCase(deps);
    await expect(useCase.execute(RAW_TOKEN)).resolves.toBeUndefined();
    expect(deps.smsGateway.send).toHaveBeenCalledTimes(1);
  });
});
