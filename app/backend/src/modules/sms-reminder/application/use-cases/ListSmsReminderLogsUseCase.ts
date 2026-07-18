import type { ISmsReminderRepository, SmsReminderLogRow } from '../ports/ISmsReminderRepository';

export class ListSmsReminderLogsUseCase {
  constructor(private readonly deps: { smsReminderRepository: ISmsReminderRepository }) {}

  async execute(branchId: string | undefined): Promise<SmsReminderLogRow[]> {
    return this.deps.smsReminderRepository.listLogs(branchId);
  }
}
