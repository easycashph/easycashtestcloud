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
  /**
   * Audit finding H-04: implementations MUST NOT throw. Audit logging is
   * observability for the primary operation it accompanies (e.g. login),
   * not a dependency of it — a failure here must never mask the real
   * result of that operation or leave it half-completed (e.g. a login
   * that already issued and persisted a refresh token, but then fails the
   * whole request because the audit write hiccuped). Implementations are
   * responsible for catching their own failures and reporting them
   * through their own means (structured logging, alerting, etc.) rather
   * than propagating them to the caller.
   */
  log(entry: AuditLogEntry): Promise<void>;
}
