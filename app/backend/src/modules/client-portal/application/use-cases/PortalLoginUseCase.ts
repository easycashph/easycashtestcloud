import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import type { IPortalTokenService } from '../ports/IPortalTokenService';
import type { PortalLoginInput, PortalLoginOutput } from '../dtos/PortalAuthDtos';
import { PortalInvalidCredentialsError, PortalAccountNotVerifiedError } from '../../domain/errors/PortalAuthErrors';

export interface PortalLoginUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  passwordHasher: IPasswordHasher;
  portalTokenService: IPortalTokenService;
}

/** Easycash Portal (2026-07-23, Phase 1) - v1 scope: a single access token, no refresh-token
 * rotation yet (see PORTAL_JWT_TTL's doc comment in shared/config/env.ts). */
export class PortalLoginUseCase {
  constructor(private readonly deps: PortalLoginUseCaseDeps) {}

  async execute(input: PortalLoginInput): Promise<PortalLoginOutput> {
    const { portalAccountRepository, passwordHasher, portalTokenService } = this.deps;

    const account = await portalAccountRepository.findByEmail(input.email);

    // Always run a bcrypt comparison, even for an unknown email, against a fixed dummy hash -
    // same timing-attack mitigation as identity's LoginUseCase.
    const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO0Ku4CU9jGkxN.zn.b3F2hAtBcqfNjGO';
    const passwordMatches = await passwordHasher.compare(input.password, account?.passwordHash ?? DUMMY_HASH);

    if (!account || !passwordMatches) {
      throw new PortalInvalidCredentialsError();
    }
    if (account.status !== 'ACTIVE') {
      throw new PortalAccountNotVerifiedError();
    }

    const { token, expiresAt } = portalTokenService.signAccessToken({ sub: account.id, email: account.email });

    return {
      accessToken: token,
      accessTokenExpiresAt: expiresAt,
      account: {
        id: account.id,
        email: account.email,
        contactNumber: account.contactNumber,
        borrowerId: account.borrowerId,
      },
    };
  }
}
