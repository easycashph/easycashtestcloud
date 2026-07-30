import type { AuditLogRecord, FindManyAuditLogsOptions, IAuditLogRepository } from '../ports/IAuditLogRepository';

export class ListAuditLogsUseCase {
  constructor(private readonly deps: { auditLogRepository: IAuditLogRepository }) {}

  async execute(options: FindManyAuditLogsOptions): Promise<AuditLogRecord[]> {
    return this.deps.auditLogRepository.findMany(options);
  }
}
