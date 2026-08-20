import type { MisPost } from '../../domain/MisPost';

export interface IMisPostRepository {
  findById(id: string): Promise<MisPost | null>;

  /** MIS-side admin listing (manual post history + the full rotation pool), newest first. */
  findManyForAdmin(): Promise<MisPost[]>;

  /** The single AUTO_ROTATION row currently flagged `isCurrentlyLive`, if any. */
  findCurrentLiveAutoPost(): Promise<MisPost | null>;

  /** Every AUTO_ROTATION row with `poolActive = true`, ordered by `poolOrder` ascending - the
   * rotation sequence the scheduler advances through. */
  findAutoRotationPool(): Promise<MisPost[]>;

  /** Every MANUAL post currently visible to borrowers: not withdrawn and not yet expired. */
  findActiveManualPosts(asOf: Date): Promise<MisPost[]>;

  save(post: MisPost): Promise<void>;

  delete(id: string): Promise<void>;
}
