import type { IUserRepository } from '../ports/IUserRepository';
import type { ITwoFactorChallengeRepository } from '../ports/ITwoFactorChallengeRepository';
import type { IOtpSender } from '../ports/IOtpSender';
import type { RequestTwoFactorSetupInput, RequestTwoFactorSetupOutput } from '../dtos/AuthDtos';
import { TwoFactorChannelUnavailableError, UserNotFoundError } from '../errors/AuthErrors';
import { OTP_CHALLENGE_TTL_MS } from './LoginUseCase';

export interface RequestTwoFactorSetupUseCaseDeps {
  userRepository: IUserRepository;
  twoFactorChallengeRepository: ITwoFactorChallengeRepository;
  otpSender: IOtpSender;
}

/**
 * Settings > Security > Two-Factor Authentication (2026-07-22) - step 1 of turning 2FA on: send a
 * verification code to the chosen channel. Deliberately does NOT flip `twoFactorEnabled` yet - that
 * only happens once ConfirmTwoFactorSetupUseCase proves the code was actually received, so a typo'd
 * phone number or unreachable inbox can never lock the account into a broken 2FA state.
 */
export class RequestTwoFactorSetupUseCase {
  constructor(private readonly deps: RequestTwoFactorSetupUseCaseDeps) {}

  async execute(input: RequestTwoFactorSetupInput): Promise<RequestTwoFactorSetupOutput> {
    const { userRepository, twoFactorChallengeRepository, otpSender } = this.deps;

    const user = await userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError();

    const destination = input.channel === 'EMAIL' ? user.email : user.contactNumber;
    if (!destination) throw new TwoFactorChannelUnavailableError(input.channel);

    const { id: challengeId, code } = await twoFactorChallengeRepository.create({
      userId: user.id,
      purpose: 'ENABLE',
      channel: input.channel,
      expiresAt: new Date(Date.now() + OTP_CHALLENGE_TTL_MS),
    });
    await otpSender.send(input.channel, destination, code);

    return { challengeId };
  }
}
