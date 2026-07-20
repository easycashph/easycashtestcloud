import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCheck2,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import { apiClient, ApiError, downloadFile, fetchAllPages } from '@/lib/apiClient';
import type {
  Borrower as RealBorrower,
  InstallmentAdjustment,
  InterestRateChartEntry,
  LoanAccount,
  LoanDocumentListItem,
  LoanTransaction,
  PaginatedResponse,
  PaymentAllocationDetail,
  RepaymentInstallment,
} from '@/lib/loanApiTypes';
import type { SmsReminderLog } from '@/lib/smsReminderApiTypes';
import type { EmailReminderLog } from '@/lib/emailReminderApiTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { LoanStatusBadge, InstallmentStatusBadge } from '@/components/StatusBadge';
import { AttachmentsPanel as RealAttachmentsPanel } from '@/components/AttachmentsPanel';
import { LoanDocumentPreviewModal, type LoanDocumentPreviewTarget } from '@/components/LoanDocumentPreviewModal';
import { ProfileNotesPanel } from '@/components/ProfileNotesPanel';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ProfileActivityTimeline } from '@/components/ProfileActivityTimeline';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import type { LoanRiskAssessment, RiskLevel } from '@/lib/riskAssessmentApiTypes';
import { cn, formatDate, formatDateTime, formatPercentage, formatPeso } from '@/lib/utils';
import { previewLoanSchedule } from '@/lib/loanSchedulePreview';
import { PaymentRecordingForm } from '@/pages/PaymentRecordingPage';

const RISK_BADGE_VARIANT: Record<RiskLevel, 'success' | 'warning' | 'destructive'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'destructive',
};

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: 'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH: 'High Risk',
};

/**
 * Deterministic, rule-based assessment computed by the LMS itself (backend's
 * `LoanRiskAssessmentService`, from real repayment data - days past due, late-payment count) - no
 * external AI/ML model call. Replaced the earlier mock (`getMockRiskAssessment`) 2026-07-11.
 */
/**
 * Expanded content under a REPAYMENT row in the Payment History tab — which installment(s) the
 * payment actually hit, per component. Reads the `payment_allocations` rows recorded at payment
 * time (the same data Reverse Payment uses). Migrated/legacy REPAYMENTs predate allocation
 * recording, so an empty result is a normal state, not an error.
 */
function TransactionAllocationsPanel({ transactionId }: { transactionId: string }) {
  const num = (v: string) => Number.parseFloat(v) || 0;
  const query = useQuery({
    queryKey: ['transaction-allocations', transactionId],
    queryFn: () => apiClient.get<{ allocations: PaymentAllocationDetail[] }>(`/transactions/${transactionId}/allocations`),
  });

  if (query.isLoading) {
    return <p className="py-2 text-xs text-muted-foreground">Loading allocation…</p>;
  }
  const allocations = query.data?.allocations ?? [];
  if (allocations.length === 0) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        No allocation detail available - this payment was migrated from the legacy system or recorded before allocation
        tracking was added.
      </p>
    );
  }

  return (
    <div className="py-2">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Applied to:</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableCell className="text-xs font-medium text-muted-foreground">Installment</TableCell>
            <TableCell className="text-xs font-medium text-muted-foreground">Due Date</TableCell>
            <TableCell className="text-right text-xs font-medium text-muted-foreground">Fees</TableCell>
            <TableCell className="text-right text-xs font-medium text-muted-foreground">Penalty</TableCell>
            <TableCell className="text-right text-xs font-medium text-muted-foreground">Interest</TableCell>
            <TableCell className="text-right text-xs font-medium text-muted-foreground">Principal</TableCell>
            <TableCell className="text-right text-xs font-medium text-muted-foreground">Total</TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.map((a) => (
            <TableRow key={a.repaymentInstallmentId}>
              <TableCell className="text-xs">{a.installmentNumber !== null ? `#${a.installmentNumber}` : '—'}</TableCell>
              <TableCell className="text-xs">{a.installmentDueDate ? formatDate(a.installmentDueDate) : '—'}</TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">{formatPeso(num(a.feesApplied))}</TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">{formatPeso(num(a.penaltyApplied))}</TableCell>
              <TableCell className="text-right text-xs">{formatPeso(num(a.interestApplied))}</TableCell>
              <TableCell className="text-right text-xs">{formatPeso(num(a.principalApplied))}</TableCell>
              <TableCell className="text-right text-xs font-medium">
                {formatPeso(num(a.feesApplied) + num(a.penaltyApplied) + num(a.interestApplied) + num(a.principalApplied))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Allocation order: Fees → Penalty → Interest → Principal, oldest unpaid installment first (ADR-009).
      </p>
    </div>
  );
}

function RiskAssessmentCard({ loanId }: { loanId: string }) {
  const query = useQuery({
    queryKey: ['loan-risk-assessment', loanId],
    queryFn: () => apiClient.get<LoanRiskAssessment>(`/loan-accounts/${loanId}/risk-assessment`),
  });
  const assessment = query.data;
  if (!assessment) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle>Risk Assessment</CardTitle>
        </div>
        <Badge variant={RISK_BADGE_VARIANT[assessment.riskLevel]}>{RISK_LEVEL_LABEL[assessment.riskLevel]}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{assessment.recommendation}</p>
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
          Computed by the LMS from this loan's own repayment history (days past due, late-payment count) - a deterministic rule-based
          calculation, not an external AI model. The Loan Officer/Collector still makes the final call.
        </p>
      </CardContent>
    </Card>
  );
}

/** Compact stat tile - replaces `RealLoanDetailView`'s old three separate bordered Cards (Collections
 * Balance / Loan Terms / Accounting Balance) with one dense grid, per this session's "make it
 * compact" request. */
function MiniStat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('tabular-nums', emphasize ? 'font-semibold' : 'text-sm')}>{value}</p>
    </div>
  );
}

const TRANSACTION_TYPE_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  REPAYMENT: 'success',
  DISBURSEMENT: 'secondary',
  PENALTY_APPLIED: 'destructive',
  FEE_CHARGED: 'warning',
  REVERSAL: 'destructive',
  ADJUSTMENT: 'warning',
};

function TransactionTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant={TRANSACTION_TYPE_VARIANT[type] ?? 'secondary'} className="text-[10px]">
      {type.replaceAll('_', ' ')}
    </Badge>
  );
}

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-08 after CP12, Approve/Activate + Attachments
 * + Notes + Reminders added 2026-07-12, Reverse Payment + Loan Documents (ADR-051) added
 * 2026-07-12. `getMockLoan()`/the mock loan fallback were retired once the legacy dataset finished
 * migrating (CP12) - every loan account is now a real backend record, so this page always renders
 * `RealLoanDetailView`. Real: balances, borrower, repayment schedule (incl. live per-installment
 * penalty, ADR-050), risk assessment, full transaction ledger with Reverse Payment (MIS-only,
 * append-only - see `reverseMutation` below), Approve/Activate actions (`POST
 * /loan-accounts/:id/approve` and `/activate`, same role tier as loan origination per ADR-038
 * §3.1/§3.6), Attachments (`RealAttachmentsPanel`), Notes (`ProfileNotesPanel`, renamed from
 * `NotesPanel` 2026-07-13 to disambiguate from the separate `loan-note` module's own,
 * differently-capable notes), Reminders
 * (`RealRemindersPanel` - real trigger schedule computed from the real repayment schedule,
 * business-confirmed 2026-07-12; SMS via M360 and Email via Google Workspace SMTP both real as of
 * 2026-07-18, overlaid with real SmsReminderLog/EmailReminderLog send status), and Loan Documents
 * (ADR-051 - Disclosure Statement, Promissory Note, etc.,
 * generated from the loan product's configured templates once the loan is APPROVED). See
 * `docs/Architecture/FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md` for the wiring pattern this follows.
 */
/** Same "was this ever late" logic as the backend's `LoanRiskAssessmentService` - `status` alone
 * can't tell for a settled installment (it's a live-derived value that resets to PAID), so a
 * currently-LATE row OR a PAID row whose `lastPaidAt` came after its `dueDate` both count. Kept in
 * sync with that service's doc comment intentionally - this is what the Risk Assessment card's
 * "late payment" count above is counting, made visible per-row here. */
function wasInstallmentLate(installment: RepaymentInstallment): boolean {
  if (installment.status === 'LATE') return true;
  if (installment.status === 'PAID' && installment.lastPaidAt) {
    return new Date(installment.lastPaidAt) > new Date(installment.dueDate);
  }
  return false;
}

type ReminderTriggerType = 'FIVE_DAYS_BEFORE' | 'THREE_DAYS_BEFORE' | 'ONE_DAY_BEFORE' | 'DUE_DATE' | 'PAST_DUE_WEEKLY';

const REMINDER_TRIGGER_LABELS: Record<ReminderTriggerType, string> = {
  FIVE_DAYS_BEFORE: '5 Days Before Due',
  THREE_DAYS_BEFORE: '3 Days Before Due',
  ONE_DAY_BEFORE: '1 Day Before Due',
  DUE_DATE: 'Due Date',
  PAST_DUE_WEEKLY: 'Past Due (Weekly)',
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Business-confirmed reminder schedule (2026-07-12): 5/3/1 days before the due date, on the due
 * date itself, and weekly (capped at 3 occurrences, matching the original design) once an
 * installment is late. Mirrors `buildRemindersForLoan()` in the retired mock reminder system
 * exactly - only the trigger *schedule* was confirmed as real policy, not that system's "Sent"
 * simulation (see `RealRemindersPanel` below for why that part is deliberately not carried over).
 */
function computeReminderTriggers(dueDate: Date, isLate: boolean): { type: ReminderTriggerType; date: Date }[] {
  const triggers: { type: ReminderTriggerType; date: Date }[] = [
    { type: 'FIVE_DAYS_BEFORE', date: addDays(dueDate, -5) },
    { type: 'THREE_DAYS_BEFORE', date: addDays(dueDate, -3) },
    { type: 'ONE_DAY_BEFORE', date: addDays(dueDate, -1) },
    { type: 'DUE_DATE', date: dueDate },
  ];
  if (isLate) {
    const now = new Date();
    for (let week = 1; week <= 3; week++) {
      const weekDate = addDays(dueDate, week * 7);
      if (weekDate <= now) triggers.push({ type: 'PAST_DUE_WEEKLY', date: weekDate });
    }
  }
  return triggers;
}

/**
 * Client-side mirror of the backend's real per-trigger templates
 * (`app/backend/src/modules/sms-reminder/application/reminderMessageTemplate.ts`'s
 * `DEFAULT_TEMPLATES`, the 4 date-anchored ones only) - used ONLY as a preview before a real
 * `SmsReminderLog` exists for that trigger (once one exists, the actual sent `log.message` is
 * shown instead, verbatim). Kept in sync manually since this is a preview, not a second source of
 * truth for what actually gets sent - if the backend wording changes, update both.
 */
const PREVIEW_TEMPLATES: Record<'FIVE_DAYS_BEFORE' | 'THREE_DAYS_BEFORE' | 'ONE_DAY_BEFORE' | 'DUE_DATE', string> = {
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
};

function renderPreviewMessage(
  triggerType: keyof typeof PREVIEW_TEMPLATES,
  params: { borrowerName: string; loanCode: string; amountDue: number; dueDate: string },
): string {
  return PREVIEW_TEMPLATES[triggerType]
    .replace('{borrowerName}', params.borrowerName)
    .replace('{loanCode}', params.loanCode)
    .replace('{amountDue}', formatPeso(params.amountDue))
    .replace('{dueDate}', formatDate(params.dueDate));
}

const REMINDER_STATUS_BADGE: Record<
  SmsReminderLog['status'],
  { variant: 'outline' | 'success' | 'destructive'; label: string }
> = {
  SENT: { variant: 'outline', label: 'Sent' },
  DELIVERED: { variant: 'success', label: 'Delivered' },
  UNDELIVERED: { variant: 'destructive', label: 'Undelivered' },
  REJECTED: { variant: 'destructive', label: 'Rejected' },
  FAILED: { variant: 'destructive', label: 'Failed' },
};

/** e.g. "Sent · Jul 18, 2026 6:09 AM" - DELIVERED shows the delivery timestamp (the more relevant moment once M360's DLR webhook confirms it), every other status shows when the send attempt itself happened. */
function reminderStatusText(log: SmsReminderLog): string {
  const label = REMINDER_STATUS_BADGE[log.status].label;
  const timestamp = log.status === 'DELIVERED' && log.deliveredAt ? log.deliveredAt : log.sentAt;
  return `${label} · ${formatDateTime(timestamp)}`;
}

const EMAIL_STATUS_BADGE: Record<EmailReminderLog['status'], { variant: 'outline' | 'destructive'; label: string }> = {
  SENT: { variant: 'outline', label: 'Sent' },
  FAILED: { variant: 'destructive', label: 'Failed' },
};

/** Mirrors reminderStatusText - no delivery-confirmation concept for plain SMTP, so always the send timestamp. */
function emailReminderStatusText(log: EmailReminderLog): string {
  return `${EMAIL_STATUS_BADGE[log.status].label} · ${formatDateTime(log.sentAt)}`;
}

/**
 * Real reminder trigger schedule (confirmed business policy, see `computeReminderTriggers`) for
 * this loan's next unpaid installment, overlaid with REAL send status from `SmsReminderLog`
 * (2026-07-18: M360/Globe SMS integration shipped - see docs/SESSION_LOG_2026-07-18_*.md). The 4
 * date-anchored triggers show the matching real log's status (SENT/DELIVERED/etc.) once one
 * exists for this loan, or "Not sent yet" (the schedule's date hasn't been reached by the daily
 * job, or `SMS_ENABLED` is still off) beforehand. PAST_DUE_WEEKLY is now uncapped and uses the
 * loan's actual logged sends directly (one row per real Monday it fired), not a locally-simulated
 * 3-occurrence list.
 */
function RealRemindersPanel({
  loanAccountId,
  loanCode,
  borrower,
  installments,
}: {
  loanAccountId: string;
  loanCode: string;
  borrower: RealBorrower | undefined;
  installments: RepaymentInstallment[];
}) {
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);
  const now = new Date();
  // The OLDEST not-fully-paid installment by installmentNumber, whether its due date is in the
  // future or already overdue - matches the backend's own "next-due installment" definition
  // exactly (PrismaPaymentReminderRepository/PrismaSmsReminderRepository: first status != 'PAID'
  // row ordered by installmentNumber asc). Previously this filtered to `dueDate >= now`, which
  // skipped straight past an already-overdue installment to whichever LATER installment happened
  // to have a future due date - showing this panel's reminder schedule for the wrong installment
  // entirely whenever a loan was late (caught 2026-07-18 from a real screenshot: installment #2
  // was overdue and unpaid, but the panel computed trigger dates for installment #3 instead).
  const unpaid = installments.filter((i) => i.status !== 'PAID');
  const nextDue = unpaid[0];

  const remindersQuery = useQuery({
    queryKey: ['sms-reminder-logs', loanAccountId],
    queryFn: () => apiClient.get<{ items: SmsReminderLog[] }>(`/sms-reminder-logs?loanAccountId=${loanAccountId}`),
  });
  const logs = remindersQuery.data?.items ?? [];

  const emailRemindersQuery = useQuery({
    queryKey: ['email-reminder-logs', loanAccountId],
    queryFn: () => apiClient.get<{ items: EmailReminderLog[] }>(`/email-reminder-logs?loanAccountId=${loanAccountId}`),
  });
  const emailLogs = emailRemindersQuery.data?.items ?? [];

  if (!nextDue) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-muted-foreground" /> Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-4 text-center text-sm text-muted-foreground">No reminders scheduled - loan is fully paid or has no repayment schedule yet.</p>
        </CardContent>
      </Card>
    );
  }

  const num = (v: string) => Number.parseFloat(v) || 0;
  const amountDue = num(nextDue.due.principal) + num(nextDue.due.interest) + num(nextDue.due.fees) - num(nextDue.paid.principal) - num(nextDue.paid.interest) - num(nextDue.paid.fees);
  const dateTriggers = computeReminderTriggers(new Date(nextDue.dueDate), false); // only the 4 date-anchored ones - PAST_DUE_WEEKLY handled separately below, from real logs
  const borrowerName = borrower ? `${borrower.firstName} ${borrower.lastName}` : 'the borrower';

  const pastDueLogs = logs.filter((l) => l.triggerType === 'PAST_DUE_WEEKLY').sort((a, b) => a.triggerDate.localeCompare(b.triggerDate));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-muted-foreground" /> Reminders
        </CardTitle>
        <CardDescription>Trigger schedule for installment #{nextDue.installmentNumber}, and every real Past Due send for this loan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {nextDue.status === 'LATE' && (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            This installment is already past due - the 5/3/1-days-before and Due Date reminders no longer apply (their window has
            passed). Only Past Due reminders send while this account stays overdue; the date-anchored schedule resumes once it's
            current again.
          </p>
        )}
        {nextDue.status !== 'LATE' &&
          dateTriggers.map((trigger) => {
          const log = logs.find((l) => l.triggerType === trigger.type);
          const emailLog = emailLogs.find((l) => l.triggerType === trigger.type);
          const due = trigger.date <= now;
          const key = trigger.type;
          // dateTriggers only ever contains the 4 date-anchored types (computeReminderTriggers isLate=false) - never PAST_DUE_WEEKLY.
          const previewMessage = renderPreviewMessage(trigger.type as keyof typeof PREVIEW_TEMPLATES, {
            borrowerName,
            loanCode,
            amountDue,
            dueDate: nextDue.dueDate,
          });
          return (
            <div key={key} className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center justify-between p-3 text-left"
                onClick={() => setExpandedKey((cur) => (cur === key ? null : key))}
              >
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{REMINDER_TRIGGER_LABELS[trigger.type]}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(trigger.date.toISOString())}</span>
                </div>
                {log ? (
                  <Badge variant={REMINDER_STATUS_BADGE[log.status].variant}>{reminderStatusText(log)}</Badge>
                ) : (
                  <Badge variant={due ? 'warning' : 'outline'}>
                    <span className="flex items-center gap-1">
                      {due ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {due ? 'Not sent yet' : 'Upcoming'}
                    </span>
                  </Badge>
                )}
              </button>
              {expandedKey === key && (
                <div className="space-y-3 border-t p-3">
                  <pre className="whitespace-pre-wrap rounded-md border bg-secondary/40 p-3 text-sm">{log?.message ?? previewMessage}</pre>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4" /> SMS ({borrower?.mobilePhone1 ?? 'no number on file'})
                      </span>
                      {log ? (
                        <Badge variant={REMINDER_STATUS_BADGE[log.status].variant}>{reminderStatusText(log)}</Badge>
                      ) : (
                        <Badge variant="secondary">Not sent yet</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Mail className="h-4 w-4" /> Email ({borrower?.email ?? 'no email on file'})
                      </span>
                      {emailLog ? (
                        <Badge variant={EMAIL_STATUS_BADGE[emailLog.status].variant}>{emailReminderStatusText(emailLog)}</Badge>
                      ) : (
                        <Badge variant="secondary">Not sent yet</Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {nextDue.status === 'LATE' && (
          <div className="rounded-md border">
            <div className="flex items-center gap-2 border-b p-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Past Due (Weekly)</span>
              <span className="text-xs text-muted-foreground">
                {pastDueLogs.length > 0 ? `${pastDueLogs.length} sent so far` : 'not sent yet - runs every Monday while overdue'}
              </span>
            </div>
            {pastDueLogs.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No Past Due reminder has been sent yet for this loan.</p>
            ) : (
              <div className="divide-y">
                {pastDueLogs.map((log) => {
                  const key = `PAST_DUE_WEEKLY-${log.id}`;
                  return (
                    <div key={log.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between p-3 text-left"
                        onClick={() => setExpandedKey((cur) => (cur === key ? null : key))}
                      >
                        <span className="text-xs text-muted-foreground">{formatDate(log.triggerDate)}</span>
                        <Badge variant={REMINDER_STATUS_BADGE[log.status].variant}>{reminderStatusText(log)}</Badge>
                      </button>
                      {expandedKey === key && (
                        <div className="border-t p-3">
                          <pre className="whitespace-pre-wrap rounded-md border bg-secondary/40 p-3 text-sm">{log.message}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RealLoanDetailView({ loanId }: { loanId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentAccount, canCreateLoanAccount } = useRole();
  const [confirmAction, setConfirmAction] = React.useState<'APPROVE' | 'ACTIVATE' | 'UNDO_APPROVE' | 'UNDO_ACTIVATE' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const activateIdempotencyKeyRef = React.useRef<string | null>(null);
  // 2026-07-11 (Reverse Payment feature, user request): correcting a wrongly-entered payment.
  // MIS-only (matches the backend's requireRole('MIS') gate) — see reverseMutation below.
  const [reverseTarget, setReverseTarget] = React.useState<LoanTransaction | null>(null);
  const [reverseReason, setReverseReason] = React.useState('');
  const [expandedTransactionId, setExpandedTransactionId] = React.useState<string | null>(null);
  // 2026-07-15 (Reduce Penalty feature, user-confirmed): Accounting/MIS only (matches the backend's
  // requireRole('MIS', 'Accounting') gate).
  const [reduceTarget, setReduceTarget] = React.useState<RepaymentInstallment | null>(null);
  const [reduceAmount, setReduceAmount] = React.useState('');
  const [reduceReason, setReduceReason] = React.useState('');
  // 2026-07-16 (Adjust Fees feature, user-confirmed): same RBAC as Reduce Penalty, but
  // bidirectional (no ceiling) — see AdjustFeesUseCase's own doc comment.
  const [adjustFeesTarget, setAdjustFeesTarget] = React.useState<RepaymentInstallment | null>(null);
  const [adjustFeesAmount, setAdjustFeesAmount] = React.useState('');
  const [adjustFeesReason, setAdjustFeesReason] = React.useState('');
  // 2026-07-16 (Edit Loan Account, user request): "may kailangan baguhin katulad ng term or
  // amount, dapat pwede ko ito i-edit hangga't before ma-approve" — same ORIGINATION_ROLES gate
  // as "Create Loan Account"/"Approve Loan" (canCreateLoanAccount), only while PENDING_APPROVAL.
  const [editOpen, setEditOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    principalAmount: '',
    addOnRate: '',
    interestRate: '',
    installmentCount: '',
    firstRepaymentDate: '',
    anticipatedDisbursementDate: '',
    // 2026-07-16: percent-based, mirrors LoanAccountCreatePage's identical processingFeePercent/
    // accountManagementFeePercent fields — converted to a peso amount from principalAmount just
    // before submit, never sent to the backend as a raw percent.
    processingFeePercent: '',
    advanceInterestFee: '',
    outstandingBalancePayoff: '',
    docStampFee: '',
    accountManagementFeePercent: '',
    otherFees: '',
    notarialFee: '',
    webFee: '',
    insuranceFee: '',
  });
  const [recordPaymentOpen, setRecordPaymentOpen] = React.useState(false);

  const loanQuery = useQuery({
    queryKey: ['loan-account', loanId],
    queryFn: () => apiClient.get<LoanAccount>(`/loan-accounts/${loanId}`),
    retry: false,
  });
  const loan = loanQuery.data;

  const onActionSuccess = () => {
    setConfirmAction(null);
    setActionError(null);
    void queryClient.invalidateQueries({ queryKey: ['loan-account', loanId] });
    void queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
    void queryClient.invalidateQueries({ queryKey: ['repayment-schedule', loanId] });
    void queryClient.invalidateQueries({ queryKey: ['loan-transactions', loanId] });
    void queryClient.invalidateQueries({ queryKey: ['installment-adjustments', loanId] });
  };
  // 2026-07-11 (Reverse Payment feature) — these three ReversePaymentUseCase rejections are also
  // HTTP 409 (see LedgerDomainErrors.ts), but they're permanent, expected business rules, not a
  // transient version conflict — showing the generic "just updated, try again" message for them
  // was actively misleading (a payment that predates this feature will NEVER become reversible by
  // refreshing and retrying). Surface the backend's own already-descriptive message instead.
  const PERMANENT_REVERSAL_REJECTION_CODES = new Set([
    'TRANSACTION_NOT_REVERSIBLE',
    'TRANSACTION_ALREADY_REVERSED',
    'NO_REVERSIBLE_ALLOCATION_DATA',
  ]);
  const onActionError = (error: unknown) => {
    if (error instanceof ApiError) {
      if (PERMANENT_REVERSAL_REJECTION_CODES.has(error.code)) {
        setActionError(error.message);
      } else if (error.status === 409) {
        setActionError('This loan was just updated by another action. Refresh and try again.');
      } else if (error.status === 403) {
        setActionError("You don't have permission to do this.");
      } else {
        setActionError(error.message);
      }
    } else {
      setActionError('Could not reach the server. Check your connection and try again.');
    }
  };

  const openEdit = () => {
    if (!loan) return;
    const principalNum = Number.parseFloat(loan.principalAmount) || 0;
    // Reverse-derives a display percent from the stored peso amount — the loan's own source of
    // truth is the peso fee, not a percent, so this is a "best starting point," same as every
    // other "default then editable" field elsewhere in this codebase.
    const feePercent = (fee: string) =>
      principalNum > 0 ? (((Number.parseFloat(fee) || 0) / principalNum) * 100).toFixed(3) : '0';
    setEditForm({
      principalAmount: loan.principalAmount,
      addOnRate: loan.addOnInterestRate ?? '',
      interestRate: loan.interestRate,
      installmentCount: String(loan.installmentCount),
      firstRepaymentDate: loan.firstRepaymentDate.slice(0, 10),
      anticipatedDisbursementDate: loan.anticipatedDisbursementDate ? loan.anticipatedDisbursementDate.slice(0, 10) : '',
      processingFeePercent: feePercent(loan.originationFees.processingFee),
      advanceInterestFee: loan.originationFees.advanceInterestFee,
      outstandingBalancePayoff: loan.originationFees.outstandingBalancePayoff,
      docStampFee: loan.originationFees.docStampFee,
      accountManagementFeePercent: feePercent(loan.originationFees.accountManagementFee),
      otherFees: loan.originationFees.otherFees,
      notarialFee: loan.originationFees.notarialFee,
      webFee: loan.originationFees.webFee,
      insuranceFee: loan.originationFees.insuranceFee,
    });
    setActionError(null);
    setEditOpen(true);
  };

  // 2026-07-16 (Edit Loan Account, mockup follow-up): mirrors LoanAccountCreatePage's own
  // Add-On Rate -> Contractual Rate lookup exactly, so editing a loan looks up rates from the
  // same Interest Rate Chart rather than letting staff free-type a contractual rate that may not
  // be on file.
  const rateChartQuery = useQuery({
    queryKey: ['interest-rate-chart'],
    queryFn: () => apiClient.get<PaginatedResponse<InterestRateChartEntry>>('/interest-rate-chart'),
    enabled: editOpen,
  });
  const rateChart = rateChartQuery.data?.items ?? [];
  const addOnRateOptions = React.useMemo(
    () => Array.from(new Set(rateChart.map((e) => e.addOnRatePercent))).sort((a, b) => Number(a) - Number(b)),
    [rateChart],
  );
  const editAddOnRateNum = Number.parseFloat(editForm.addOnRate) || 0;
  const editInstallmentCountNum = Number.parseInt(editForm.installmentCount, 10) || 0;
  const editChartMatch =
    editAddOnRateNum > 0 && editInstallmentCountNum > 0
      ? rateChart.find((e) => Number(e.addOnRatePercent) === editAddOnRateNum && e.termMonths === editInstallmentCountNum)
      : undefined;
  React.useEffect(() => {
    if (editChartMatch) setEditForm((f) => ({ ...f, interestRate: editChartMatch.contractualRatePercent }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editChartMatch?.contractualRatePercent]);

  // 2026-07-16 (mockup follow-up): live Total Fees / Net Proceeds preview, same computation
  // LoanAccountCreatePage shows — processingFee/accountManagementFee are percent-of-principal
  // here, converted to pesos before either display or submit; every other fee is already a flat
  // peso amount.
  const editPrincipalNum = Number.parseFloat(editForm.principalAmount) || 0;
  const editProcessingFee = ((editPrincipalNum * (Number.parseFloat(editForm.processingFeePercent) || 0)) / 100).toFixed(2);
  const editAccountManagementFee = ((editPrincipalNum * (Number.parseFloat(editForm.accountManagementFeePercent) || 0)) / 100).toFixed(2);
  const editTotalFees = (
    Number.parseFloat(editProcessingFee) +
    (Number.parseFloat(editForm.advanceInterestFee) || 0) +
    (Number.parseFloat(editForm.outstandingBalancePayoff) || 0) +
    (Number.parseFloat(editForm.docStampFee) || 0) +
    Number.parseFloat(editAccountManagementFee) +
    (Number.parseFloat(editForm.otherFees) || 0) +
    (Number.parseFloat(editForm.notarialFee) || 0) +
    (Number.parseFloat(editForm.webFee) || 0) +
    (Number.parseFloat(editForm.insuranceFee) || 0)
  ).toFixed(2);
  const editNetProceeds = (editPrincipalNum - Number.parseFloat(editTotalFees)).toFixed(2);

  const editMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<LoanAccount>(`/loan-accounts/${loanId}`, {
        principalAmount: editForm.principalAmount,
        addOnInterestRate: editForm.addOnRate || undefined,
        interestRate: editForm.interestRate,
        installmentCount: Number(editForm.installmentCount),
        firstRepaymentDate: editForm.firstRepaymentDate,
        anticipatedDisbursementDate: editForm.anticipatedDisbursementDate || undefined,
        processingFee: editProcessingFee,
        advanceInterestFee: editForm.advanceInterestFee,
        outstandingBalancePayoff: editForm.outstandingBalancePayoff,
        docStampFee: editForm.docStampFee,
        accountManagementFee: editAccountManagementFee,
        otherFees: editForm.otherFees,
        notarialFee: editForm.notarialFee,
        webFee: editForm.webFee,
        insuranceFee: editForm.insuranceFee,
      }),
    onSuccess: () => {
      setEditOpen(false);
      onActionSuccess();
    },
    onError: onActionError,
  });

  const approveMutation = useMutation({
    mutationFn: () => apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/approve`, {}),
    onSuccess: onActionSuccess,
    onError: onActionError,
  });

  const activateMutation = useMutation({
    mutationFn: () => {
      if (!activateIdempotencyKeyRef.current) activateIdempotencyKeyRef.current = crypto.randomUUID();
      return apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/activate`, {}, {
        'Idempotency-Key': activateIdempotencyKeyRef.current,
      });
    },
    onSuccess: () => {
      activateIdempotencyKeyRef.current = null;
      onActionSuccess();
    },
    onError: onActionError,
  });
  // 2026-07-16 (Undo Approve / Undo Activate, user request, MIS-only): safety nets for an
  // accidental Approve/Activate click. No Idempotency-Key needed — unlike activate above, a
  // duplicate undo attempt just hits ConcurrencyConflictError/InvalidStatusTransitionError on the
  // second call, which onActionError already surfaces sensibly.
  const undoApproveMutation = useMutation({
    mutationFn: () => apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/undo-approve`, {}),
    onSuccess: onActionSuccess,
    onError: onActionError,
  });
  const undoActivateMutation = useMutation({
    mutationFn: () => apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/undo-activate`, {}),
    onSuccess: onActionSuccess,
    onError: onActionError,
  });
  const actionPending =
    approveMutation.isPending || activateMutation.isPending || undoApproveMutation.isPending || undoActivateMutation.isPending;

  const reverseMutation = useMutation({
    mutationFn: () =>
      // Idempotency-Key is derived from the transaction id, not a fresh random one per click
      // (unlike activateMutation above) — a given transaction can only ever be successfully
      // reversed once, so two racing/duplicate attempts at reversing the SAME transaction share
      // this exact key and get deterministically caught by the idempotency layer, rather than one
      // of them hitting a confusing ConcurrencyConflictError. See the backend controller's own
      // doc comment on reversePayment for the full story.
      apiClient.post<LoanAccount>(
        `/loan-accounts/${loanId}/transactions/${reverseTarget!.id}/reverse`,
        { reason: reverseReason.trim() },
        { 'Idempotency-Key': `reverse-payment-${reverseTarget!.id}` },
      ),
    onSuccess: () => {
      setReverseTarget(null);
      setReverseReason('');
      onActionSuccess();
    },
    onError: onActionError,
  });

  const reduceMutation = useMutation({
    mutationFn: () =>
      apiClient.post<RepaymentInstallment>(`/repayment-installments/${reduceTarget!.id}/reduce-penalty`, {
        newAmount: reduceAmount,
        reason: reduceReason.trim(),
      }),
    onSuccess: () => {
      setReduceTarget(null);
      setReduceAmount('');
      setReduceReason('');
      onActionSuccess();
    },
    onError: onActionError,
  });

  const adjustFeesMutation = useMutation({
    mutationFn: () =>
      apiClient.post<RepaymentInstallment>(`/repayment-installments/${adjustFeesTarget!.id}/adjust-fees`, {
        newAmount: adjustFeesAmount,
        reason: adjustFeesReason.trim(),
      }),
    onSuccess: () => {
      setAdjustFeesTarget(null);
      setAdjustFeesAmount('');
      setAdjustFeesReason('');
      onActionSuccess();
    },
    onError: onActionError,
  });

  const openConfirm = (action: 'APPROVE' | 'ACTIVATE' | 'UNDO_APPROVE' | 'UNDO_ACTIVATE') => {
    setActionError(null);
    setConfirmAction(action);
  };
  const openReverseConfirm = (transaction: LoanTransaction) => {
    setActionError(null);
    setReverseReason('');
    setReverseTarget(transaction);
  };
  const openReduceConfirm = (installment: RepaymentInstallment, currentPenalty: number) => {
    setActionError(null);
    setReduceAmount(currentPenalty.toFixed(2));
    setReduceReason('');
    setReduceTarget(installment);
  };
  const openAdjustFeesConfirm = (installment: RepaymentInstallment, currentFees: number) => {
    setActionError(null);
    setAdjustFeesAmount(currentFees.toFixed(2));
    setAdjustFeesReason('');
    setAdjustFeesTarget(installment);
  };
  const confirmLoanStatusChange = () => {
    if (confirmAction === 'APPROVE') approveMutation.mutate();
    else if (confirmAction === 'ACTIVATE') activateMutation.mutate();
    else if (confirmAction === 'UNDO_APPROVE') undoApproveMutation.mutate();
    else if (confirmAction === 'UNDO_ACTIVATE') undoActivateMutation.mutate();
  };

  const borrowerQuery = useQuery({
    queryKey: ['borrower', loan?.borrowerId],
    queryFn: () => apiClient.get<RealBorrower>(`/borrowers/${loan!.borrowerId}`),
    enabled: Boolean(loan?.borrowerId),
  });

  const installmentsQuery = useQuery({
    queryKey: ['repayment-schedule', loanId],
    queryFn: () => apiClient.get<PaginatedResponse<RepaymentInstallment>>(`/loan-accounts/${loanId}/repayment-schedule`),
  });

  const transactionsQuery = useQuery({
    queryKey: ['loan-transactions', loanId],
    queryFn: () => fetchAllPages<LoanTransaction>(`/loan-accounts/${loanId}/transactions`),
  });

  // 2026-07-16 (unified Payment History timeline, user request): penalty reductions and fee
  // adjustments have no ledger impact of their own, so they're a separate endpoint/query, merged
  // with `transactions` only at render time below — not folded into the LoanTransaction list itself.
  const installmentAdjustmentsQuery = useQuery({
    queryKey: ['installment-adjustments', loanId],
    queryFn: () => fetchAllPages<InstallmentAdjustment>(`/loan-accounts/${loanId}/installment-adjustments`),
  });

  // ADR-051 (2026-07-12): loan document generation — Disclosure Statement, Promissory Note, and
  // other applicable legal documents, available once the loan is APPROVED.
  const documentsQuery = useQuery({
    queryKey: ['loan-documents', loanId],
    queryFn: () => apiClient.get<{ items: LoanDocumentListItem[] }>(`/loan-accounts/${loanId}/documents`),
  });
  const [selectedDocumentCodes, setSelectedDocumentCodes] = React.useState<Set<string>>(new Set());
  const [docsError, setDocsError] = React.useState<string | null>(null);
  // Tracks which template is mid-generation so its row/button can show progress — generation runs
  // one at a time (bulk actions loop sequentially) rather than firing every request in parallel,
  // since each one shells out to LibreOffice (ADR-051 §4) and doesn't need to race the others.
  const [generatingCode, setGeneratingCode] = React.useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = React.useState<LoanDocumentPreviewTarget | null>(null);

  const generateDocumentMutation = useMutation({
    mutationFn: (documentTemplateCode: string) =>
      apiClient.post(`/loan-accounts/${loanId}/documents`, { documentTemplateCode }, { 'Idempotency-Key': crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['loan-documents', loanId] });
    },
  });

  const generateDocuments = async (codes: string[]) => {
    setDocsError(null);
    for (const code of codes) {
      setGeneratingCode(code);
      try {
        await generateDocumentMutation.mutateAsync(code);
      } catch (error) {
        setDocsError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
        break; // stop the batch on the first failure rather than piling up more errors
      }
    }
    setGeneratingCode(null);
    setSelectedDocumentCodes(new Set());
  };

  const downloadDocument = async (generatedDocumentId: string, fallbackFileName: string) => {
    try {
      await downloadFile(`/loan-accounts/${loanId}/documents/${generatedDocumentId}/download`, fallbackFileName);
    } catch {
      setDocsError('Could not download the file. Please try again.');
    }
  };

  const toggleDocumentSelected = (code: string) => {
    setSelectedDocumentCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  if (loanQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading loan account…</p>;
  }

  if (!loan) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Loan not found: {loanId}</p>
      </div>
    );
  }

  const borrower = borrowerQuery.data;
  const installments = installmentsQuery.data?.items ?? [];
  const transactions = transactionsQuery.data ?? [];
  // 2026-07-20 user request: the backend (UndoActivateLoanUseCase) already refuses Undo Disburse
  // once a real payment exists (LoanAccountHasActivityError) - this mirrors that same check
  // client-side so the button is disabled with an explanation up front, instead of only failing
  // after the officer clicks it and gets a confirm dialog error.
  const hasRepayment = transactions.some((t) => t.type === 'REPAYMENT');
  const installmentAdjustments = installmentAdjustmentsQuery.data ?? [];
  const num = (v: string) => Number.parseFloat(v) || 0;
  // 2026-07-16 (unified Payment History timeline): interleave real LoanTransactions with penalty
  // reduction/fee adjustment events, newest first — a plain UI-level merge (no ledger impact from
  // the adjustment rows), tagged so the table can render each kind differently.
  type PaymentHistoryRow = { kind: 'TRANSACTION'; at: string; transaction: LoanTransaction } | { kind: 'ADJUSTMENT'; at: string; adjustment: InstallmentAdjustment };
  const paymentHistoryRows: PaymentHistoryRow[] = [
    ...transactions.map((t): PaymentHistoryRow => ({ kind: 'TRANSACTION', at: t.entryDate, transaction: t })),
    ...installmentAdjustments.map((a): PaymentHistoryRow => ({ kind: 'ADJUSTMENT', at: a.at, adjustment: a })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  // 2026-07-11 (Reverse Payment feature): which REPAYMENT ids already have a REVERSAL pointing at
  // them — computed from the same already-fetched transaction list, no extra request needed.
  const reversedTransactionIds = new Set(
    transactions.map((t) => t.reversesTransactionId).filter((id): id is string => id !== null),
  );
  // No real RepaymentInstallment rows exist yet before Activation (the real
  // AmortizationScheduleGenerator only runs at Activate time) - for PENDING_APPROVAL/APPROVED
  // loans, show a client-side preview computed the same way Create Loan Account's own preview
  // does, clearly marked as a preview so staff don't mistake it for the persisted schedule.
  const showSchedulePreview = !installmentsQuery.isLoading && installments.length === 0 && (loan.status === 'PENDING_APPROVAL' || loan.status === 'APPROVED');
  const schedulePreview = showSchedulePreview
    ? previewLoanSchedule(num(loan.principalAmount), num(loan.interestRate), loan.installmentCount, new Date(loan.firstRepaymentDate))
    : null;
  // Every balance column (and the collectionsBalance/accountingBalance getters derived from them)
  // is genuinely 0 before Activation - not because there's no obligation, but because
  // ActivateLoanUseCase is what actually generates the amortization schedule those columns track.
  const notYetActivated = loan.status === 'PENDING_APPROVAL' || loan.status === 'APPROVED';
  const canRecordPayment = loan.status === 'ACTIVE' || loan.status === 'ACTIVE_IN_ARREARS';
  const canReversePayment = currentAccount.roles.includes('MIS');
  // 2026-07-15/16 (Reduce Penalty + Adjust Fees features, user-confirmed): "the accounting
  // officer" - matches the backend's REDUCE_PENALTY_ROLES/ADJUST_FEES_ROLES gates (identical).
  // Gates the whole Actions column, not just one of the two dropdown items.
  const canManageInstallments = currentAccount.roles.includes('MIS') || currentAccount.roles.includes('Accounting');
  // ADR-051 §2: matches GenerateLoanDocumentUseCase's own GENERATABLE_STATUSES gate.
  const canGenerateDocuments = loan.status === 'APPROVED' || loan.status === 'ACTIVE' || loan.status === 'ACTIVE_IN_ARREARS';
  const documents = documentsQuery.data?.items ?? [];
  const requiredDocuments = documents.filter((d) => d.isRequired);
  const ungeneratedRequiredCodes = requiredDocuments.filter((d) => !d.latestGeneration).map((d) => d.documentTemplateCode);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{loan.loanCode}</h2>
          <p className="text-sm text-muted-foreground">
            {borrower ? (
              <Link to={`/clients/${loan.borrowerId}`} className="text-primary underline-offset-2 hover:underline">
                {borrower.firstName} {borrower.lastName}
              </Link>
            ) : (
              'Loading borrower…'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LoanStatusBadge status={loan.status} isMatured={loan.isMatured} />
          {canRecordPayment && (
            <Button size="sm" onClick={() => setRecordPaymentOpen(true)}>
              Record Payment
            </Button>
          )}
          {canCreateLoanAccount && loan.status === 'APPROVED' && (
            <Button size="sm" onClick={() => openConfirm('ACTIVATE')}>
              Disburse Loan
            </Button>
          )}
          {/* 2026-07-16 (Undo Approve / Undo Activate, user request): MIS-only, matching the
              backend's requireRole('MIS') gate — a narrower tier than canCreateLoanAccount
              (ORIGINATION_ROLES), same reasoning as Reverse Payment below. */}
          {currentAccount.roles.includes('MIS') && loan.status === 'APPROVED' && (
            <Button size="sm" variant="outline" onClick={() => openConfirm('UNDO_APPROVE')}>
              Undo Approve
            </Button>
          )}
          {currentAccount.roles.includes('MIS') && loan.status === 'ACTIVE' && (
            <Button
              size="sm"
              variant="outline"
              disabled={hasRepayment}
              onClick={() => openConfirm('UNDO_ACTIVATE')}
              title={hasRepayment ? 'Cannot undo - a payment has already been recorded against this loan.' : undefined}
            >
              Undo Disburse
            </Button>
          )}
          {canCreateLoanAccount && loan.status === 'PENDING_APPROVAL' && (
            <Button size="sm" variant="outline" onClick={openEdit}>
              Edit
            </Button>
          )}
          {canCreateLoanAccount && loan.status === 'PENDING_APPROVAL' && (
            <Button size="sm" onClick={() => openConfirm('APPROVE')}>
              Approve Loan
            </Button>
          )}
        </div>
      </div>

      {actionError && !confirmAction && !reverseTarget && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <RiskAssessmentCard loanId={loan.id} />

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {/* Not yet Activated - every balance column is genuinely 0 only because the amortization
              schedule hasn't been generated yet, not because there's no obligation. Showing "—"
              here avoids that reading as "nothing owed"/"fully paid" for a loan that hasn't
              started. */}
          <MiniStat label="Collections Balance" value={notYetActivated ? '—' : formatPeso(num(loan.collectionsBalance))} emphasize />
          <MiniStat label="Accounting Balance" value={notYetActivated ? '—' : formatPeso(num(loan.accountingBalance))} emphasize />
          <MiniStat label="Principal" value={notYetActivated ? '—' : formatPeso(num(loan.balances.principalBalance))} />
          <MiniStat label="Interest" value={notYetActivated ? '—' : formatPeso(num(loan.balances.interestBalance))} />
          <MiniStat label="Penalty" value={notYetActivated ? '—' : formatPeso(num(loan.balances.penaltyBalance))} />
          <MiniStat label="Fees" value={notYetActivated ? '—' : formatPeso(num(loan.balances.feesBalance))} />
          <MiniStat label="Principal Amount" value={formatPeso(num(loan.principalAmount))} />
          <MiniStat label="Interest Rate" value={formatPercentage(loan.interestRate)} />
          <MiniStat label="Installments" value={String(loan.installmentCount)} />
          <MiniStat label="First Repayment" value={formatDate(loan.firstRepaymentDate)} />
        </CardContent>
      </Card>

      <Card>
        <Tabs defaultValue="schedule">
          <CardHeader className="pb-2">
            <TabsList>
              <TabsTrigger value="schedule">
                Repayment Schedule ({installments.length}
                {schedulePreview ? ` preview: ${schedulePreview.schedule.length}` : ''})
              </TabsTrigger>
              <TabsTrigger value="payments">Payment History ({transactions.length})</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="schedule" className="mt-0">
              {installmentsQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
              ) : installments.length === 0 && schedulePreview ? (
                <>
                  <div className="mb-3 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    Preview only - this loan hasn&apos;t been Disbursed yet, so this schedule hasn&apos;t been generated/persisted. It's
                    computed live from the current Principal, Contractual Rate, Term, and First Repayment Date, and may still change
                    before Activation.
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">#</TableCell>
                        <TableCell className="font-medium text-muted-foreground">Due Date</TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground">Principal</TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground">Interest</TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground">Payment</TableCell>
                        <TableCell className="text-right font-medium text-muted-foreground">Balance</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedulePreview.schedule.map((entry) => (
                        <TableRow key={entry.installmentNumber}>
                          <TableCell>{entry.installmentNumber}</TableCell>
                          <TableCell>{formatDate(entry.dueDate.toISOString())}</TableCell>
                          <TableCell className="text-right">{formatPeso(entry.principalPortion)}</TableCell>
                          <TableCell className="text-right">{formatPeso(entry.interestPortion)}</TableCell>
                          <TableCell className="text-right">{formatPeso(entry.payment)}</TableCell>
                          <TableCell className="text-right font-medium">{formatPeso(entry.endingPrincipal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : installments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No repayment schedule found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">#</TableCell>
                      <TableCell className="font-medium text-muted-foreground">Due Date</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Principal Due</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Interest Due</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Fees Due</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Penalty Due</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Total Due</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Paid</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Remaining</TableCell>
                      <TableCell className="font-medium text-muted-foreground">Status</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Balance</TableCell>
                      {canManageInstallments && <TableCell className="text-center font-medium text-muted-foreground">Actions</TableCell>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // "Balance" (last column) - the SCHEDULED remaining obligation after this
                      // installment: total obligation across the whole schedule minus every
                      // installment's DUE amount through this row (not what's actually been paid).
                      // Deliberately due-based, not paid-based (2026-07-16 bug report comparing
                      // this against the Activation preview's own Balance column): a paid-based
                      // running total stays pinned at the full totalObligation on every single row
                      // until a payment is actually recorded, instead of declining installment by
                      // installment the way an amortization schedule always should - due amounts
                      // are fixed at schedule-generation time and don't depend on payment status,
                      // so this now declines smoothly regardless of what's been paid so far,
                      // matching the preview's own (also due-based) endingPrincipal column.
                      const totalObligation = installments.reduce((sum, i) => {
                        const penalty = i.currentPenaltyOwed !== null ? num(i.currentPenaltyOwed) : num(i.due.penalty);
                        return sum + num(i.due.principal) + num(i.due.interest) + num(i.currentFeesDue) + penalty;
                      }, 0);
                      let cumulativeDue = 0;
                      return installments.map((i) => {
                        const late = wasInstallmentLate(i);
                        // ADR-050 / CALCULATION_ENGINE_SPEC.md §12: currentPenaltyOwed is a live "as
                        // of today" figure for a prospective (non-migrated) loan, OR a frozen manual
                        // override (2026-07-15, Reduce Penalty feature) — isLivePenalty distinguishes
                        // the two so the "(as of today)" label only shows when actually accurate.
                        const penaltyDisplay = i.currentPenaltyOwed !== null ? num(i.currentPenaltyOwed) : num(i.due.penalty);
                        // 2026-07-16 (Adjust Fees feature): currentFeesDue is always non-null — the
                        // fees override amount if one is set, else due.fees (no "live computation"
                        // concept for fees the way penalty has, so no separate isLiveFees flag needed).
                        const feesDisplay = num(i.currentFeesDue);
                        const rowPaid = num(i.paid.principal) + num(i.paid.interest) + num(i.paid.fees) + num(i.paid.penalty);
                        const rowDue = num(i.due.principal) + num(i.due.interest) + num(i.due.fees) + penaltyDisplay;
                        cumulativeDue += rowDue;
                        const balance = Math.max(0, totalObligation - cumulativeDue);
                        const canReduceThisRow = i.status !== 'PAID' && num(i.paid.penalty) === 0;
                        const canAdjustFeesThisRow = i.status !== 'PAID' && num(i.paid.fees) === 0;
                        return (
                          <TableRow key={i.id} className={late ? 'bg-destructive/5' : undefined}>
                            <TableCell>{i.installmentNumber}</TableCell>
                            <TableCell>{formatDate(i.dueDate)}</TableCell>
                            <TableCell className="text-right">{formatPeso(num(i.due.principal))}</TableCell>
                            <TableCell className="text-right">{formatPeso(num(i.due.interest))}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {i.feesOverride ? (
                                <div className="flex flex-col items-end">
                                  <span>{formatPeso(feesDisplay)}</span>
                                  <span className="text-[10px] text-primary" title={i.feesOverride.reason}>
                                    Adjusted by {i.feesOverride.byName ?? 'Accounting'}
                                  </span>
                                </div>
                              ) : (
                                formatPeso(feesDisplay)
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {i.penaltyOverride ? (
                                <div className="flex flex-col items-end">
                                  <span>{formatPeso(penaltyDisplay)}</span>
                                  <span className="text-[10px] text-primary" title={i.penaltyOverride.reason}>
                                    Reduced by {i.penaltyOverride.byName ?? 'Accounting'}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  {formatPeso(penaltyDisplay)}
                                  {i.isLivePenalty && penaltyDisplay > 0 && (
                                    <span className="ml-1 text-[10px] text-muted-foreground/70" title="Live penalty, computed as of today (ADR-050)">
                                      (as of today)
                                    </span>
                                  )}
                                </>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatPeso(num(i.due.principal) + num(i.due.interest) + feesDisplay + penaltyDisplay)}
                            </TableCell>
                            <TableCell className="text-right">{formatPeso(rowPaid)}</TableCell>
                            {(() => {
                              const rowRemaining = Math.max(
                                0,
                                num(i.due.principal) + num(i.due.interest) + feesDisplay + penaltyDisplay - rowPaid,
                              );
                              return (
                                <TableCell
                                  className={cn(
                                    'text-right',
                                    rowRemaining > 0 ? 'font-medium text-warning' : 'text-muted-foreground',
                                  )}
                                >
                                  {formatPeso(rowRemaining)}
                                </TableCell>
                              );
                            })()}
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <InstallmentStatusBadge status={i.status} />
                                {late && i.status === 'PAID' && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    Paid late
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatPeso(balance)}</TableCell>
                            {canManageInstallments && (
                              <TableCell className="text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={!canReduceThisRow && !canAdjustFeesThisRow}
                                      className="h-7 px-2"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      disabled={!canReduceThisRow || penaltyDisplay <= 0}
                                      onSelect={() => openReduceConfirm(i, penaltyDisplay)}
                                    >
                                      Reduce penalty
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={!canAdjustFeesThisRow}
                                      onSelect={() => openAdjustFeesConfirm(i, feesDisplay)}
                                    >
                                      Adjust fees
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      });
                    })()}
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">
                        {formatPeso(installments.reduce((sum, i) => sum + num(i.due.principal), 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(installments.reduce((sum, i) => sum + num(i.due.interest), 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(installments.reduce((sum, i) => sum + num(i.currentFeesDue), 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(
                          installments.reduce(
                            (sum, i) => sum + (i.currentPenaltyOwed !== null ? num(i.currentPenaltyOwed) : num(i.due.penalty)),
                            0,
                          ),
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(
                          installments.reduce((sum, i) => {
                            const penalty = i.currentPenaltyOwed !== null ? num(i.currentPenaltyOwed) : num(i.due.penalty);
                            return sum + num(i.due.principal) + num(i.due.interest) + num(i.currentFeesDue) + penalty;
                          }, 0),
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(
                          installments.reduce(
                            (sum, i) => sum + num(i.paid.principal) + num(i.paid.interest) + num(i.paid.fees) + num(i.paid.penalty),
                            0,
                          ),
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPeso(
                          installments.reduce((sum, i) => {
                            const penalty = i.currentPenaltyOwed !== null ? num(i.currentPenaltyOwed) : num(i.due.penalty);
                            const totalDue = num(i.due.principal) + num(i.due.interest) + num(i.currentFeesDue) + penalty;
                            const paid = num(i.paid.principal) + num(i.paid.interest) + num(i.paid.fees) + num(i.paid.penalty);
                            return sum + Math.max(0, totalDue - paid);
                          }, 0),
                        )}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      {canManageInstallments && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Table>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Rows shaded red are the installments counted as "late" in the Risk Assessment card above - currently overdue, or
                paid after their due date.
              </p>
            </TabsContent>
            <TabsContent value="payments" className="mt-0">
              {transactionsQuery.isLoading || installmentAdjustmentsQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
              ) : paymentHistoryRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No transactions recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell className="w-8" />
                      <TableCell className="font-medium text-muted-foreground">Date</TableCell>
                      <TableCell className="font-medium text-muted-foreground">Type</TableCell>
                      <TableCell className="font-medium text-muted-foreground">OR#</TableCell>
                      <TableCell className="font-medium text-muted-foreground">AR#</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Principal</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Interest</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Penalty</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Fees</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Amount</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Balance After</TableCell>
                      <TableCell className="font-medium text-muted-foreground">Comment</TableCell>
                      {canReversePayment && <TableCell className="font-medium text-muted-foreground">&nbsp;</TableCell>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistoryRows.map((row) => {
                      // 2026-07-16: a penalty reduction / fee adjustment has no ledger impact of its
                      // own — no components, no OR#/AR#, no balance, no allocation breakdown to
                      // expand. Rendered as its own distinct row style (pro/purple) in the same
                      // chronological list rather than a separate table.
                      if (row.kind === 'ADJUSTMENT') {
                        const a = row.adjustment;
                        const label = a.kind === 'PENALTY_REDUCTION' ? 'Penalty reduced' : 'Fee adjusted';
                        return (
                          <TableRow key={a.id} className="bg-primary/5">
                            <TableCell />
                            <TableCell className="text-primary">{formatDate(a.at)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-primary/40 text-primary">
                                {label}
                              </Badge>
                            </TableCell>
                            {/* Spans OR#/AR#/Principal/Interest/Penalty/Fees (6 columns) — none apply to an adjustment event. */}
                            <TableCell colSpan={6} />
                            <TableCell className="text-right font-semibold text-primary">
                              {formatPeso(num(a.previousAmount))} → {formatPeso(num(a.newAmount))}
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-xs text-primary" title={a.reason}>
                              Installment #{a.installmentNumber} · {a.byName ?? 'Accounting'} · {a.reason}
                            </TableCell>
                            {canReversePayment && <TableCell />}
                          </TableRow>
                        );
                      }

                      const t = row.transaction;
                      const isReversed = reversedTransactionIds.has(t.id);
                      const isExpandable = t.type === 'REPAYMENT';
                      const isExpanded = expandedTransactionId === t.id;
                      return (
                        <React.Fragment key={t.id}>
                        <TableRow
                          className={cn(isReversed && 'opacity-60', isExpandable && 'cursor-pointer')}
                          onClick={isExpandable ? () => setExpandedTransactionId(isExpanded ? null : t.id) : undefined}
                          title={isExpandable ? 'Click to see which installments this payment was applied to' : undefined}
                        >
                          <TableCell className="w-8 text-muted-foreground">
                            {isExpandable &&
                              (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                          </TableCell>
                          <TableCell>
                            {formatDate(t.entryDate)}
                            {isReversed && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">
                                Reversed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <TransactionTypeBadge type={t.type} />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{t.orNumber ?? '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{t.arNumber ?? '—'}</TableCell>
                          <TableCell className="text-right">{formatPeso(num(t.principalComponent))}</TableCell>
                          <TableCell className="text-right">{formatPeso(num(t.interestComponent))}</TableCell>
                          <TableCell className="text-right">{formatPeso(num(t.penaltyComponent))}</TableCell>
                          <TableCell className="text-right">{formatPeso(num(t.feesComponent))}</TableCell>
                          <TableCell className="text-right font-semibold">{formatPeso(num(t.amount))}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatPeso(num(t.balanceAfter))}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.comment ?? '-'}</TableCell>
                          {canReversePayment && (
                            <TableCell>
                              {t.type === 'REPAYMENT' && !isReversed && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReverseConfirm(t);
                                  }}
                                >
                                  Reverse
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell />
                            <TableCell colSpan={canReversePayment ? 12 : 11}>
                              <TransactionAllocationsPanel transactionId={t.id} />
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <RealRemindersPanel loanAccountId={loan.id} loanCode={loan.loanCode} borrower={borrower} installments={installments} />

      <ProfileNotesPanel ownerType="LOAN_ACCOUNT" ownerId={loan.id} />

      <RealAttachmentsPanel ownerType="LOAN_ACCOUNT" ownerId={loan.id} canUpload />

      {/* ADR-051 (2026-07-12): loan document generation — Disclosure Statement, Promissory Note,
          and other legal documents applicable to this loan's product, available once APPROVED. */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>Disclosure Statement, Promissory Note, and other legal documents applicable to this loan (ADR-051).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canGenerateDocuments ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Available once this loan is approved.</p>
          ) : documentsQuery.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {docsError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{docsError}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {requiredDocuments.length - ungeneratedRequiredCodes.length} of {requiredDocuments.length} required documents generated
                </p>
                <Button
                  size="sm"
                  onClick={() => generateDocuments(ungeneratedRequiredCodes)}
                  disabled={ungeneratedRequiredCodes.length === 0 || generatingCode !== null}
                >
                  {generatingCode ? 'Generating…' : 'Generate all required'}
                </Button>
              </div>
              <ul className="space-y-2">
                {documents.map((doc) => {
                  const isBusy = generatingCode === doc.documentTemplateCode;
                  return (
                    <li
                      key={doc.documentTemplateId}
                      className={cn('flex items-center justify-between gap-2 rounded-md border p-3', !doc.latestGeneration && 'border-dashed')}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={selectedDocumentCodes.has(doc.documentTemplateCode)}
                          onChange={() => toggleDocumentSelected(doc.documentTemplateCode)}
                          aria-label={`Select ${doc.documentTemplateName}`}
                        />
                        <FileCheck2 className={cn('h-4 w-4', doc.latestGeneration ? 'text-emerald-600' : 'text-muted-foreground')} />
                        <div>
                          <p className={cn('text-sm font-medium', !doc.latestGeneration && 'text-muted-foreground')}>{doc.documentTemplateName}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.latestGeneration
                              ? `Generated by ${doc.latestGeneration.generatedByName} · ${formatDate(doc.latestGeneration.generatedAt)}`
                              : doc.isRequired
                                ? 'Required · not generated yet'
                                : 'Optional · not generated yet'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {doc.latestGeneration && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPreviewTarget({
                                  loanAccountId: loanId,
                                  generatedDocumentId: doc.latestGeneration!.id,
                                  title: doc.documentTemplateName,
                                  fileName: `${doc.documentTemplateName}.pdf`,
                                })
                              }
                            >
                              Preview
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadDocument(doc.latestGeneration!.id, `${doc.documentTemplateName}.pdf`)}
                            >
                              Download
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateDocuments([doc.documentTemplateCode])}
                          disabled={isBusy || generatingCode !== null}
                        >
                          {isBusy ? '…' : doc.latestGeneration ? 'Regenerate' : 'Generate'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
                {documents.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No documents configured for this loan's product.</p>}
              </ul>
              {documents.length > 0 && (
                <div className="flex items-center justify-between border-t pt-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={selectedDocumentCodes.size === documents.length}
                      onChange={(e) =>
                        setSelectedDocumentCodes(e.target.checked ? new Set(documents.map((d) => d.documentTemplateCode)) : new Set())
                      }
                    />
                    Select all
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateDocuments([...selectedDocumentCodes])}
                    disabled={selectedDocumentCodes.size === 0 || generatingCode !== null}
                  >
                    Generate selected ({selectedDocumentCodes.size})
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Log of all actions taken on this loan account by loan officers</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileActivityTimeline profileType="LOAN_ACCOUNT" profileId={loan.id} />
        </CardContent>
      </Card>

      <RecentActivityPanel label="Loan Account" entityId={loan.id} />

      <Dialog open={editOpen} onOpenChange={(open) => !open && !editMutation.isPending && setEditOpen(false)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {loan.loanCode}</DialogTitle>
            <DialogDescription>
              Only available while Pending Approval — every field below is locked once the loan is approved.
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <p className="text-xs font-medium text-muted-foreground">Loan terms</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-principal">Principal amount</Label>
              <Input
                id="edit-principal"
                type="number"
                min="0"
                step="0.01"
                value={editForm.principalAmount}
                onChange={(e) => setEditForm((f) => ({ ...f, principalAmount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-term">Term (installments)</Label>
              <Input
                id="edit-term"
                type="number"
                min="1"
                step="1"
                value={editForm.installmentCount}
                onChange={(e) => setEditForm((f) => ({ ...f, installmentCount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-add-on-rate">Add-on rate (% monthly)</Label>
              <Select value={editForm.addOnRate} onValueChange={(v) => setEditForm((f) => ({ ...f, addOnRate: v }))}>
                <SelectTrigger id="edit-add-on-rate">
                  <SelectValue placeholder={rateChartQuery.isLoading ? 'Loading…' : 'Select an add-on rate…'} />
                </SelectTrigger>
                <SelectContent>
                  {addOnRateOptions.map((rate) => (
                    <SelectItem key={rate} value={rate}>
                      {rate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {editForm.addOnRate ? "Pre-filled from this loan's saved rate." : 'Looks up the contractual rate from the Interest Rate Chart, by this rate and the term.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-interest-rate">Contractual rate (% monthly)</Label>
              <Input id="edit-interest-rate" type="number" min="0" step="0.001" value={editForm.interestRate} readOnly disabled className="bg-muted" />
              {editAddOnRateNum > 0 && editInstallmentCountNum > 0 && !editChartMatch && (
                <p className="text-xs text-warning">
                  No Interest Rate Chart entry for {editAddOnRateNum}% / {editInstallmentCountNum} months — not on file, please confirm
                  with MIS before proceeding.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-first-repayment">First repayment date</Label>
              <Input
                id="edit-first-repayment"
                type="date"
                value={editForm.firstRepaymentDate}
                onChange={(e) => setEditForm((f) => ({ ...f, firstRepaymentDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-disbursement-date">Anticipated disbursement date</Label>
              <Input
                id="edit-disbursement-date"
                type="date"
                value={editForm.anticipatedDisbursementDate}
                onChange={(e) => setEditForm((f) => ({ ...f, anticipatedDisbursementDate: e.target.value }))}
              />
            </div>
          </div>

          <p className="pt-2 text-xs font-medium text-muted-foreground">Origination fees (one-time, taken at disbursement)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-processingFeePercent" className="text-xs text-muted-foreground">
                Processing fee (%)
              </Label>
              <Input
                id="edit-processingFeePercent"
                type="number"
                min="0"
                step="0.01"
                value={editForm.processingFeePercent}
                onChange={(e) => setEditForm((f) => ({ ...f, processingFeePercent: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">= {formatPeso(Number.parseFloat(editProcessingFee))}</p>
            </div>
            {(
              [
                ['advanceInterestFee', 'Advance interest fee'],
                ['outstandingBalancePayoff', 'Outstanding balance payoff'],
                ['docStampFee', 'Doc stamp fee'],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`edit-${field}`} className="text-xs text-muted-foreground">
                  {label}
                </Label>
                <Input
                  id={`edit-${field}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm[field]}
                  onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="edit-accountManagementFeePercent" className="text-xs text-muted-foreground">
                Account management fee (%)
              </Label>
              <Input
                id="edit-accountManagementFeePercent"
                type="number"
                min="0"
                step="0.01"
                value={editForm.accountManagementFeePercent}
                onChange={(e) => setEditForm((f) => ({ ...f, accountManagementFeePercent: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">= {formatPeso(Number.parseFloat(editAccountManagementFee))}</p>
            </div>
            {(
              [
                ['otherFees', 'Other fees'],
                ['notarialFee', 'Notarial fee'],
                ['webFee', 'Web fee'],
                ['insuranceFee', 'Insurance fee'],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`edit-${field}`} className="text-xs text-muted-foreground">
                  {label}
                </Label>
                <Input
                  id={`edit-${field}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm[field]}
                  onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div>
              <p className="text-xs text-muted-foreground">Total fees</p>
              <p className="text-sm font-medium">{formatPeso(Number.parseFloat(editTotalFees))}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Net proceeds</p>
              <p className="text-sm font-medium text-success">{formatPeso(Number.parseFloat(editNetProceeds))}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && !actionPending && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Confirm{' '}
              {confirmAction === 'APPROVE'
                ? 'approval'
                : confirmAction === 'ACTIVATE'
                  ? 'disbursement'
                  : confirmAction === 'UNDO_APPROVE'
                    ? 'undo approve'
                    : 'undo disburse'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'APPROVE' &&
                `This will approve ${loan.loanCode} — the account moves from Pending Approval to Approved, ready to be disbursed. This is a safety-net confirmation to prevent an accidental click.`}
              {confirmAction === 'ACTIVATE' &&
                `This will disburse ${loan.loanCode} — releasing the loan, generating its repayment schedule (${loan.installmentCount} installments starting ${formatDate(loan.firstRepaymentDate)}), and moving it to Active. This is a safety-net confirmation to prevent an accidental click.`}
              {confirmAction === 'UNDO_APPROVE' &&
                `This will move ${loan.loanCode} back from Approved to Pending Approval, so its term/amount can be corrected before approving again.`}
              {confirmAction === 'UNDO_ACTIVATE' &&
                `This will move ${loan.loanCode} back from Active to Approved — its repayment schedule will be deleted and balances reset to zero. Only allowed while no payment or penalty/fee adjustment has been recorded yet. The original disbursement stays in Payment History as a record of what happened.`}
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={actionPending}>
              Cancel
            </Button>
            <Button onClick={confirmLoanStatusChange} disabled={actionPending}>
              {actionPending ? 'Processing…' : 'Yes, confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reverseTarget !== null}
        onOpenChange={(open) => !open && !reverseMutation.isPending && (setReverseTarget(null), setReverseReason(''))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Reverse this payment?
            </DialogTitle>
            <DialogDescription>
              {reverseTarget &&
                `This creates a new REVERSAL transaction undoing the ${formatPeso(num(reverseTarget.amount))} payment from ${formatDate(reverseTarget.entryDate)} — the original entry is never edited or deleted, only corrected. After reversing, record the correct payment as a new entry. A reason is required.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reverse-reason">Reason</Label>
            <Textarea
              id="reverse-reason"
              placeholder="e.g. Cashier entered the wrong amount"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              disabled={reverseMutation.isPending}
            />
          </div>
          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReverseTarget(null);
                setReverseReason('');
              }}
              disabled={reverseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reverseMutation.mutate()}
              disabled={reverseMutation.isPending || reverseReason.trim().length === 0}
            >
              {reverseMutation.isPending ? 'Reversing…' : 'Yes, reverse this payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reduceTarget !== null}
        onOpenChange={(open) => !open && !reduceMutation.isPending && (setReduceTarget(null), setReduceAmount(''), setReduceReason(''))}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reduce penalty</DialogTitle>
            <DialogDescription>
              {reduceTarget &&
                `Installment #${reduceTarget.installmentNumber} · ${formatDate(reduceTarget.dueDate)}. Freezes this installment's penalty at the amount entered — it stops recalculating day over day until paid or reduced again. Approved outside this system; the reason below records that reference.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reduce-amount">New penalty amount</Label>
            <div className="flex gap-2">
              <Input
                id="reduce-amount"
                type="number"
                min="0"
                step="0.01"
                value={reduceAmount}
                onChange={(e) => setReduceAmount(e.target.value)}
                disabled={reduceMutation.isPending}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setReduceAmount('0.00')} disabled={reduceMutation.isPending}>
                Set to ₱0.00
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reduce-reason">Reason / external approval reference</Label>
            <Textarea
              id="reduce-reason"
              placeholder="e.g. Approved by Branch Manager J. Santos, memo #2026-0714"
              value={reduceReason}
              onChange={(e) => setReduceReason(e.target.value)}
              disabled={reduceMutation.isPending}
            />
          </div>
          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReduceTarget(null);
                setReduceAmount('');
                setReduceReason('');
              }}
              disabled={reduceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => reduceMutation.mutate()}
              disabled={reduceMutation.isPending || reduceReason.trim().length === 0 || reduceAmount.trim().length === 0}
            >
              {reduceMutation.isPending ? 'Reducing…' : 'Reduce penalty'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adjustFeesTarget !== null}
        onOpenChange={(open) =>
          !open && !adjustFeesMutation.isPending && (setAdjustFeesTarget(null), setAdjustFeesAmount(''), setAdjustFeesReason(''))
        }
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust fees</DialogTitle>
            <DialogDescription>
              {adjustFeesTarget &&
                `Installment #${adjustFeesTarget.installmentNumber} · ${formatDate(adjustFeesTarget.dueDate)}. Sets this installment's fees due to the amount entered — may be raised or lowered. Approved outside this system; the reason below records that reference.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-fees-amount">New fees amount</Label>
            <div className="flex gap-2">
              <Input
                id="adjust-fees-amount"
                type="number"
                min="0"
                step="0.01"
                value={adjustFeesAmount}
                onChange={(e) => setAdjustFeesAmount(e.target.value)}
                disabled={adjustFeesMutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdjustFeesAmount('0.00')}
                disabled={adjustFeesMutation.isPending}
              >
                Set to ₱0.00
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-fees-reason">Reason / external approval reference</Label>
            <Textarea
              id="adjust-fees-reason"
              placeholder="e.g. Approved by Branch Manager J. Santos, memo #2026-0714"
              value={adjustFeesReason}
              onChange={(e) => setAdjustFeesReason(e.target.value)}
              disabled={adjustFeesMutation.isPending}
            />
          </div>
          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAdjustFeesTarget(null);
                setAdjustFeesAmount('');
                setAdjustFeesReason('');
              }}
              disabled={adjustFeesMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => adjustFeesMutation.mutate()}
              disabled={adjustFeesMutation.isPending || adjustFeesReason.trim().length === 0 || adjustFeesAmount.trim().length === 0}
            >
              {adjustFeesMutation.isPending ? 'Adjusting…' : 'Adjust fees'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoanDocumentPreviewModal target={previewTarget} onClose={() => setPreviewTarget(null)} />

      <Dialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen}>
        <DialogContent
          className="max-h-[90vh] max-w-6xl overflow-y-auto"
          // Radix's default open-focus behavior auto-focuses the first focusable element inside the
          // dialog - here, the Payment amount field, since this dialog skips straight to "Payment
          // Details" (locked borrower/loan). That field being focused before the user has clicked
          // it at all meant NumberInput's own "don't stomp an in-progress edit" guard blocked the
          // auto-fill-from-next-due-amount effect from ever showing (2026-07-16 bug report - a
          // blinking caret with no keystrokes, and the amount staying blank). Skip the auto-focus
          // entirely - nothing in this dialog needs to grab focus the instant it opens.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {loan.loanCode} - {borrower ? `${borrower.firstName} ${borrower.lastName}` : 'Loading borrower…'}
            </DialogDescription>
          </DialogHeader>
          {recordPaymentOpen && borrower && (
            <PaymentRecordingForm
              lockedBorrower={borrower}
              lockedLoan={loan}
              showChrome={false}
              onDone={() => setRecordPaymentOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LoanDetailPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  useLogPageView('Loan Account Detail', loanId);

  if (!loanId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">No loan account specified.</p>
      </div>
    );
  }

  return <RealLoanDetailView loanId={loanId} />;
}
