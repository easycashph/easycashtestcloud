import type { SystemAnnouncement } from '../../domain/SystemAnnouncement';

export interface ISystemAnnouncementRepository {
  findById(id: string): Promise<SystemAnnouncement | null>;
  /** Newest first - backs the MIS admin list (full history, active and inactive). */
  findMany(): Promise<SystemAnnouncement[]>;
  /**
   * The single most recent row that is `active`, not expired, and targets the given audience -
   * or `null` if nothing currently qualifies. `asOf` is injected (not read server-side as `new
   * Date()` inside the repository) so `GetActiveSystemAnnouncementUseCase` stays testable with a
   * fixed clock.
   */
  findActiveForAudience(audience: 'LMS' | 'PORTAL', asOf: Date): Promise<SystemAnnouncement | null>;
  save(announcement: SystemAnnouncement): Promise<void>;
  delete(id: string): Promise<void>;
}
