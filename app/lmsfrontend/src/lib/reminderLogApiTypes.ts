import type { ReminderTriggerType } from './smsReminderApiTypes';
import type { SmsReminderLog } from './smsReminderApiTypes';
import type { EmailReminderLog } from './emailReminderApiTypes';

export type { ReminderTriggerType };

export type ReminderChannel = 'SMS' | 'EMAIL';
export type ReminderLogStatus = 'SENT' | 'DELIVERED' | 'UNDELIVERED' | 'REJECTED' | 'FAILED';

/**
 * Unified view over `SmsReminderLog` + `EmailReminderLog` (2026-07-18 user request: "para malaman
 * ng user ng system... saan galing ang reminder, SMS or Email") - merged client-side from the two
 * existing endpoints rather than a new backend endpoint, since both already return everything
 * needed and this is purely a display convenience. `deliveredAt`/`providerTransId` stay null for
 * every EMAIL row - plain SMTP has no delivery-confirmation webhook like M360's DLR.
 */
export interface ReminderLog {
  id: string;
  channel: ReminderChannel;
  loanAccountId: string;
  loanCode: string;
  borrowerName: string;
  recipient: string;
  message: string;
  triggerType: ReminderTriggerType;
  triggerDate: string;
  status: ReminderLogStatus;
  errorMessage: string | null;
  sentAt: string;
  deliveredAt: string | null;
  providerTransId: string | null;
}

export function mergeReminderLogs(smsLogs: SmsReminderLog[], emailLogs: EmailReminderLog[]): ReminderLog[] {
  const fromSms: ReminderLog[] = smsLogs.map((log) => ({
    id: `sms-${log.id}`,
    channel: 'SMS',
    loanAccountId: log.loanAccountId,
    loanCode: log.loanCode,
    borrowerName: log.borrowerName,
    recipient: log.phoneNumber,
    message: log.message,
    triggerType: log.triggerType,
    triggerDate: log.triggerDate,
    status: log.status,
    errorMessage: log.errorMessage,
    sentAt: log.sentAt,
    deliveredAt: log.deliveredAt,
    providerTransId: log.providerTransId,
  }));
  const fromEmail: ReminderLog[] = emailLogs.map((log) => ({
    id: `email-${log.id}`,
    channel: 'EMAIL',
    loanAccountId: log.loanAccountId,
    loanCode: log.loanCode,
    borrowerName: log.borrowerName,
    recipient: log.recipientEmail,
    message: log.message,
    triggerType: log.triggerType,
    triggerDate: log.triggerDate,
    status: log.status,
    errorMessage: log.errorMessage,
    sentAt: log.sentAt,
    deliveredAt: null,
    providerTransId: null,
  }));
  return [...fromSms, ...fromEmail];
}
