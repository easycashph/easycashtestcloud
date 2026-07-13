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
}

export interface IAuditLogRepository {
  findMany(options: FindManyAuditLogsOptions): Promise<AuditLogRecord[]>;
}
