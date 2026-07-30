import { describe, expect, it, vi } from 'vitest';
import { VerifySignUpUseCase } from '@modules/client-portal/application/use-cases/VerifySignUpUseCase';
import { PortalInvalidOtpError, PortalTooManyOtpAttemptsError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import type { IPortalAccountRepository, PortalAccountRecord } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type {
  IPortalAccountChallengeRepository,
  PortalAccountChallengeRecord,
} from '@modules/client-portal/application/ports/IPortalAccountChallengeRepository';

const ACCOUNT: PortalAccountRecord = {
  id: 'acct-1',
  email: 'new@example.com',
  passwordHash: 'hash',
  contactNumber: null,
  status: 'PENDING_VERIFICATION',
  emailVerifiedAt: null,
  borrowerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildDeps(challenge: PortalAccountChallengeRecord | null, verifyResult = true) {
  const portalAccountRepository: IPortalAccountRepository = {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn().mockResolvedValue(ACCOUNT),
    update: vi.fn().mockResolvedValue({ ...ACCOUNT, status: 'ACTIVE' }),
  };
  const portalAccountChallengeRepository: IPortalAccountChallengeRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(challenge),
    verifyAndConsume: vi.fn().mockResolvedValue(verifyResult),
    incrementAttempts: vi.fn(),
  };
  return { portalAccountRepository, portalAccountChallengeRepository };
}

function validChallenge(overrides: Partial<PortalAccountChallengeRecord> = {}): PortalAccountChallengeRecord {
  return {
    id: 'challenge-1',
    portalAccountId: 'acct-1',
    purpose: 'SIGNUP',
    channel: 'EMAIL',
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    consumedAt: null,
    ...overrides,
  };
}

describe('VerifySignUpUseCase', () => {
  it('activates the account on a correct code', async () => {
    const deps = buildDeps(validChallenge(), true);
    await new VerifySignUpUseCase(deps).execute({ challengeId: 'challenge-1', code: '123456' });
    expect(deps.portalAccountRepository.update).toHaveBeenCalledWith('acct-1', expect.objectContaining({ status: 'ACTIVE' }));
  });

  it('throws PortalInvalidOtpError and increments attempts on a wrong code', async () => {
    const deps = buildDeps(validChallenge(), false);
    await expect(new VerifySignUpUseCase(deps).execute({ challengeId: 'challenge-1', code: 'wrong' })).rejects.toBeInstanceOf(
      PortalInvalidOtpError,
    );
    expect(deps.portalAccountChallengeRepository.incrementAttempts).toHaveBeenCalledWith('challenge-1');
    expect(deps.portalAccountRepository.update).not.toHaveBeenCalled();
  });

  it('throws PortalInvalidOtpError for an expired challenge, without calling verifyAndConsume', async () => {
    const deps = buildDeps(validChallenge({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(new VerifySignUpUseCase(deps).execute({ challengeId: 'challenge-1', code: '123456' })).rejects.toBeInstanceOf(
      PortalInvalidOtpError,
    );
    expect(deps.portalAccountChallengeRepository.verifyAndConsume).not.toHaveBeenCalled();
  });

  it('throws PortalInvalidOtpError for the wrong purpose (e.g. a PASSWORD_RESET challenge)', async () => {
    const deps = buildDeps(validChallenge({ purpose: 'PASSWORD_RESET' }));
    await expect(new VerifySignUpUseCase(deps).execute({ challengeId: 'challenge-1', code: '123456' })).rejects.toBeInstanceOf(
      PortalInvalidOtpError,
    );
  });

  it('throws PortalTooManyOtpAttemptsError once attempts reach the limit', async () => {
    const deps = buildDeps(validChallenge({ attempts: 5 }));
    await expect(new VerifySignUpUseCase(deps).execute({ challengeId: 'challenge-1', code: '123456' })).rejects.toBeInstanceOf(
      PortalTooManyOtpAttemptsError,
    );
    expect(deps.portalAccountChallengeRepository.verifyAndConsume).not.toHaveBeenCalled();
  });

  it('throws PortalInvalidOtpError when the challenge does not exist', async () => {
    const deps = buildDeps(null);
    await expect(new VerifySignUpUseCase(deps).execute({ challengeId: 'missing', code: '123456' })).rejects.toBeInstanceOf(
      PortalInvalidOtpError,
    );
  });
});
