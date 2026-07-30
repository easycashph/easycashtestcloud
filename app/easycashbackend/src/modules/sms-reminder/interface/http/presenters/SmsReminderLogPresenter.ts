import type { SmsReminderLogRow } from '../../../application/ports/ISmsReminderRepository';

export interface SmsReminderLogResponse {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  phoneNumber: string;
  message: string;
  triggerType: SmsReminderLogRow['triggerType'];
  triggerDate: string;
  status: SmsReminderLogRow['status'];
  providerTransId: string | null;
  errorMessage: string | null;
  sentAt: string;
  deliveredAt: string | null;
}

export function presentSmsReminderLog(row: SmsReminderLogRow): SmsReminderLogResponse {
  return {
    id: row.id,
    loanAccountId: row.loanAccountId,
    loanCode: row.loanCode,
    branchId: row.branchId,
    borrowerName: row.borrowerName,
    phoneNumber: row.phoneNumber,
    message: row.message,
    triggerType: row.triggerType,
    triggerDate: row.triggerDate.toISOString(),
    status: row.status,
    providerTransId: row.providerTransId,
    errorMessage: row.errorMessage,
    sentAt: row.sentAt.toISOString(),
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
  };
}
