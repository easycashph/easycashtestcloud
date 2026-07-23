export interface ReminderSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  /** 2026-07-22 - e-signature signing-link/OTP SMS, separate from smsEnabled (payment reminders). */
  signingSmsEnabled: boolean;
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
  portalEmailEnabled?: boolean;
  portalSmsEnabled?: boolean;
  updatedByUserId: string;
}

export interface IReminderSettingsRepository {
  /** Creates the singleton row (both false) on first call if it doesn't exist yet. */
  get(): Promise<ReminderSettings>;
  update(input: UpdateReminderSettingsInput): Promise<ReminderSettings>;
}
