/** Mirrors `app/backend`'s `SecuritySettingsPresenter.presentSecuritySettings()` JSON shape
 * exactly - MIS-only platform-wide security policy toggles (2026-08-28 user request, "Require 2FA
 * for all users"). Same singleton-row pattern as `ReminderSettings`, kept as its own type/table
 * since it's a security policy, not a messaging channel toggle. */
export interface SecuritySettings {
  enforceTwoFactorForAllUsers: boolean;
  updatedAt: string;
  updatedByUserId: string | null;
}
