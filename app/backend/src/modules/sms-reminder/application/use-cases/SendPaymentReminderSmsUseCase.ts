import { logger } from '@shared/logger/logger';
import type { IReminderSettingsRepository } from '@modules/reminder-settings/application/ports/IReminderSettingsRepository';
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
 * The enabled/disabled switch (2026-07-18: moved from a static `SMS_ENABLED` env var to a
 * DB-backed `ReminderSettings` row, checked fresh at the START of each run - not per candidate -
 * so a mid-day MIS toggle takes effect on the next run without a server restart) is a real,
 * first-class code path, not a stub: even disabled, this still runs the whole candidate/
 * idempotency/logging pipeline and logs `logSent` with a synthetic transid, it just never calls
 * `smsGateway.send`. This is what makes it safe to run the cron in every environment without
 * risking a real SMS blast before someone flips it on - the day it does, there's no backlog of
 * unsent-but-already-logged reminders to reconcile.
 */
export class SendPaymentReminderSmsUseCase {
  constructor(
    private readonly deps: {
      smsReminderRepository: ISmsReminderRepository;
      smsGateway: ISmsGateway;
      reminderSettingsRepository: IReminderSettingsRepository;
    },
  ) {}

  async execute(now: Date = new Date()): Promise<SendPaymentReminderSmsResult> {
    const totals: SendPaymentReminderSmsResult = { candidateCount: 0, sentCount: 0, skippedCount: 0, failedCount: 0 };
    const settings = await this.deps.reminderSettingsRepository.get();

    for (const { type, offsetDays } of DATE_TRIGGER_OFFSETS) {
      const targetDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
      const candidates = await this.deps.smsReminderRepository.findCandidatesDueOn(targetDate, undefined);
      await this.processCandidates(candidates, type, targetDate, totals, settings.smsEnabled);
    }

    if (isManilaMonday(now)) {
      const candidates = await this.deps.smsReminderRepository.findPastDueCandidates(undefined);
      await this.processCandidates(candidates, 'PAST_DUE_WEEKLY', now, totals, settings.smsEnabled);
    }

    return totals;
  }

  private async processCandidates(
    candidates: SmsReminderCandidate[],
    triggerType: ReminderTriggerType,
    triggerDate: Date,
    totals: SendPaymentReminderSmsResult,
    smsEnabled: boolean,
  ): Promise<void> {
    totals.candidateCount += candidates.length;

    for (const candidate of candidates) {
      const alreadyLogged = await this.deps.smsReminderRepository.existsForTrigger(candidate.loanAccountId, triggerType, triggerDate);
      if (alreadyLogged) {
        totals.skippedCount++;
        continue;
      }

      const message = renderReminderMessage(candidate, triggerType);

      if (!smsEnabled) {
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
