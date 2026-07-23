import { describe, expect, it, vi } from 'vitest';
import { SignUpUseCase } from '@modules/client-portal/application/use-cases/SignUpUseCase';
import { PortalEmailAlreadyInUseError, PortalWeakPasswordError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import type { IPortalAccountRepository, PortalAccountRecord } from '@modules/client-portal/application/ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '@modules/client-portal/application/ports/IPortalAccountChallengeRepository';

const EXISTING: PortalAccountRecord = {
  id: 'acct-1',
  email: 'existing@example.com',
  passwordHash: 'hash',
  contactNumber: null,
  status: 'ACTIVE',
  emailVerifiedAt: new Date(),
  borrowerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildDeps(existing: PortalAccountRecord | null = null) {
  const portalAccountRepository: IPortalAccountRepository = {
    create: vi.fn().mockImplementation((input: { email: string; contactNumber?: string }) =>
      Promise.resolve({ ...EXISTING, id: 'new-acct', email: input.email, contactNumber: input.contactNumber ?? null, status: 'PENDING_VERIFICATION' }),
    ),
    findByEmail: vi.fn().mockResolvedValue(existing),
    findById: vi.fn(),
    update: vi.fn(),
  };
  const portalAccountChallengeRepository: IPortalAccountChallengeRepository = {
    create: vi.fn().mockResolvedValue({ id: 'challenge-1', code: '123456' }),
    findById: vi.fn(),
    verifyAndConsume: vi.fn(),
    incrementAttempts: vi.fn(),
  };
  const passwordHasher = { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() };
  const otpSender = { send: vi.fn().mockResolvedValue(undefined) };
  return { portalAccountRepository, portalAccountChallengeRepository, passwordHasher, otpSender };
}

describe('SignUpUseCase', () => {
  it('creates a PENDING_VERIFICATION account and sends an email OTP by default', async () => {
    const deps = buildDeps(null);
    const result = await new SignUpUseCase(deps).execute({ email: 'new@example.com', password: 'a-strong-password-123' });

    expect(deps.portalAccountRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', passwordHash: 'hashed' }),
    );
    expect(deps.otpSender.send).toHaveBeenCalledWith('EMAIL', 'new@example.com', '123456');
    expect(result).toEqual({ challengeId: 'challenge-1', channel: 'EMAIL' });
  });

  it('sends via SMS only when explicitly requested AND a contact number was given', async () => {
    const deps = buildDeps(null);
    await new SignUpUseCase(deps).execute({
      email: 'new@example.com',
      password: 'a-strong-password-123',
      contactNumber: '09171234567',
      verificationChannel: 'SMS',
    });
    expect(deps.otpSender.send).toHaveBeenCalledWith('SMS', '09171234567', '123456');
  });

  it('falls back to email when SMS is requested but no contact number was given', async () => {
    const deps = buildDeps(null);
    await new SignUpUseCase(deps).execute({ email: 'new@example.com', password: 'a-strong-password-123', verificationChannel: 'SMS' });
    expect(deps.otpSender.send).toHaveBeenCalledWith('EMAIL', 'new@example.com', '123456');
  });

  it('throws PortalEmailAlreadyInUseError when the email is already registered', async () => {
    const deps = buildDeps(EXISTING);
    await expect(new SignUpUseCase(deps).execute({ email: EXISTING.email, password: 'a-strong-password-123' })).rejects.toBeInstanceOf(
      PortalEmailAlreadyInUseError,
    );
    expect(deps.portalAccountRepository.create).not.toHaveBeenCalled();
  });

  it('resumes an abandoned (PENDING_VERIFICATION) sign-up instead of rejecting it - refreshes the password and issues a fresh challenge for the same account', async () => {
    const pending: PortalAccountRecord = { ...EXISTING, id: 'acct-pending', status: 'PENDING_VERIFICATION', contactNumber: '09171234567' };
    const deps = buildDeps(pending);
    deps.portalAccountRepository.update = vi.fn().mockResolvedValue({ ...pending, passwordHash: 'hashed' });

    const result = await new SignUpUseCase(deps).execute({ email: pending.email, password: 'a-new-strong-password-123' });

    expect(deps.portalAccountRepository.create).not.toHaveBeenCalled();
    expect(deps.portalAccountRepository.update).toHaveBeenCalledWith('acct-pending', { passwordHash: 'hashed' });
    expect(deps.otpSender.send).toHaveBeenCalledWith('EMAIL', pending.email, '123456');
    expect(result).toEqual({ challengeId: 'challenge-1', channel: 'EMAIL' });
  });

  it('throws PortalWeakPasswordError for a too-short password, without creating an account', async () => {
    const deps = buildDeps(null);
    await expect(new SignUpUseCase(deps).execute({ email: 'new@example.com', password: 'short' })).rejects.toBeInstanceOf(
      PortalWeakPasswordError,
    );
    expect(deps.portalAccountRepository.create).not.toHaveBeenCalled();
  });
});
