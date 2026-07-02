/**
 * AUDIT-1 (Hard Rule): every significant action must be logged with user,
 * timestamp, action, previous/new value, IP, and user agent. Not in the
 * Milestone 6 plan's file list explicitly, but required by the plan's own
 * use-case descriptions (LoginUseCase "writes AuditLog entries for both
 * success and failure") — added as a small, directly-justified port.
 */
export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuditLogger {
  log(entry: AuditLogEntry): Promise<void>;
}
