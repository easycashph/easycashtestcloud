import { describe, expect, it, vi } from 'vitest';
import { PortalLoginUseCase } from '@modules/client-portal/application/use-cases/PortalLoginUseCase';
import { PortalAccountNotVerifiedError, PortalInvalidCredentialsError } from '@modules/client-portal/domain/errors/PortalAuthErrors';
import type { IPortalAccountRepository, PortalAccountRecord } from '@modules/client-portal/application/ports/IPortalAccountRepository';

const ACTIVE_ACCOUNT: PortalAccountRecord = {
  id: 'acct-1',
  email: 'client@example.com',
  passwordHash: 'hash',
  contactNumber: '09171234567',
  status: 'ACTIVE',
  emailVerifiedAt: new Date(),
  borrowerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildDeps(account: PortalAccountRecord | null, passwordMatches: boolean) {
  const portalAccountRepository: IPortalAccountRepository = {
    create: vi.fn(),
    findByEmail: vi.fn().mockResolvedValue(account),
    findById: vi.fn(),
    update: vi.fn(),
  };
  const passwordHasher = { hash: vi.fn(), compare: vi.fn().mockResolvedValue(passwordMatches) };
  const portalTokenService = {
    signAccessToken: vi.fn().mockReturnValue({ token: 'signed-token', expiresAt: new Date('2026-01-01') }),
    verifyAccessToken: vi.fn(),
  };
  return { portalAccountRepository, passwordHasher, portalTokenService };
}

describe('PortalLoginUseCase', () => {
  it('signs a token for a correct password on an ACTIVE account', async () => {
    const deps = buildDeps(ACTIVE_ACCOUNT, true);
    const result = await new PortalLoginUseCase(deps).execute({ email: ACTIVE_ACCOUNT.email, password: 'correct' });
    expect(deps.portalTokenService.signAccessToken).toHaveBeenCalledWith({ sub: 'acct-1', email: ACTIVE_ACCOUNT.email });
    expect(result.accessToken).toBe('signed-token');
    expect(result.account).toEqual({
      id: 'acct-1',
      email: ACTIVE_ACCOUNT.email,
      contactNumber: '09171234567',
      borrowerId: null,
    });
  });

  it('throws PortalInvalidCredentialsError for a wrong password, still comparing against a dummy hash for an unknown email', async () => {
    const deps = buildDeps(null, false);
    await expect(new PortalLoginUseCase(deps).execute({ email: 'unknown@example.com', password: 'x' })).rejects.toBeInstanceOf(
      PortalInvalidCredentialsError,
    );
    expect(deps.passwordHasher.compare).toHaveBeenCalled();
    expect(deps.portalTokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('throws PortalAccountNotVerifiedError for a correct password on a PENDING_VERIFICATION account', async () => {
    const deps = buildDeps({ ...ACTIVE_ACCOUNT, status: 'PENDING_VERIFICATION' }, true);
    await expect(new PortalLoginUseCase(deps).execute({ email: ACTIVE_ACCOUNT.email, password: 'correct' })).rejects.toBeInstanceOf(
      PortalAccountNotVerifiedError,
    );
    expect(deps.portalTokenService.signAccessToken).not.toHaveBeenCalled();
  });
});
