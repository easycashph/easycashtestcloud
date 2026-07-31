import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { IPortalAccountChallengeRepository } from '../ports/IPortalAccountChallengeRepository';
import type { IPasswordHasher } from '@modules/identity/application/ports/IPasswordHasher';
import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import { PasswordPolicy } from '@modules/identity/domain/PasswordPolicy';
import type { SignUpInput, SignUpOutput } from '../dtos/PortalAuthDtos';
import { PortalEmailAlreadyInUseError, PortalWeakPasswordError } from '../../domain/errors/PortalAuthErrors';
import { sendPortalOtp } from '../services/sendPortalOtp';

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

    const violations = PasswordPolicy.validate(input.password);
    if (violations.length > 0) throw new PortalWeakPasswordError(violations);

    const existing = await portalAccountRepository.findByEmail(input.email);
    // A genuinely ACTIVE (already-verified) account is a real conflict. But a PENDING_VERIFICATION
    // account from an earlier abandoned sign-up (closed the tab before entering the code, code
    // expired, etc.) has no way to ever complete sign-up otherwise - there's no separate "resend
    // code" flow, so re-submitting the sign-up form is the only recovery path a client has. Resume
    // it instead of rejecting: refresh the password (in case they mistyped it the first time) and
    // issue a fresh OTP challenge for the SAME account, rather than creating a duplicate.
    if (existing && existing.status === 'ACTIVE') throw new PortalEmailAlreadyInUseError();

    const passwordHash = await passwordHasher.hash(input.password);
    const account = existing
      ? await portalAccountRepository.update(existing.id, { passwordHash })
      : await portalAccountRepository.create({
          email: input.email,
          passwordHash,
          contactNumber: input.contactNumber,
        });

    // 2026-07-30 (user request): always both email AND SMS when a contact number was actually
    // given - not a choice between them anymore. Email-only when no contact number was provided,
    // since that's the only field this use case requires. On a resumed sign-up,
    // `account.contactNumber` (not `input.contactNumber`) is authoritative - the update above can't
    // change it (see UpdatePortalAccountInput), so it always reflects what was captured originally.
    const channel = account.contactNumber ? 'BOTH' : 'EMAIL';

    const { id: challengeId, code } = await portalAccountChallengeRepository.create({
      portalAccountId: account.id,
      purpose: 'SIGNUP',
      channel,
      expiresAt: new Date(Date.now() + PORTAL_OTP_TTL_MS),
    });
    await sendPortalOtp(otpSender, channel, input.email, account.contactNumber, code);

    return { challengeId, channel };
  }
}
