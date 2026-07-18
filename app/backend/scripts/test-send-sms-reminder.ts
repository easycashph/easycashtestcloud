/* eslint-disable no-console */
/**
 * One-off manual test for the Auto SMS Payment Reminders feature (2026-07-18) - sends a REAL SMS
 * to exactly ONE loan account's next-due installment, so it can be verified against a real phone
 * before the daily cron (`smsReminderScheduler.ts`) is ever allowed to run for real across the
 * whole portfolio. Does NOT touch `SmsReminderLog` (deliberately - this is a manual verification
 * send, not the automated pipeline, and shouldn't collide with or contaminate that table's
 * idempotency guard for whatever installment gets picked).
 *
 * Usage:
 *   npx tsx scripts/test-send-sms-reminder.ts --loan-code=SML-REG_00001              # dry run - prints what would be sent
 *   npx tsx scripts/test-send-sms-reminder.ts --loan-code=SML-REG_00001 --apply      # actually sends via M360
 *
 * Requires M360_USERNAME/M360_PASSWORD/M360_SHORTCODE_MASK to already be set in .env with real,
 * active credentials - this script does NOT read/require SMS_ENABLED (that flag gates the
 * automated cron job only; this is an explicit, one-loan, human-initiated test).
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';
import { M360SmsGateway } from '../src/modules/sms-reminder/infrastructure/M360SmsGateway';
import { renderReminderMessage } from '../src/modules/sms-reminder/application/reminderMessageTemplate';

const APPLY = process.argv.includes('--apply');
const loanCodeArg = process.argv.find((arg) => arg.startsWith('--loan-code='));
const loanCode = loanCodeArg?.split('=')[1];

async function main() {
  if (!loanCode) {
    console.error('Usage: npx tsx scripts/test-send-sms-reminder.ts --loan-code=<LOAN_CODE> [--apply]');
    process.exitCode = 1;
    return;
  }

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
        select: { dueDate: true, principalDue: true, interestDue: true, feesDue: true, penaltyDue: true },
      },
    },
  });

  if (!loanAccount) {
    console.error(`No loan account found with loan code "${loanCode}".`);
    process.exitCode = 1;
    return;
  }
  const nextInstallment = loanAccount.repaymentSchedule[0];
  if (!nextInstallment) {
    console.error(`Loan ${loanCode} has no unpaid installment - nothing to remind about.`);
    process.exitCode = 1;
    return;
  }
  if (!loanAccount.borrower.mobilePhone1) {
    console.error(`Loan ${loanCode}'s borrower has no mobilePhone1 on file - cannot send.`);
    process.exitCode = 1;
    return;
  }

  const amountDueTotal =
    Number(nextInstallment.principalDue) + Number(nextInstallment.interestDue) + Number(nextInstallment.feesDue) + Number(nextInstallment.penaltyDue);

  const candidate = {
    installmentId: '',
    loanAccountId: loanAccount.id,
    loanCode: loanAccount.loanCode,
    branchId: '',
    borrowerName: `${loanAccount.borrower.firstName} ${loanAccount.borrower.lastName}`,
    phoneNumber: loanAccount.borrower.mobilePhone1,
    dueDate: nextInstallment.dueDate,
    amountDueTotal: amountDueTotal.toString(),
  };
  const message = renderReminderMessage(candidate);

  console.log(`Loan: ${candidate.loanCode}`);
  console.log(`Borrower: ${candidate.borrowerName}`);
  console.log(`Phone: ${candidate.phoneNumber}`);
  console.log(`Next due installment: ${candidate.dueDate.toISOString()} - PHP ${amountDueTotal.toFixed(2)}`);
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

  console.log('\nSending via M360...');
  const result = await gateway.send(candidate.phoneNumber, message);
  console.log(`Sent. M360 transid: ${result.providerTransId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
