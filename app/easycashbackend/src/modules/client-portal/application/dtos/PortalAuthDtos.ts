import type { PortalChallengeChannel } from '../ports/IPortalAccountChallengeRepository';

export interface SignUpInput {
  email: string;
  password: string;
  contactNumber?: string;
}

export interface SignUpOutput {
  challengeId: string;
  channel: PortalChallengeChannel;
}

export interface VerifySignUpInput {
  challengeId: string;
  code: string;
}

/** Signup verification resend (2026-07-30 user request) - "Request another code" on the Verify
 * Email screen. Mirrors ResendPortalLoginOtpInput's shape/reasoning exactly. */
export interface ResendSignUpOtpInput {
  challengeId: string;
}

export interface PortalLoginInput {
  email: string;
  password: string;
  /** "Remember this device" (2026-07-30 user request). */
  deviceToken?: string;
}

export interface PortalAuthenticatedAccountView {
  id: string;
  email: string;
  contactNumber: string | null;
  borrowerId: string | null;
  twoFactorEnabled: boolean;
  twoFactorChannel: PortalChallengeChannel | null;
}

export interface PortalLoginOutput {
  accessToken: string;
  accessTokenExpiresAt: Date;
  account: PortalAuthenticatedAccountView;
  /** "Remember this device" (2026-07-30) - present only when the client checked the box on the OTP
   * step and a new PortalTrustedDevice was just issued. */
  deviceToken?: string;
}

/** Login 2FA (2026-07-30) - PortalLoginUseCase returns this instead of tokens when the account has
 * 2FA enabled; the caller must complete VerifyPortalLoginOtpUseCase next. Mirrors identity's own
 * LoginResult union shape. */
export interface PortalLoginTwoFactorRequired {
  twoFactorRequired: true;
  challengeId: string;
  channel: PortalChallengeChannel;
}

export type PortalLoginResult = PortalLoginOutput | PortalLoginTwoFactorRequired;

export interface VerifyPortalLoginOtpInput {
  challengeId: string;
  code: string;
  /** "Remember this device" (2026-07-30 user request). */
  rememberDevice?: boolean;
}

/** Login 2FA resend (2026-07-30 user request) - a client stuck on the OTP step (didn't receive
 * the code, let it expire) can request a fresh one for the same in-progress login, rather than
 * having to go back and re-enter their password. */
export interface ResendPortalLoginOtpInput {
  challengeId: string;
}

export interface RequestEnablePortalTwoFactorInput {
  portalAccountId: string;
  channel: PortalChallengeChannel;
}

export interface RequestEnablePortalTwoFactorOutput {
  challengeId: string;
}

export interface ConfirmEnablePortalTwoFactorInput {
  portalAccountId: string;
  challengeId: string;
  code: string;
}

export interface DisablePortalTwoFactorInput {
  portalAccountId: string;
  currentPassword: string;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface RequestPasswordResetOutput {
  /** Always returned, even when the email doesn't match any account - same enumeration-avoidance
   * posture as the rest of this system's auth flows. The frontend shows the same "check your
   * email" message either way; only a real account actually gets a code. */
  challengeId: string | null;
}

export interface ConfirmPasswordResetInput {
  challengeId: string;
  code: string;
  newPassword: string;
}
