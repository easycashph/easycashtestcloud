import type { AuditLogRecord } from '../../../application/ports/IAuditLogRepository';

/** Settings > Security > Recent Sign-in Activity (2026-07-21) - deliberately narrower than
 * `AuditLogResponse`: no `user`/`userId` (always the caller, self-scoped server-side), no
 * `previousValue`/`newValue` (LOGIN_SUCCESS/LOGIN_FAILED never carry either). Unlike
 * `RecentActivityResponse`, this DOES include ipAddress/userAgent - it's the user's own security
 * data about their own account, not a cross-user activity feed. */
export interface LoginActivityResponse {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export function presentLoginActivity(record: AuditLogRecord): LoginActivityResponse {
  return {
    id: record.id,
    action: record.action,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    createdAt: record.createdAt.toISOString(),
  };
}
