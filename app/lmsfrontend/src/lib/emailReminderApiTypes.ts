import type { ReminderTriggerType } from './smsReminderApiTypes';

export type { ReminderTriggerType };

/**
 * Mirrors `app/backend`'s `EmailReminderLogPresenter.presentEmailReminderLog()` JSON shape exactly
 * - see `smsReminderApiTypes.ts`'s sibling doc comment. No DLR-equivalent here - plain SMTP only
 * reports accept/reject at send time, so status only ever ends at SENT or FAILED.
 */
export type EmailReminderStatus = 'SENT' | 'FAILED';

export interface EmailReminderLog {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  recipientEmail: string;
  message: string;
  triggerType: ReminderTriggerType;
  triggerDate: string;
  status: EmailReminderStatus;
  errorMessage: string | null;
  sentAt: string;
}
