export interface AuditLogUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  user: AuditLogUser | null;
  action: string;
  entityType: string;
  entityId: string;
  /** Human-readable label for entityId (LoanAccount.loanCode, LoanApplication.applicantName) - null when entityType has no known label source, or the record no longer exists. */
  entityLabel: string | null;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface FindManyAuditLogsOptions {
  limit: number;
  cursor?: string;
  /** Case-insensitive match against action/entityType/entityId or the acting user's first/last name. */
  search?: string;
  /** Exact match against one or more entityType values (e.g. ["Dashboard"] for a page's own view events, or ["LoanApplication", "Loan Applications"] to combine write and view events for one section). */
  entityTypes?: string[];
  /** Exact match — scopes results to a single record (e.g. one loan application's id), across both view and write events that share it. */
  entityId?: string;
  /** Excludes rows whose action is in this list (e.g. ["VIEW_SECTION"] for a widget that only wants write actions - page views vastly outnumber them, so filtering client-side after the fact starves `limit`). */
  excludeActions?: string[];
  /** Inclusive counterpart to `excludeActions` (2026-07-21, Settings > Security > Recent Sign-in
   * Activity) - only rows whose action is in this list, e.g. ["LOGIN_SUCCESS", "LOGIN_FAILED"]. */
  actions?: string[];
  /** Exact match against the *acting* user (2026-07-21, same feature as `actions` above) - lets a
   * caller self-scope to "my own" entries without a separate query method. */
  userId?: string;
}

export interface IAuditLogRepository {
  findMany(options: FindManyAuditLogsOptions): Promise<AuditLogRecord[]>;
}
