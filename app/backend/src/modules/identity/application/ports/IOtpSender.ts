import type { TwoFactorChannel } from './ITwoFactorChallengeRepository';

/** Settings > Security > Two-Factor Authentication (2026-07-22) - abstraction over "deliver this
 * OTP code somewhere," so the 2FA use cases depend on one port instead of reaching into
 * ISmsGateway/IEmailGateway (and the SMS_ENABLED/EMAIL_ENABLED dry-run flags) directly. */
export interface IOtpSender {
  send(channel: TwoFactorChannel, destination: string, code: string): Promise<void>;
}
