import { randomUUID } from 'node:crypto';
import type { IUserRepository } from '../ports/IUserRepository';
import type { ITwoFactorChallengeRepository } from '../ports/ITwoFactorChallengeRepository';
import type { IOtpSender } from '../ports/IOtpSender';
import type { RequestPasswordResetInput, RequestPasswordResetOutput } from '../dtos/AuthDtos';

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export interface RequestPasswordResetUseCaseDeps {
  userRepository: IUserRepository;
  twoFactorChallengeRepository: ITwoFactorChallengeRepository;
  otpSender: IOtpSender;
}

/**
 * Forgot Password (2026-07-28) - staff/LMS equivalent of the client-portal module's
 * RequestPasswordResetUseCase, same enumeration-avoidance shape: a real challengeId is returned
 * for every syntactically-accepted email, whether or not it matches an active user, so a caller
 * can never learn which staff emails exist by probing this endpoint. Only a match with an ACTIVE
 * user actually gets an emailed code - a non-matching or inactive email's returned challengeId
 * simply never verifies against anything in ConfirmPasswordResetUseCase, failing exactly like a
 * wrong code would.
 *
 * Reuses the same TwoFactorChallenge table as 2FA login (`purpose: 'PASSWORD_RESET'`) and the same
 * `IOtpSender` already wired for 2FA - no new infrastructure.
 *
 * Always sent by EMAIL, never SMS: unlike 2FA (where the user is already logged in and picked a
 * channel), a locked-out user's contact number on file may itself be stale, and email is the
 * conventional reset channel.
 */
export class RequestPasswordResetUseCase {
  constructor(private readonly deps: RequestPasswordResetUseCaseDeps) {}

  async execute(input: RequestPasswordResetInput): Promise<RequestPasswordResetOutput> {
    const { userRepository, twoFactorChallengeRepository, otpSender } = this.deps;

    const user = await userRepository.findByEmail(input.email);

    if (!user || user.status !== 'ACTIVE') {
      // Same-shaped response, no challenge actually created - see class doc comment.
      return { challengeId: randomUUID() };
    }

    const { id: challengeId, code } = await twoFactorChallengeRepository.create({
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      channel: 'EMAIL',
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
    await otpSender.send('EMAIL', user.email, code);

    return { challengeId };
  }
}
