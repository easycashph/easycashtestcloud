import { logger } from '@shared/logger/logger';
import type { ISmsReminderRepository, ReminderTriggerType, SmsReminderCandidate } from '../ports/ISmsReminderRepository';
import type { ISmsGateway } from '../ports/ISmsGateway';
import { renderReminderMessage } from '../reminderMessageTemplate';

export interface SendPaymentReminderSmsResult {
  candidateCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The 4 date-anchored triggers, relative to a loan's next-due installment. */
const DATE_TRIGGER_OFFSETS: { type: ReminderTriggerType; offsetDays: number }[] = [
  { type: 'FIVE_DAYS_BEFORE', offsetDays: -5 },
  { type: 'THREE_DAYS_BEFORE', offsetDays: -3 },
  { type: 'ONE_DAY_BEFORE', offsetDays: -1 },
  { type: 'DUE_DATE', offsetDays: 0 },
];

/** Asia/Manila is fixed UTC+8 year-round (no DST) - true every Monday, matching PAST_DUE_WEEKLY's user-confirmed cadence. */
function isManilaMonday(now: Date): boolean {
  return new Date(now.getTime() + MANILA_OFFSET_MS).getUTCDay() === 1;
}

/**
 * The daily job body (see infrastructure/smsReminderScheduler.ts for the cron wiring itself).
 * Runs once per calendar day and checks EVERY trigger in the 5-stage business-confirmed schedule
 * (2026-07-12 decision, previously only simulated in `LoanDetailPage.tsx`): the 4 date-anchored
 * triggers always run (each looks at today +/- its own offset); PAST_DUE_WEEKLY only runs on
 * Mondays (Asia/Manila), uncapped, for as long as a loan has any overdue unpaid installment.
 *
 * `smsEnabled=false` (SMS_ENABLED unset in .env) is a real, first-class code path, not a stub -
 * it still runs the whole candidate/idempotency/logging pipeline and logs `logSent` with a
 * synthetic transid, it just never calls `smsGateway.send`. This is what makes it safe to run the
 * cron in every environment (dev, staging) without risking a real SMS blast before a `SMS_ENABLED
 * =true` deploy - the day it flips on, there's no backlog of unsent-but-already-logged reminders
 * to reconcile.
 */
export class SendPaymentReminderSmsUseCase {
  constructor(
    private readonly deps: {
      smsReminderRepository: ISmsReminderRepository;
      smsGateway: ISmsGateway;
      smsEnabled: boolean;
    },
  ) {}

  async execute(now: Date = new Date()): Promise<SendPaymentReminderSmsResult> {
    const totals: SendPaymentReminderSmsResult = { candidateCount: 0, sentCount: 0, skippedCount: 0, failedCount: 0 };

    for (const { type, offsetDays } of DATE_TRIGGER_OFFSETS) {
      const targetDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
      const candidates = await this.deps.smsReminderRepository.findCandidatesDueOn(targetDate, undefined);
      await this.processCandidates(candidates, type, targetDate, totals);
    }

    if (isManilaMonday(now)) {
      const candidates = await this.deps.smsReminderRepository.findPastDueCandidates(undefined);
      await this.processCandidates(candidates, 'PAST_DUE_WEEKLY', now, totals);
    }

    return totals;
  }

  private async processCandidates(
    candidates: SmsReminderCandidate[],
    triggerType: ReminderTriggerType,
    triggerDate: Date,
    totals: SendPaymentReminderSmsResult,
  ): Promise<void> {
    totals.candidateCount += candidates.length;

    for (const candidate of candidates) {
      const alreadyLogged = await this.deps.smsReminderRepository.existsForTrigger(candidate.loanAccountId, triggerType, triggerDate);
      if (alreadyLogged) {
        totals.skippedCount++;
        continue;
      }

      const message = renderReminderMessage(candidate, triggerType);

      if (!this.deps.smsEnabled) {
        await this.deps.smsReminderRepository.logSent({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          triggerType,
          triggerDate,
          phoneNumber: candidate.phoneNumber,
          message,
          providerTransId: `DRY-RUN-${candidate.loanAccountId}-${triggerType}`,
        });
        totals.sentCount++;
        continue;
      }

      try {
        const result = await this.deps.smsGateway.send(candidate.phoneNumber, message);
        await this.deps.smsReminderRepository.logSent({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          triggerType,
          triggerDate,
          phoneNumber: candidate.phoneNumber,
          message,
          providerTransId: result.providerTransId,
        });
        totals.sentCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown SMS gateway error';
        await this.deps.smsReminderRepository.logFailed({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          triggerType,
          triggerDate,
          phoneNumber: candidate.phoneNumber,
          message,
          errorMessage,
        });
        totals.failedCount++;
        logger.error({ loanCode: candidate.loanCode, triggerType, errorMessage }, 'Payment reminder SMS failed to send');
      }
    }
  }
}
