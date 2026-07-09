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
}

export interface IAuditLogRepository {
  findMany(options: FindManyAuditLogsOptions): Promise<AuditLogRecord[]>;
}
