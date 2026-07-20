import { logger } from '@shared/logger/logger';
import { renderReminderMessage } from '@modules/sms-reminder/application/reminderMessageTemplate';
import type { SmsReminderCandidate } from '@modules/sms-reminder/application/ports/ISmsReminderRepository';
import type { IReminderSettingsRepository } from '@modules/reminder-settings/application/ports/IReminderSettingsRepository';
import type { IEmailReminderRepository, ReminderTriggerType, EmailReminderCandidate } from '../ports/IEmailReminderRepository';
import type { IEmailGateway } from '../ports/IEmailGateway';

export interface SendPaymentReminderEmailResult {
  candidateCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

const DATE_TRIGGER_OFFSETS: { type: ReminderTriggerType; offsetDays: number }[] = [
  { type: 'FIVE_DAYS_BEFORE', offsetDays: -5 },
  { type: 'THREE_DAYS_BEFORE', offsetDays: -3 },
  { type: 'ONE_DAY_BEFORE', offsetDays: -1 },
  { type: 'DUE_DATE', offsetDays: 0 },
];

function isManilaMonday(now: Date): boolean {
  return new Date(now.getTime() + MANILA_OFFSET_MS).getUTCDay() === 1;
}

const SUBJECT = 'Easycash Lending Company Inc. - Payment Reminder';

/** Reuses the exact same message wording as SMS (user-confirmed 2026-07-18: identical content,
 * not a separate email-specific copy) - `renderReminderMessage` only reads
 * borrowerName/loanCode/amountDue/dueDate/daysLate/totalAmountDue, all of which
 * EmailReminderCandidate shares with SmsReminderCandidate, so it's cast rather than duplicated. */
function toSmsShapedCandidate(candidate: EmailReminderCandidate): SmsReminderCandidate {
  return { ...candidate, installmentId: candidate.installmentId, phoneNumber: '' };
}

/**
 * The daily job body (see infrastructure/emailReminderScheduler.ts for the cron wiring) - mirrors
 * SendPaymentReminderSmsUseCase's orchestration exactly (same 5-stage trigger schedule, same
 * dry-run-when-disabled safety), just a different channel/gateway/repository.
 */
export class SendPaymentReminderEmailUseCase {
  constructor(
    private readonly deps: {
      emailReminderRepository: IEmailReminderRepository;
      emailGateway: IEmailGateway;
      reminderSettingsRepository: IReminderSettingsRepository;
    },
  ) {}

  async execute(now: Date = new Date()): Promise<SendPaymentReminderEmailResult> {
    const totals: SendPaymentReminderEmailResult = { candidateCount: 0, sentCount: 0, skippedCount: 0, failedCount: 0 };
    const settings = await this.deps.reminderSettingsRepository.get();

    for (const { type, offsetDays } of DATE_TRIGGER_OFFSETS) {
      const targetDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
      const candidates = await this.deps.emailReminderRepository.findCandidatesDueOn(targetDate, undefined);
      await this.processCandidates(candidates, type, targetDate, totals, settings.emailEnabled);
    }

    if (isManilaMonday(now)) {
      const candidates = await this.deps.emailReminderRepository.findPastDueCandidates(undefined);
      await this.processCandidates(candidates, 'PAST_DUE_WEEKLY', now, totals, settings.emailEnabled);
    }

    return totals;
  }

  private async processCandidates(
    candidates: EmailReminderCandidate[],
    triggerType: ReminderTriggerType,
    triggerDate: Date,
    totals: SendPaymentReminderEmailResult,
    emailEnabled: boolean,
  ): Promise<void> {
    totals.candidateCount += candidates.length;

    for (const candidate of candidates) {
      const alreadyLogged = await this.deps.emailReminderRepository.existsForTrigger(candidate.loanAccountId, triggerType, triggerDate);
      if (alreadyLogged) {
        totals.skippedCount++;
        continue;
      }

      const message = renderReminderMessage(toSmsShapedCandidate(candidate), triggerType);

      if (!emailEnabled) {
        await this.deps.emailReminderRepository.logSent({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          triggerType,
          triggerDate,
          recipientEmail: candidate.email,
          message,
        });
        totals.sentCount++;
        continue;
      }

      try {
        await this.deps.emailGateway.send(candidate.email, SUBJECT, message);
        await this.deps.emailReminderRepository.logSent({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          triggerType,
          triggerDate,
          recipientEmail: candidate.email,
          message,
        });
        totals.sentCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown email gateway error';
        await this.deps.emailReminderRepository.logFailed({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          triggerType,
          triggerDate,
          recipientEmail: candidate.email,
          message,
          errorMessage,
        });
        totals.failedCount++;
        logger.error({ loanCode: candidate.loanCode, triggerType, errorMessage }, 'Payment reminder email failed to send');
      }
    }
  }
}
