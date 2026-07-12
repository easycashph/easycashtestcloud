/**
 * Profile Activity Log Repository Port
 *
 * Abstracts persistence of profile activity logs.
 * Implementations: PrismaProfileActivityLogRepository
 */

import type { ProfileActivityLog, ProfileType } from '../../domain/ProfileActivityLog';

export interface FindManyProfileActivityLogsOptions {
  profileType: ProfileType;
  profileId: string;
  limit: number;
  cursor?: string;
  action?: string; // Optional filter by action type
}

export interface IProfileActivityLogRepository {
  /**
   * Create and persist a new profile activity log entry.
   * @throws on database errors
   */
  save(activity: ProfileActivityLog): Promise<ProfileActivityLog>;

  /**
   * Find many activities for a specific profile, cursor-paginated.
   * Returns newest first.
   */
  findMany(
    options: FindManyProfileActivityLogsOptions,
  ): Promise<{ activities: ProfileActivityLog[]; cursor?: string }>;

  /**
   * Find a single activity by ID.
   * Returns null if not found or if deleted.
   */
  findById(id: string): Promise<ProfileActivityLog | null>;

  /**
   * Soft-delete an activity (set deletedByMisAt).
   * Only MIS can do this (authorization handled upstream).
   */
  softDeleteById(id: string): Promise<ProfileActivityLog>;
}
