/**
 * Profile Activity Log Domain Model
 *
 * Represents an immutable activity record tied to a specific profile
 * (LoanApplication, Borrower, or LoanAccount).
 *
 * ADR-050: immutable after creation, soft-delete only by MIS.
 */

export type ProfileType = 'LOAN_APPLICATION' | 'BORROWER' | 'LOAN_ACCOUNT';

export interface ProfileActivityLogRecord {
  id: string;
  profileType: ProfileType;
  profileId: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  visibilityRestricted: boolean;
  createdAt: Date;
  deletedByMisAt: Date | null;
}

/**
 * Domain representation of a profile activity log entry.
 * Used internally for business logic; DTOs/Presenters handle HTTP transfer.
 */
export class ProfileActivityLog {
  private constructor(
    readonly id: string,
    readonly profileType: ProfileType,
    readonly profileId: string,
    readonly userId: string,
    readonly action: string,
    readonly details: Record<string, unknown>,
    readonly visibilityRestricted: boolean,
    readonly createdAt: Date,
    readonly deletedByMisAt: Date | null,
  ) {}

  static create(
    id: string,
    profileType: ProfileType,
    profileId: string,
    userId: string,
    action: string,
    details: Record<string, unknown>,
    visibilityRestricted: boolean = false,
  ): ProfileActivityLog {
    return new ProfileActivityLog(
      id,
      profileType,
      profileId,
      userId,
      action,
      details,
      visibilityRestricted,
      new Date(),
      null,
    );
  }

  static fromRecord(record: ProfileActivityLogRecord): ProfileActivityLog {
    return new ProfileActivityLog(
      record.id,
      record.profileType,
      record.profileId,
      record.userId,
      record.action,
      record.details,
      record.visibilityRestricted,
      record.createdAt,
      record.deletedByMisAt,
    );
  }

  isDeleted(): boolean {
    return this.deletedByMisAt !== null;
  }

  markDeletedByMis(): ProfileActivityLog {
    return new ProfileActivityLog(
      this.id,
      this.profileType,
      this.profileId,
      this.userId,
      this.action,
      this.details,
      this.visibilityRestricted,
      this.createdAt,
      new Date(),
    );
  }
}
