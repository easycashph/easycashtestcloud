import type { ReminderTriggerType, SmsReminderCandidate } from './ports/ISmsReminderRepository';

/**
 * Configurable per CLAUDE.md ("financial rules must be configurable rather than hard-coded") -
 * one default template per trigger type, each independently overridable via its own
 * SMS_REMINDER_TEMPLATE_<TRIGGER> env var. The 4 date-anchored triggers use {borrowerName},
 * {loanCode}, {amountDue}, {dueDate} (the next-due installment only); PAST_DUE_WEEKLY instead uses
 * {daysLate}/{totalAmountDue} (summed across every overdue installment) - see this file's
 * `renderReminderMessage` for which placeholders are actually substituted per trigger.
 * All user-approved 2026-07-18, plain GSM-7 characters only (no em-dash/peso sign - either one
 * forces the whole SMS into UCS-2 encoding at 70 chars/segment instead of 160, multiplying cost
 * for zero visible difference to the recipient - see SESSION_LOG_2026-07-18 for the measured
 * before/after).
 */
const DEFAULT_TEMPLATES: Record<ReminderTriggerType, string> = {
  FIVE_DAYS_BEFORE: `Easycash Lending Company Inc. - Payment Reminder

Hi {borrowerName}

This is a friendly reminder regarding your loan account {loanCode} amounting to PHP {amountDue}, is due on {dueDate}.

To avoid additional penalties and charges, please settle your payment on or before the due date.

If you have already made your payment, please disregard this reminder.
Thank you for your continued trust in Easycash Lending Company Inc.`,

  THREE_DAYS_BEFORE: `Easycash Lending Company Inc. - Payment Reminder

Hi {borrowerName}

Your loan account {loanCode} amounting to PHP {amountDue} is due in 3 days, on {dueDate}.

Please settle your payment on or before the due date to avoid additional penalties and charges.

If you have already made your payment, please disregard this reminder.
Thank you for your continued trust in Easycash Lending Company Inc.`,

  ONE_DAY_BEFORE: `Easycash Lending Company Inc. - Payment Reminder

Hi {borrowerName}

Your loan account {loanCode} amounting to PHP {amountDue} is due tomorrow, {dueDate}.

Please settle your payment on or before the due date to avoid additional penalties and charges.

If you have already made your payment, please disregard this reminder.
Thank you for your continued trust in Easycash Lending Company Inc.`,

  DUE_DATE: `Easycash Lending Company Inc. - Payment Reminder

Hi {borrowerName}

Your loan account {loanCode} amounting to PHP {amountDue} is due TODAY, {dueDate}.

Please settle your payment today to avoid additional penalties and charges.

If you have already made your payment, please disregard this reminder.
Thank you for your continued trust in Easycash Lending Company Inc.`,

  PAST_DUE_WEEKLY:
    'Easycash Reminder: Dear {borrowerName}, your Loan Account is {daysLate} day(s) past due. Total amount due: Php {totalAmountDue} (inclusive of penalties). Please settle your account at your earliest convenience. If already paid, kindly disregard this message. Thank you! - Easycash Lending Company Inc.',
};

function formatDueDate(date: Date): string {
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
}

function formatPeso(amount: string): string {
  return Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function renderReminderMessage(
  candidate: SmsReminderCandidate,
  triggerType: ReminderTriggerType,
  template: string = DEFAULT_TEMPLATES[triggerType],
): string {
  let message = template.replace('{borrowerName}', candidate.borrowerName).replace('{loanCode}', candidate.loanCode);

  if (triggerType === 'PAST_DUE_WEEKLY') {
    message = message
      .replace('{daysLate}', String(candidate.daysLate ?? 0))
      .replace('{totalAmountDue}', formatPeso(candidate.totalAmountDue ?? '0'));
  } else {
    message = message
      .replace('{amountDue}', formatPeso(candidate.amountDueTotal))
      .replace('{dueDate}', candidate.dueDate ? formatDueDate(candidate.dueDate) : '');
  }

  return message;
}
