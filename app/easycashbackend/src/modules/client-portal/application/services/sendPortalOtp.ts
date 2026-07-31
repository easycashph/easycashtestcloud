import type { IOtpSender } from '@modules/identity/application/ports/IOtpSender';
import type { PortalChallengeChannel } from '../ports/IPortalAccountChallengeRepository';
import { logger } from '@shared/logger/logger';

/**
 * Shared by every Portal use case that sends a verification code (SignUpUseCase,
 * PortalLoginUseCase, ResendSignUpOtpUseCase, ResendPortalLoginOtpUseCase,
 * RequestEnablePortalTwoFactorUseCase) - 'BOTH' (2026-07-30 user request) means the SAME code goes
 * out over both channels at once, not a choice between them. `IOtpSender.send()` only ever accepts
 * a single channel/destination pair, so 'BOTH' is two calls here rather than a change to that
 * shared (identity-module-owned) interface.
 *
 * 2026-07-31 (bug found in testing): each channel is sent independently (Promise.allSettled, not
 * sequential awaits) - a real gateway failure on ONE channel (e.g. SMS misconfigured/down) must
 * never fail the whole signup/login/resend when the OTHER channel's send genuinely succeeded; the
 * client still has a usable code. Only throws if EVERY attempted channel failed, since then the
 * client has no way to receive the code at all and the caller needs to know.
 */
export async function sendPortalOtp(
  otpSender: IOtpSender,
  channel: PortalChallengeChannel,
  email: string,
  contactNumber: string | null,
  code: string,
): Promise<void> {
  const attempts: Promise<void>[] = [];
  if (channel === 'EMAIL' || channel === 'BOTH') {
    attempts.push(otpSender.send('EMAIL', email, code));
  }
  if ((channel === 'SMS' || channel === 'BOTH') && contactNumber) {
    attempts.push(otpSender.send('SMS', contactNumber, code));
  }

  const results = await Promise.allSettled(attempts);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length > 0) {
    for (const failure of failures) {
      logger.error({ err: failure.reason }, 'Portal OTP send failed on one channel');
    }
    if (failures.length === results.length && failures[0]) {
      throw failures[0].reason;
    }
  }
}
