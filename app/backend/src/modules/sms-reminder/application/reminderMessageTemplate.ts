import type { SmsReminderCandidate } from './ports/ISmsReminderRepository';

/**
 * Configurable per CLAUDE.md ("financial rules must be configurable rather than hard-coded") -
 * override via SMS_REMINDER_TEMPLATE if the wording ever needs to change without a deploy.
 * Placeholders: {borrowerName}, {loanCode}, {amountDue}, {dueDate}.
 */
const DEFAULT_TEMPLATE = `Easycash Lending Company Inc. - Payment Reminder

Hi {borrowerName}

This is a friendly reminder regarding your loan account {loanCode} amounting to PHP {amountDue}, is due on {dueDate}.

To avoid additional penalties and charges, please settle your payment on or before the due date.

If you have already made your payment, please disregard this reminder.
Thank you for your continued trust in Easycash Lending Company Inc.`;

function formatDueDate(date: Date): string {
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
}

function formatPeso(amount: string): string {
  return Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function renderReminderMessage(candidate: SmsReminderCandidate, template: string = DEFAULT_TEMPLATE): string {
  return template
    .replace('{borrowerName}', candidate.borrowerName)
    .replace('{loanCode}', candidate.loanCode)
    .replace('{amountDue}', formatPeso(candidate.amountDueTotal))
    .replace('{dueDate}', formatDueDate(candidate.dueDate));
}
