import type { ISigningNotificationLogRepository, SigningNotificationLogRow } from '../ports/ISigningNotificationLogRepository';

export class ListSigningNotificationLogsUseCase {
  constructor(private readonly deps: { signingNotificationLogRepository: ISigningNotificationLogRepository }) {}

  async execute(branchId: string | undefined, loanAccountId?: string): Promise<SigningNotificationLogRow[]> {
    return this.deps.signingNotificationLogRepository.listLogs(branchId, loanAccountId);
  }
}
