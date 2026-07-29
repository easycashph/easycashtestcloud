export interface ReminderSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  /** 2026-07-22 - e-signature signing-link/OTP SMS, separate from smsEnabled (payment reminders). */
  signingSmsEnabled: boolean;
  /** 2026-07-28 - e-signature signing-link EMAIL, an alternative channel to signingSmsEnabled
   * (some Smart-network numbers silently filter link-containing SMS). */
  signingEmailEnabled: boolean;
  /** 2026-07-23 - Easycash Portal signup/password-reset OTP email/SMS. Separate from staff 2FA,
   * which is NOT gated by this row (see schema.prisma's doc comment on these two fields). */
  portalEmailEnabled: boolean;
  portalSmsEnabled: boolean;
  updatedAt: Date;
  updatedByUserId: string | null;
}

export interface UpdateReminderSettingsInput {
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  signingSmsEnabled?: boolean;
  signingEmailEnabled?: boolean;
  portalEmailEnabled?: boolean;
  portalSmsEnabled?: boolean;
  updatedByUserId: string;
}

export interface IReminderSettingsRepository {
  /** Creates the singleton row (both false) on first call if it doesn't exist yet. */
  get(): Promise<ReminderSettings>;
  update(input: UpdateReminderSettingsInput): Promise<ReminderSettings>;
}
