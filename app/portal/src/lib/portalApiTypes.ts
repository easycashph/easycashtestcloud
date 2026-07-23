/** Mirrors app/backend's client-portal module DTOs/presenters exactly - see apiClient.ts's doc
 * comment for why this hand-maintains the shape instead of generating it (same reasoning as the
 * internal LMS frontend's own apiClient.ts). */

export interface SignUpRequest {
  email: string;
  password: string;
  contactNumber?: string;
  verificationChannel?: 'EMAIL' | 'SMS';
}

export interface SignUpResponse {
  challengeId: string;
  channel: 'EMAIL' | 'SMS';
}

export interface VerifySignUpRequest {
  challengeId: string;
  code: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PortalAccountView {
  id: string;
  email: string;
  contactNumber: string | null;
  borrowerId: string | null;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  account: PortalAccountView;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  challengeId: string | null;
}

export interface ResetPasswordRequest {
  challengeId: string;
  code: string;
  newPassword: string;
}

export type MeResponse = PortalAccountView;
