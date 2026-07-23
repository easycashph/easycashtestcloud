import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import { PasswordPolicy } from '@modules/identity/domain/PasswordPolicy';
import type { SignUpInput, SignUpOutput } from '../dtos/PortalAuthDtos';
import { PortalEmailAlreadyInUseError, PortalWeakPasswordError } from '../../domain/errors/PortalAuthErrors';

export const PORTAL_OTP_TTL_MS = 5 * 60 * 1000;

export interface SignUpUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  portalAccountChallengeRepository: IPortalAccountChallengeRepository;
  passwordHasher: IPasswordHasher;
  otpSender: IOtpSender;
}

/**
 * Easycash Portal (2026-07-23, Phase 1) - open sign-up, no existing Client/Borrower record
 * required (per user decision 2026-07-23). The account starts PENDING_VERIFICATION and cannot log
 * in until VerifySignUpUseCase confirms the emailed/texted code - never skippable, per the same
 * user decision.
 */
export class SignUpUseCase {
  constructor(private readonly deps: SignUpUseCaseDeps) {}

  async execute(input: SignUpInput): Promise<SignUpOutput> {
    const { portalAccountRepository, portalAccountChallengeRepository, passwordHasher, otpSender } = this.deps;

    const existing = await portalAccountRepository.findByEmail(input.email);
    if (existing) throw new PortalEmailAlreadyInUseError();

    const violations = PasswordPolicy.validate(input.password);
    if (violations.length > 0) throw new PortalWeakPasswordError(violations);

    const passwordHash = await passwordHasher.hash(input.password);
    const account = await portalAccountRepository.create({
      email: input.email,
      passwordHash,
      contactNumber: input.contactNumber,
    });

    // SMS only if explicitly requested AND a contact number was actually given - defaults to
    // email otherwise, since email is the only field this use case requires.
    const channel = input.verificationChannel === 'SMS' && input.contactNumber ? 'SMS' : 'EMAIL';
    const destination = channel === 'SMS' ? input.contactNumber! : input.email;

    const { id: challengeId, code } = await portalAccountChallengeRepository.create({
      portalAccountId: account.id,
      purpose: 'SIGNUP',
      channel,
      expiresAt: new Date(Date.now() + PORTAL_OTP_TTL_MS),
    });
    await otpSender.send(channel, destination, code);

    return { challengeId, channel };
  }
}
