import { randomUUID } from 'node:crypto';

export type MisPostType = 'AUTO_ROTATION' | 'MANUAL';

export interface MisPostProps {
  id: string;
  type: MisPostType;
  caption: string;
  imageStorageKey: string;
  imageFileName: string;
  imageFileType: string;
  poolOrder: number | null;
  poolActive: boolean;
  isCurrentlyLive: boolean;
  publishedAt: Date | null;
  expiresAt: Date | null;
  withdrawn: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAutoRotationPostProps {
  caption: string;
  imageStorageKey: string;
  imageFileName: string;
  imageFileType: string;
  poolOrder: number;
  createdByUserId: string | null;
}

export interface CreateManualPostProps {
  caption: string;
  imageStorageKey: string;
  imageFileName: string;
  imageFileType: string;
  durationMinutes: number;
  createdByUserId: string;
}

/**
 * MIS-authored Portal post (2026-08-20 user request) - see the Prisma `MisPost` model's own doc
 * comment for why AUTO_ROTATION and MANUAL share one entity. Kept deliberately thin - the
 * interesting behavior (advancing the rotation, expiring a manual post) lives in use cases that
 * operate over many rows at once, not as a method on a single instance.
 */
export class MisPost {
  private constructor(private props: MisPostProps) {}

  static createAutoRotationPost(input: CreateAutoRotationPostProps): MisPost {
    const now = new Date();
    return new MisPost({
      id: randomUUID(),
      type: 'AUTO_ROTATION',
      caption: input.caption,
      imageStorageKey: input.imageStorageKey,
      imageFileName: input.imageFileName,
      imageFileType: input.imageFileType,
      poolOrder: input.poolOrder,
      poolActive: true,
      isCurrentlyLive: false,
      publishedAt: null,
      expiresAt: null,
      withdrawn: false,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static createManualPost(input: CreateManualPostProps): MisPost {
    if (input.durationMinutes <= 0) {
      throw new Error('durationMinutes must be positive');
    }
    const now = new Date();
    return new MisPost({
      id: randomUUID(),
      type: 'MANUAL',
      caption: input.caption,
      imageStorageKey: input.imageStorageKey,
      imageFileName: input.imageFileName,
      imageFileType: input.imageFileType,
      poolOrder: null,
      poolActive: false,
      isCurrentlyLive: false,
      publishedAt: now,
      expiresAt: new Date(now.getTime() + input.durationMinutes * 60_000),
      withdrawn: false,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: MisPostProps): MisPost {
    return new MisPost(props);
  }

  withdraw(): void {
    this.props.withdrawn = true;
    this.props.updatedAt = new Date();
  }

  setIsCurrentlyLive(value: boolean): void {
    this.props.isCurrentlyLive = value;
    this.props.updatedAt = new Date();
  }

  toProps(): MisPostProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get type(): MisPostType {
    return this.props.type;
  }

  get poolOrder(): number | null {
    return this.props.poolOrder;
  }
}
