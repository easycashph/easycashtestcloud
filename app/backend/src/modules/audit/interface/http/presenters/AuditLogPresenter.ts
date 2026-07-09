import type { AuditLogRecord } from '../../../application/ports/IAuditLogRepository';

export interface AuditLogResponse {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export function presentAuditLog(record: AuditLogRecord): AuditLogResponse {
  return {
    id: record.id,
    userId: record.userId,
    userName: record.user ? `${record.user.firstName} ${record.user.lastName}` : null,
    userEmail: record.user?.email ?? null,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    previousValue: record.previousValue,
    newValue: record.newValue,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    createdAt: record.createdAt.toISOString(),
  };
}
