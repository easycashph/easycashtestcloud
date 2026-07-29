import type { EmailReminderLogRow } from '../../../application/ports/IEmailReminderRepository';

export interface EmailReminderLogResponse {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  recipientEmail: string;
  message: string;
  triggerType: EmailReminderLogRow['triggerType'];
  triggerDate: string;
  status: EmailReminderLogRow['status'];
  errorMessage: string | null;
  sentAt: string;
}

export function presentEmailReminderLog(row: EmailReminderLogRow): EmailReminderLogResponse {
  return {
    id: row.id,
    loanAccountId: row.loanAccountId,
    loanCode: row.loanCode,
    branchId: row.branchId,
    borrowerName: row.borrowerName,
    recipientEmail: row.recipientEmail,
    message: row.message,
    triggerType: row.triggerType,
    triggerDate: row.triggerDate.toISOString(),
    status: row.status,
    errorMessage: row.errorMessage,
    sentAt: row.sentAt.toISOString(),
  };
}
