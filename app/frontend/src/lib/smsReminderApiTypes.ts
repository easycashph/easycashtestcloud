/**
 * Mirrors `app/backend`'s `SmsReminderLogPresenter.presentSmsReminderLog()` JSON shape exactly -
 * see `apiClient.ts`'s doc comment for why this pilot hand-maintains DTOs instead of generating
 * them. One row per logged reminder-send attempt (SENT the moment M360 accepted it; DELIVERED/
 * UNDELIVERED/REJECTED once M360's DLR webhook reports the telco's real outcome; FAILED if M360
 * itself rejected the send).
 */
export type SmsReminderStatus = 'SENT' | 'DELIVERED' | 'UNDELIVERED' | 'REJECTED' | 'FAILED';

export interface SmsReminderLog {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  phoneNumber: string;
  message: string;
  status: SmsReminderStatus;
  providerTransId: string | null;
  errorMessage: string | null;
  sentAt: string;
  deliveredAt: string | null;
}
