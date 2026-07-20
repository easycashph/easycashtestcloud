import type { EmailReminderLogRow, IEmailReminderRepository } from '../ports/IEmailReminderRepository';

export class ListEmailReminderLogsUseCase {
  constructor(private readonly deps: { emailReminderRepository: IEmailReminderRepository }) {}

  async execute(branchId: string | undefined, loanAccountId?: string): Promise<EmailReminderLogRow[]> {
    return this.deps.emailReminderRepository.listLogs(branchId, loanAccountId);
  }
}
