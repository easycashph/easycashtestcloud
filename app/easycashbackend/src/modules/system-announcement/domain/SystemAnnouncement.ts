import { randomUUID } from 'node:crypto';

export type SystemAnnouncementType = 'MAINTENANCE' | 'NEWS' | 'GENERAL';

export interface SystemAnnouncementProps {
  id: string;
  title: string;
  body: string;
  type: SystemAnnouncementType;
  showOnLms: boolean;
  showOnPortal: boolean;
  active: boolean;
  expiresAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSystemAnnouncementProps {
  title: string;
  body: string;
  type: SystemAnnouncementType;
  showOnLms: boolean;
  showOnPortal: boolean;
  expiresAt: Date | null;
  createdByUserId: string;
}

export interface UpdateSystemAnnouncementProps {
  title?: string;
  body?: string;
  type?: SystemAnnouncementType;
  showOnLms?: boolean;
  showOnPortal?: boolean;
  active?: boolean;
  expiresAt?: Date | null;
}

/**
 * System-wide announcement popup (2026-08-14 user request) - MIS-authored content shown to LMS
 * staff and/or Portal clients so they get advance notice of scheduled/emergency maintenance or
 * other system-wide news, instead of being caught off guard by unexpected downtime.
 */
export class SystemAnnouncement {
  private constructor(private props: SystemAnnouncementProps) {}

  static create(input: CreateSystemAnnouncementProps): SystemAnnouncement {
    const now = new Date();
    return new SystemAnnouncement({
      id: randomUUID(),
      title: input.title,
      body: input.body,
      type: input.type,
      showOnLms: input.showOnLms,
      showOnPortal: input.showOnPortal,
      active: true,
      expiresAt: input.expiresAt,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: SystemAnnouncementProps): SystemAnnouncement {
    return new SystemAnnouncement(props);
  }

  update(patch: UpdateSystemAnnouncementProps): void {
    if (patch.title !== undefined) this.props.title = patch.title;
    if (patch.body !== undefined) this.props.body = patch.body;
    if (patch.type !== undefined) this.props.type = patch.type;
    if (patch.showOnLms !== undefined) this.props.showOnLms = patch.showOnLms;
    if (patch.showOnPortal !== undefined) this.props.showOnPortal = patch.showOnPortal;
    if (patch.active !== undefined) this.props.active = patch.active;
    if (patch.expiresAt !== undefined) this.props.expiresAt = patch.expiresAt;
    this.props.updatedAt = new Date();
  }

  toProps(): SystemAnnouncementProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }
}
