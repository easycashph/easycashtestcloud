import type { SystemAnnouncement } from '../../../domain/SystemAnnouncement';

export function presentSystemAnnouncement(announcement: SystemAnnouncement) {
  const p = announcement.toProps();
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    type: p.type,
    showOnLms: p.showOnLms,
    showOnPortal: p.showOnPortal,
    active: p.active,
    expiresAt: p.expiresAt,
    createdByUserId: p.createdByUserId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
