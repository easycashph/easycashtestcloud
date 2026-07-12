/**
 * Profile Activity API Types
 * ADR-050: Profile Activity Timeline - track loan officer actions
 */

export type ProfileType = 'LOAN_APPLICATION' | 'BORROWER' | 'LOAN_ACCOUNT';

export interface ProfileActivityUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ProfileActivityLogRecord {
  id: string;
  profileType: ProfileType;
  profileId: string;
  user: ProfileActivityUser;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
  deletedByMisAt: string | null;
  formattedAction: string;
}

export interface GetProfileActivityResponse {
  activities: ProfileActivityLogRecord[];
  cursor?: string;
}
