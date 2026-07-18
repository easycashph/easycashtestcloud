export interface ReminderSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: Date;
  updatedByUserId: string | null;
}

export interface UpdateReminderSettingsInput {
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  updatedByUserId: string;
}

export interface IReminderSettingsRepository {
  /** Creates the singleton row (both false) on first call if it doesn't exist yet. */
  get(): Promise<ReminderSettings>;
  update(input: UpdateReminderSettingsInput): Promise<ReminderSettings>;
}
