import { logger } from '@shared/logger/logger';
import type { ISmsReminderRepository } from '../ports/ISmsReminderRepository';
import type { ISmsGateway } from '../ports/ISmsGateway';
import { renderReminderMessage } from '../reminderMessageTemplate';

export interface SendPaymentReminderSmsResult {
  candidateCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}

/**
 * The daily job body (see infrastructure/smsReminderScheduler.ts for the cron wiring itself).
 * Runs once per calendar day, `targetDate` = today + SMS_REMINDER_DAYS_BEFORE_DUE — finds every
 * loan whose next-due installment lands exactly there, and texts each one once.
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
      /** SMS_REMINDER_TEMPLATE override - omit to use reminderMessageTemplate.ts's own default. */
      messageTemplate?: string;
    },
  ) {}

  async execute(targetDate: Date): Promise<SendPaymentReminderSmsResult> {
    const candidates = await this.deps.smsReminderRepository.findCandidatesDueOn(targetDate, undefined);
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const candidate of candidates) {
      const alreadyLogged = await this.deps.smsReminderRepository.existsForInstallment(candidate.installmentId);
      if (alreadyLogged) {
        skippedCount++;
        continue;
      }

      const message = this.deps.messageTemplate ? renderReminderMessage(candidate, this.deps.messageTemplate) : renderReminderMessage(candidate);

      if (!this.deps.smsEnabled) {
        await this.deps.smsReminderRepository.logSent({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          phoneNumber: candidate.phoneNumber,
          message,
          providerTransId: `DRY-RUN-${candidate.installmentId}`,
        });
        sentCount++;
        continue;
      }

      try {
        const result = await this.deps.smsGateway.send(candidate.phoneNumber, message);
        await this.deps.smsReminderRepository.logSent({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          phoneNumber: candidate.phoneNumber,
          message,
          providerTransId: result.providerTransId,
        });
        sentCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown SMS gateway error';
        await this.deps.smsReminderRepository.logFailed({
          loanAccountId: candidate.loanAccountId,
          installmentId: candidate.installmentId,
          phoneNumber: candidate.phoneNumber,
          message,
          errorMessage,
        });
        failedCount++;
        logger.error({ loanCode: candidate.loanCode, errorMessage }, 'Payment reminder SMS failed to send');
      }
    }

    return { candidateCount: candidates.length, sentCount, skippedCount, failedCount };
  }
}
