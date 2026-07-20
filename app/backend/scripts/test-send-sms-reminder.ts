/* eslint-disable no-console */
/**
 * One-off manual test for the Auto SMS Payment Reminders feature (2026-07-18) - sends a REAL SMS
 * for exactly ONE loan account, so it can be verified against a real phone before the daily cron
 * (`smsReminderScheduler.ts`) is ever allowed to run for real across the whole portfolio. DOES log
 * to `SmsReminderLog` on a real `--apply` send (2026-07-18 follow-up: a test send with no log row
 * was invisible everywhere - Reports Hub, the Loan Detail page's Reminders panel - even though a
 * real SMS had gone out) - uses the SAME `(loanAccountId, triggerType, triggerDate)` idempotency
 * key as the real automated job, so if the daily cron later independently fires for the exact same
 * loan/trigger/day this test already covered, it will correctly see it as already-sent and skip
 * (no double-text) rather than erroring.
 *
 * Usage:
 *   npx tsx scripts/test-send-sms-reminder.ts --loan-code=SML-REG_00001                                # dry run, FIVE_DAYS_BEFORE (default)
 *   npx tsx scripts/test-send-sms-reminder.ts --loan-code=SML-REG_00001 --trigger=DUE_DATE --apply     # actually sends via M360
 *
 * --trigger accepts FIVE_DAYS_BEFORE (default) | THREE_DAYS_BEFORE | ONE_DAY_BEFORE | DUE_DATE |
 * PAST_DUE_WEEKLY. The 4 date-anchored triggers preview against the loan's actual next-due
 * installment (its real due date, not a simulated one); PAST_DUE_WEEKLY sums every overdue-and-
 * unpaid installment on the loan instead (fails with a clear message if the loan has none).
 *
 * Requires M360_USERNAME/M360_PASSWORD/M360_SHORTCODE_MASK to already be set in .env with real,
 * active credentials - this script does NOT read/require SMS_ENABLED (that flag gates the
 * automated cron job only; this is an explicit, one-loan, human-initiated test).
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';
import { M360SmsGateway } from '../src/modules/sms-reminder/infrastructure/M360SmsGateway';
import { PrismaSmsReminderRepository } from '../src/modules/sms-reminder/infrastructure/PrismaSmsReminderRepository';
import { renderReminderMessage } from '../src/modules/sms-reminder/application/reminderMessageTemplate';
import type { ReminderTriggerType, SmsReminderCandidate } from '../src/modules/sms-reminder/application/ports/ISmsReminderRepository';

const VALID_TRIGGERS: ReminderTriggerType[] = ['FIVE_DAYS_BEFORE', 'THREE_DAYS_BEFORE', 'ONE_DAY_BEFORE', 'DUE_DATE', 'PAST_DUE_WEEKLY'];

const APPLY = process.argv.includes('--apply');
const loanCodeArg = process.argv.find((arg) => arg.startsWith('--loan-code='));
const loanCode = loanCodeArg?.split('=')[1];
const triggerArg = process.argv.find((arg) => arg.startsWith('--trigger='));
const triggerType = (triggerArg?.split('=')[1] ?? 'FIVE_DAYS_BEFORE') as ReminderTriggerType;

async function buildDateAnchoredCandidate(loanCode: string): Promise<SmsReminderCandidate | null> {
  const loanAccount = await prisma.loanAccount.findUnique({
    where: { loanCode },
    select: {
      id: true,
      loanCode: true,
      borrower: { select: { firstName: true, lastName: true, mobilePhone1: true } },
      repaymentSchedule: {
        where: { status: { not: 'PAID' } },
        orderBy: { installmentNumber: 'asc' },
        take: 1,
        select: { id: true, dueDate: true, principalDue: true, interestDue: true, feesDue: true, penaltyDue: true },
      },
    },
  });
  if (!loanAccount) {
    console.error(`No loan account found with loan code "${loanCode}".`);
    return null;
  }
  const nextInstallment = loanAccount.repaymentSchedule[0];
  if (!nextInstallment) {
    console.error(`Loan ${loanCode} has no unpaid installment - nothing to remind about.`);
    return null;
  }
  if (!loanAccount.borrower.mobilePhone1) {
    console.error(`Loan ${loanCode}'s borrower has no mobilePhone1 on file - cannot send.`);
    return null;
  }

  const amountDueTotal =
    Number(nextInstallment.principalDue) + Number(nextInstallment.interestDue) + Number(nextInstallment.feesDue) + Number(nextInstallment.penaltyDue);

  return {
    installmentId: nextInstallment.id,
    loanAccountId: loanAccount.id,
    loanCode: loanAccount.loanCode,
    branchId: '',
    borrowerName: `${loanAccount.borrower.firstName} ${loanAccount.borrower.lastName}`,
    phoneNumber: loanAccount.borrower.mobilePhone1,
    dueDate: nextInstallment.dueDate,
    amountDueTotal: amountDueTotal.toString(),
    daysLate: null,
    totalAmountDue: null,
  };
}

async function buildPastDueCandidate(loanCode: string): Promise<SmsReminderCandidate | null> {
  const loanAccount = await prisma.loanAccount.findUnique({
    where: { loanCode },
    select: {
      id: true,
      loanCode: true,
      borrower: { select: { firstName: true, lastName: true, mobilePhone1: true } },
      repaymentSchedule: {
        where: { status: { not: 'PAID' }, dueDate: { lt: new Date() } },
        orderBy: { dueDate: 'asc' },
        select: { dueDate: true, principalDue: true, interestDue: true, feesDue: true, penaltyDue: true, principalPaid: true, interestPaid: true, feesPaid: true, penaltyPaid: true },
      },
    },
  });
  if (!loanAccount) {
    console.error(`No loan account found with loan code "${loanCode}".`);
    return null;
  }
  const overdue = loanAccount.repaymentSchedule;
  if (overdue.length === 0) {
    console.error(`Loan ${loanCode} has no overdue installment - nothing to remind about for PAST_DUE_WEEKLY.`);
    return null;
  }
  if (!loanAccount.borrower.mobilePhone1) {
    console.error(`Loan ${loanCode}'s borrower has no mobilePhone1 on file - cannot send.`);
    return null;
  }

  const totalAmountDue = overdue.reduce((sum, r) => {
    const due = Number(r.principalDue) + Number(r.interestDue) + Number(r.feesDue) + Number(r.penaltyDue);
    const paid = Number(r.principalPaid) + Number(r.interestPaid) + Number(r.feesPaid) + Number(r.penaltyPaid);
    return sum + Math.max(0, due - paid);
  }, 0);
  const daysLate = Math.floor((Date.now() - overdue[0]!.dueDate.getTime()) / (24 * 60 * 60 * 1000));

  return {
    installmentId: null,
    loanAccountId: loanAccount.id,
    loanCode: loanAccount.loanCode,
    branchId: '',
    borrowerName: `${loanAccount.borrower.firstName} ${loanAccount.borrower.lastName}`,
    phoneNumber: loanAccount.borrower.mobilePhone1,
    dueDate: null,
    amountDueTotal: '0',
    daysLate,
    totalAmountDue: totalAmountDue.toString(),
  };
}

async function main() {
  if (!loanCode) {
    console.error('Usage: npx tsx scripts/test-send-sms-reminder.ts --loan-code=<LOAN_CODE> [--trigger=<TYPE>] [--apply]');
    process.exitCode = 1;
    return;
  }
  if (!VALID_TRIGGERS.includes(triggerType)) {
    console.error(`Invalid --trigger. Must be one of: ${VALID_TRIGGERS.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const candidate = triggerType === 'PAST_DUE_WEEKLY' ? await buildPastDueCandidate(loanCode) : await buildDateAnchoredCandidate(loanCode);
  if (!candidate) {
    process.exitCode = 1;
    return;
  }
  const message = renderReminderMessage(candidate, triggerType);

  console.log(`Loan: ${candidate.loanCode}`);
  console.log(`Borrower: ${candidate.borrowerName}`);
  console.log(`Phone: ${candidate.phoneNumber}`);
  console.log(`Trigger: ${triggerType}`);
  if (triggerType === 'PAST_DUE_WEEKLY') {
    console.log(`Days late: ${candidate.daysLate} - Total amount due: PHP ${Number(candidate.totalAmountDue).toFixed(2)}`);
  } else {
    console.log(`Next due installment: ${candidate.dueDate!.toISOString()} - PHP ${Number(candidate.amountDueTotal).toFixed(2)}`);
  }
  console.log(`Message: "${message}"`);

  if (!APPLY) {
    console.log('\nDry run - nothing sent. Re-run with --apply to actually send via M360.');
    return;
  }

  const username = process.env.M360_USERNAME;
  const password = process.env.M360_PASSWORD;
  const shortcodeMask = process.env.M360_SHORTCODE_MASK;
  if (!username || !password || !shortcodeMask) {
    console.error('M360_USERNAME / M360_PASSWORD / M360_SHORTCODE_MASK must all be set in .env before --apply.');
    process.exitCode = 1;
    return;
  }

  const gateway = new M360SmsGateway({
    apiUrl: process.env.M360_API_URL ?? 'https://api.m360.com.ph/v3/api/broadcast',
    username,
    password,
    shortcodeMask,
  });
  const smsReminderRepository = new PrismaSmsReminderRepository();
  const triggerDate = new Date(); // "as if this trigger fired today" - the manual test's own intent

  const alreadyLogged = await smsReminderRepository.existsForTrigger(candidate.loanAccountId, triggerType, triggerDate);
  if (alreadyLogged) {
    console.error(`\nA reminder for this loan/trigger/day is already logged (ran this exact test earlier today?). Skipping to avoid a duplicate log row.`);
    process.exitCode = 1;
    return;
  }

  console.log('\nSending via M360...');
  try {
    const result = await gateway.send(candidate.phoneNumber, message);
    console.log(`Sent. M360 transid: ${result.providerTransId}`);
    await smsReminderRepository.logSent({
      loanAccountId: candidate.loanAccountId,
      installmentId: candidate.installmentId,
      triggerType,
      triggerDate,
      phoneNumber: candidate.phoneNumber,
      message,
      providerTransId: result.providerTransId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown SMS gateway error';
    await smsReminderRepository.logFailed({
      loanAccountId: candidate.loanAccountId,
      installmentId: candidate.installmentId,
      triggerType,
      triggerDate,
      phoneNumber: candidate.phoneNumber,
      message,
      errorMessage,
    });
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
