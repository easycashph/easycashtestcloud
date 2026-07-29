import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSection } from '@/components/SortableSection';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck2,
  Globe2,
  Info,
  Mail,
  MessageSquareText,
  Lock,
  MoreHorizontal,
  Receipt,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiClient, ApiError, downloadFile, fetchAllPages } from '@/lib/apiClient';
import { ConcurrencyConflictDialog, type ConcurrencyConflictField } from '@/components/ConcurrencyConflictDialog';
import type { LoanSigningSessionStatus } from '@/lib/loanSigningApiTypes';
import type {
  AccruedInterestFigures,
  Borrower as RealBorrower,
  CoBorrower,
  GeneratedStatementOfAccountListItem,
  InstallmentAdjustment,
  InterestRateChartEntry,
  LoanAccount,
  LoanDocumentListItem,
  LoanRestructureView,
  LoanAdjustmentView,
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
import { buildDocumentFileName, cn, formatDate, formatDateTime, formatPercentage, formatPeso, generateUuid } from '@/lib/utils';
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
/** Order these render in by default, and the only valid section ids for the drag-to-reorder
 * feature below (see `RealLoanDetailView`'s `cardOrder` state). */
const DEFAULT_CARD_ORDER = ['reminders', 'notes', 'attachments', 'documents', 'esignature', 'soa', 'activityTimeline', 'recentActivity'];

const CARD_ORDER_KEY_PREFIX = 'lms.loanDetailCardOrder';

/** 2026-07-23 (user request): shown in the "Confirm disbursement" dialog so the officer sees the
 * actual amount being released, not just the principal - only non-zero fees are listed (see the
 * dialog's own filter), since most loans don't carry every fee type. */
const DISBURSEMENT_FEE_FIELDS: { key: keyof LoanAccount['originationFees']; label: string }[] = [
  { key: 'processingFee', label: 'Processing fee' },
  { key: 'advanceInterestFee', label: 'Advance interest fee' },
  { key: 'outstandingBalancePayoff', label: 'Outstanding balance payoff' },
  { key: 'docStampFee', label: 'Doc stamp fee' },
  { key: 'accountManagementFee', label: 'Account management fee' },
  { key: 'otherFees', label: 'Other fees' },
  { key: 'notarialFee', label: 'Notarial fee' },
  { key: 'webFee', label: 'Web fee' },
  { key: 'insuranceFee', label: 'Insurance fee' },
];

/** Per-user like `sidebarCollapsedKey` in AppLayout.tsx - one officer's preferred section order on
 * a shared machine shouldn't silently apply to whoever logs in next. */
function cardOrderKey(userId: string): string {
  return `${CARD_ORDER_KEY_PREFIX}:${userId}`;
}

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
      <p className={cn('tabular-nums', emphasize ? 'text-xl font-semibold' : 'text-sm text-muted-foreground')}>{value}</p>
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
 * `NotesPanel` 2026-07-13), Reminders
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
/** 2026-07-22 (e-signature, phase 1 - required documents only). Sends every required document
 * (generating any not already on file) as one batch, one SMS link, one OTP verification covering
 * the whole client visit. See `docs/Claude_API_Cost_Reference.docx`-adjacent design discussion -
 * this is unrelated to that AI feature, just noting the same session's design-first pattern. */
/** First-letter-of-first-two-words initials for the party avatar (e.g. "Juan Dela Cruz" -> "JD"); falls back to a generic 2-letter tag when no name is on file yet. */
function partyInitials(name: string | undefined, fallback: string): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || fallback;
}

type SigningChannel = 'SMS' | 'EMAIL';

function LoanSigningPanel({
  loanId,
  loanCode,
  defaultPhoneNumber,
  defaultCoBorrowerPhoneNumber,
  borrowerName,
  coBorrowerName,
  borrowerEmail,
  coBorrowerEmail,
  canSend,
}: {
  loanId: string;
  loanCode: string;
  defaultPhoneNumber?: string;
  defaultCoBorrowerPhoneNumber?: string;
  borrowerName?: string;
  coBorrowerName?: string;
  /** 2026-07-28 (email delivery channel) - display-only, auto-read from the profile, never staff-entered (unlike the phone number boxes below). */
  borrowerEmail?: string;
  coBorrowerEmail?: string;
  canSend: boolean;
}) {
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = React.useState(defaultPhoneNumber ?? '');
  const [coBorrowerPhoneNumber, setCoBorrowerPhoneNumber] = React.useState(defaultCoBorrowerPhoneNumber ?? '');
  const [borrowerChannel, setBorrowerChannel] = React.useState<SigningChannel>('SMS');
  const [coBorrowerChannel, setCoBorrowerChannel] = React.useState<SigningChannel>('SMS');

  // The co-borrower profile (and its phone number) is fetched by a separate query on the parent
  // page and may resolve after this component's first render (borrower/co-borrower requests run in
  // parallel, not guaranteed to finish in order) - sync the default in once it arrives, same as any
  // other "fill from a slower-loading query" field. Does not overwrite whatever staff already typed.
  const hasAppliedCoBorrowerDefault = React.useRef(false);
  React.useEffect(() => {
    if (hasAppliedCoBorrowerDefault.current) return;
    if (!defaultCoBorrowerPhoneNumber) return;
    hasAppliedCoBorrowerDefault.current = true;
    setCoBorrowerPhoneNumber(defaultCoBorrowerPhoneNumber);
  }, [defaultCoBorrowerPhoneNumber]);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [signedDocPreview, setSignedDocPreview] = React.useState<LoanDocumentPreviewTarget | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ['loan-signing-sessions', loanId],
    queryFn: () => apiClient.get<{ items: LoanSigningSessionStatus[] }>(`/loan-accounts/${loanId}/signing-sessions`),
    enabled: canSend,
    // 2026-07-22: signing happens on the client's own phone, not this browser - poll while any
    // session is still in progress so the staff view catches up without a manual refresh. Stops
    // once every session is fully signed (or revoked) so an idle, fully-signed loan doesn't keep
    // polling forever.
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const stillInProgress = items.some((s) => !s.fullySigned && !s.revokedAt);
      return stillInProgress ? 5000 : false;
    },
  });
  const sessions = sessionsQuery.data?.items ?? [];

  const sendMutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanSigningSessionStatus>(`/loan-accounts/${loanId}/signing-sessions`, {
        phoneNumber,
        partyType: 'BORROWER',
      }),
    onSuccess: () => {
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: ['loan-signing-sessions', loanId] });
    },
    onError: (error: unknown) => {
      setSendError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  // 2026-07-25 (two-party signing, revised) - staff-entered phone number, same as the borrower's
  // own box below - a CoBorrower profile must still exist (linked to this loan's borrower) for the
  // signer's name/identity, but the number itself is never silently read from that profile, so
  // staff can send to an updated/different number without editing the CoBorrower record first.
  const sendCoBorrowerMutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanSigningSessionStatus>(`/loan-accounts/${loanId}/signing-sessions`, {
        phoneNumber: coBorrowerPhoneNumber,
        partyType: 'CO_BORROWER',
      }),
    onSuccess: () => {
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: ['loan-signing-sessions', loanId] });
    },
    onError: (error: unknown) => {
      setSendError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  // 2026-07-28 (email delivery channel) - alternative to the SMS buttons above, added after
  // confirming some Smart-network numbers silently filter link-containing SMS. The email address
  // is auto-read from the profile server-side (see CreateLoanSigningSessionUseCase) - no
  // phoneNumber is sent here, since staff never types the email in.
  const sendViaEmailMutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanSigningSessionStatus>(`/loan-accounts/${loanId}/signing-sessions`, {
        partyType: 'BORROWER',
        channel: 'EMAIL',
      }),
    onSuccess: () => {
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: ['loan-signing-sessions', loanId] });
    },
    onError: (error: unknown) => {
      setSendError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  const sendCoBorrowerViaEmailMutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanSigningSessionStatus>(`/loan-accounts/${loanId}/signing-sessions`, {
        partyType: 'CO_BORROWER',
        channel: 'EMAIL',
      }),
    onSuccess: () => {
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: ['loan-signing-sessions', loanId] });
    },
    onError: (error: unknown) => {
      setSendError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  if (!canSend) return null;

  const borrowerSendMutation = borrowerChannel === 'EMAIL' ? sendViaEmailMutation : sendMutation;
  const coBorrowerSendMutation = coBorrowerChannel === 'EMAIL' ? sendCoBorrowerViaEmailMutation : sendCoBorrowerMutation;
  const borrowerCanSend = borrowerChannel === 'EMAIL' ? Boolean(borrowerEmail) : Boolean(phoneNumber.trim());
  const coBorrowerCanSend = coBorrowerChannel === 'EMAIL' ? Boolean(coBorrowerEmail) : Boolean(coBorrowerPhoneNumber.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-signature</CardTitle>
        <CardDescription>
          Send this loan's applicable documents to each party for signature - one link, one code, every document signed in the same
          visit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sendError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{sendError}</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {partyInitials(borrowerName, 'B')}
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">Borrower</p>
              {borrowerName && <p className="text-xs text-muted-foreground">{borrowerName}</p>}
            </div>
          </div>
          {borrowerChannel === 'SMS' ? (
            <>
              <Input
                placeholder="09XX XXX XXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className={cn('mb-1.5', !phoneNumber.trim() && 'border-warning')}
                aria-label="Borrower mobile number"
              />
              {!phoneNumber.trim() && (
                <div className="mb-2.5 flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                  <p className="text-xs text-warning">No mobile number on file for the borrower. Enter one above to send via SMS.</p>
                </div>
              )}
            </>
          ) : (
            <p className="mb-2.5 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {borrowerEmail ?? 'No email on file for the borrower'}
            </p>
          )}
          <div className="mb-2.5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setBorrowerChannel('SMS')}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border p-2 transition-colors',
                borrowerChannel === 'SMS' ? 'border-primary bg-primary/10' : 'hover:bg-muted/40',
              )}
            >
              <MessageSquareText className={cn('h-4 w-4', borrowerChannel === 'SMS' ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-xs font-medium', borrowerChannel === 'SMS' && 'text-primary')}>SMS</span>
            </button>
            <button
              type="button"
              onClick={() => setBorrowerChannel('EMAIL')}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border p-2 transition-colors',
                borrowerChannel === 'EMAIL' ? 'border-primary bg-primary/10' : 'hover:bg-muted/40',
              )}
            >
              <Mail className={cn('h-4 w-4', borrowerChannel === 'EMAIL' ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-xs font-medium', borrowerChannel === 'EMAIL' && 'text-primary')}>Email</span>
            </button>
            <button type="button" disabled className="relative flex cursor-not-allowed flex-col items-center gap-1 rounded-md border p-2 opacity-50">
              <Badge variant="warning" className="absolute -right-1.5 -top-2 px-1.5 py-0 text-[9px]">
                Soon
              </Badge>
              <Globe2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Portal</span>
            </button>
          </div>
          <div className="mb-2.5 flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              OTP verification will also be sent via <span className="font-medium text-foreground">{borrowerChannel === 'EMAIL' ? 'email' : 'SMS'}</span> —
              same channel as the link
            </p>
          </div>
          <Button className="w-full" onClick={() => borrowerSendMutation.mutate()} disabled={!borrowerCanSend || borrowerSendMutation.isPending}>
            {borrowerSendMutation.isPending ? 'Sending…' : `Send via ${borrowerChannel === 'EMAIL' ? 'Email' : 'SMS'}`}
          </Button>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
              {partyInitials(coBorrowerName, 'CB')}
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">Co-borrower</p>
              {coBorrowerName && <p className="text-xs text-muted-foreground">{coBorrowerName}</p>}
            </div>
          </div>
          {coBorrowerChannel === 'SMS' ? (
            <>
              <Input
                placeholder="09XX XXX XXXX"
                value={coBorrowerPhoneNumber}
                onChange={(e) => setCoBorrowerPhoneNumber(e.target.value)}
                className={cn('mb-1.5', !coBorrowerPhoneNumber.trim() && 'border-warning')}
                aria-label="Co-borrower mobile number"
              />
              {!coBorrowerPhoneNumber.trim() && (
                <div className="mb-2.5 flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                  <p className="text-xs text-warning">No mobile number on file for the co-borrower. Enter one above to send via SMS.</p>
                </div>
              )}
            </>
          ) : (
            <p className="mb-2.5 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {coBorrowerEmail ?? 'No email on file for the co-borrower'}
            </p>
          )}
          <div className="mb-2.5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCoBorrowerChannel('SMS')}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border p-2 transition-colors',
                coBorrowerChannel === 'SMS' ? 'border-primary bg-primary/10' : 'hover:bg-muted/40',
              )}
            >
              <MessageSquareText className={cn('h-4 w-4', coBorrowerChannel === 'SMS' ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-xs font-medium', coBorrowerChannel === 'SMS' && 'text-primary')}>SMS</span>
            </button>
            <button
              type="button"
              onClick={() => setCoBorrowerChannel('EMAIL')}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border p-2 transition-colors',
                coBorrowerChannel === 'EMAIL' ? 'border-primary bg-primary/10' : 'hover:bg-muted/40',
              )}
            >
              <Mail className={cn('h-4 w-4', coBorrowerChannel === 'EMAIL' ? 'text-primary' : 'text-muted-foreground')} />
              <span className={cn('text-xs font-medium', coBorrowerChannel === 'EMAIL' && 'text-primary')}>Email</span>
            </button>
            <button type="button" disabled className="relative flex cursor-not-allowed flex-col items-center gap-1 rounded-md border p-2 opacity-50">
              <Badge variant="warning" className="absolute -right-1.5 -top-2 px-1.5 py-0 text-[9px]">
                Soon
              </Badge>
              <Globe2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Portal</span>
            </button>
          </div>
          <div className="mb-2.5 flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              OTP verification will also be sent via{' '}
              <span className="font-medium text-foreground">{coBorrowerChannel === 'EMAIL' ? 'email' : 'SMS'}</span> — same channel as
              the link
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => coBorrowerSendMutation.mutate()}
            disabled={!coBorrowerCanSend || coBorrowerSendMutation.isPending}
          >
            {coBorrowerSendMutation.isPending ? 'Sending…' : `Send via ${coBorrowerChannel === 'EMAIL' ? 'Email' : 'SMS'}`}
          </Button>
        </div>
        </div>

        {sessionsQuery.isLoading ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No signing links sent yet.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="space-y-2 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{s.partyType === 'CO_BORROWER' ? 'Co-Borrower' : 'Borrower'}</span> ·
                      Sent to {s.phoneNumber} · {formatDate(s.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.signedDocuments} of {s.totalDocuments} signed
                      {s.otpVerifiedAt ? ' · opened' : ' · not yet opened'}
                    </p>
                  </div>
                  <Badge variant={s.fullySigned ? 'success' : s.revokedAt ? 'destructive' : 'outline'}>
                    {s.fullySigned ? 'Fully signed' : s.revokedAt ? 'Revoked' : 'Awaiting signature'}
                  </Badge>
                </div>
                {s.documents && s.documents.length > 0 && (
                  <ul className="space-y-1 rounded-md bg-muted/40 p-2">
                    {s.documents.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className={d.signed ? 'text-foreground' : 'text-muted-foreground'}>{d.name}</span>
                        {d.signed ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() =>
                                setSignedDocPreview({
                                  downloadPath: `/loan-accounts/${loanId}/signing-sessions/${s.id}/documents/${d.id}/file`,
                                  title: d.name,
                                  fileName: buildDocumentFileName(loanCode, d.name, 'signed'),
                                })
                              }
                            >
                              <Eye className="mr-1 h-3 w-3" /> View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() =>
                                void downloadFile(
                                  `/loan-accounts/${loanId}/signing-sessions/${s.id}/documents/${d.id}/file`,
                                  buildDocumentFileName(loanCode, d.name, 'signed'),
                                ).catch(() => setSendError('Could not download the file. Please try again.'))
                              }
                            >
                              Download
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not yet signed</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <LoanDocumentPreviewModal target={signedDocPreview} onClose={() => setSignedDocPreview(null)} />
    </Card>
  );
}

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
  const { currentAccount, canCreateLoanAccount, canApproveLoanAccount, canActivateLoanAccount } = useRole();

  // 2026-07-22 (user request): the lower sections of this page (Reminders through Recent Activity)
  // are drag-to-reorder - each staff member's own arrangement, saved per-user like the sidebar
  // collapse preference (AppLayout.tsx), so one officer's preferred layout doesn't affect anyone
  // else logged into the same machine.
  const [cardOrder, setCardOrder] = React.useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CARD_ORDER;
    try {
      const saved = window.localStorage.getItem(cardOrderKey(currentAccount.id));
      if (!saved) return DEFAULT_CARD_ORDER;
      const parsed = JSON.parse(saved) as string[];
      // Guard against a stale saved order missing a section added since (or naming a section that
      // no longer exists) - always fall back to the full default set rather than silently drop one.
      const isValid = Array.isArray(parsed) && DEFAULT_CARD_ORDER.every((id) => parsed.includes(id)) && parsed.length === DEFAULT_CARD_ORDER.length;
      return isValid ? parsed : DEFAULT_CARD_ORDER;
    } catch {
      return DEFAULT_CARD_ORDER;
    }
  });
  React.useEffect(() => {
    window.localStorage.setItem(cardOrderKey(currentAccount.id), JSON.stringify(cardOrder));
  }, [cardOrder, currentAccount.id]);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCardOrder((order) => {
      const oldIndex = order.indexOf(String(active.id));
      const newIndex = order.indexOf(String(over.id));
      return oldIndex === -1 || newIndex === -1 ? order : arrayMove(order, oldIndex, newIndex);
    });
  };

  const [confirmAction, setConfirmAction] = React.useState<'APPROVE' | 'ACTIVATE' | 'UNDO_APPROVE' | 'UNDO_ACTIVATE' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const activateIdempotencyKeyRef = React.useRef<string | null>(null);
  const restructureIdempotencyKeyRef = React.useRef<string | null>(null);
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
  // 2026-07-24 (Loan Restructure feature, user-confirmed): same MIS/Accounting-only gate as Adjust
  // Penalty/Adjust Fees. Term is staff-entered (product/interest rate are copied from this loan
  // automatically, not part of this form) - firstRepaymentDate pre-fills to one month from today
  // (the standard amortization convention) but is editable, per ADR-045's "explicit input, never
  // silently derived" stance.
  const [restructureOpen, setRestructureOpen] = React.useState(false);
  const [restructureInstallmentCount, setRestructureInstallmentCount] = React.useState('12');
  const [restructureFirstRepaymentDate, setRestructureFirstRepaymentDate] = React.useState('');
  const [restructureReason, setRestructureReason] = React.useState('');
  const adjustIdempotencyKeyRef = React.useRef<string | null>(null);
  // 2026-07-24 (Loan Adjustment feature, user-confirmed): same MIS/Accounting-only gate as
  // Restructure. Unlike Restructure, term is NOT staff-entered (copied verbatim from this loan) -
  // only the first repayment date changes.
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [adjustFirstRepaymentDate, setAdjustFirstRepaymentDate] = React.useState('');
  const [adjustReason, setAdjustReason] = React.useState('');
  // 2026-07-16 (Edit Loan Account, user request): "may kailangan baguhin katulad ng term or
  // amount, dapat pwede ko ito i-edit hangga't before ma-approve" — same ORIGINATION_ROLES gate
  // as "Create Loan Account"/"Approve Loan" (canCreateLoanAccount), only while PENDING_APPROVAL.
  const [editOpen, setEditOpen] = React.useState(false);
  // 2026-07-22 (optimistic concurrency, phase 1) - the `version` this form last saw, echoed back
  // as `expectedVersion` on save. `editOriginalLoan` is the full loan snapshot at that same
  // moment, kept separately from `editForm` (which the officer may go on editing) so a conflict
  // can diff "what the officer last saw" against "what's on the server now."
  const [editExpectedVersion, setEditExpectedVersion] = React.useState<number | null>(null);
  const [editOriginalLoan, setEditOriginalLoan] = React.useState<LoanAccount | null>(null);
  const [editConflict, setEditConflict] = React.useState<{ fresh: LoanAccount; fields: ConcurrencyConflictField[] } | null>(null);
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

  // Shared by `openEdit` and the conflict dialog's "Reload the latest version" action - both
  // populate the same form shape from a LoanAccount snapshot.
  const populateEditForm = (source: LoanAccount) => {
    const principalNum = Number.parseFloat(source.principalAmount) || 0;
    // Reverse-derives a display percent from the stored peso amount — the loan's own source of
    // truth is the peso fee, not a percent, so this is a "best starting point," same as every
    // other "default then editable" field elsewhere in this codebase.
    const feePercent = (fee: string) =>
      principalNum > 0 ? (((Number.parseFloat(fee) || 0) / principalNum) * 100).toFixed(3) : '0';
    setEditForm({
      principalAmount: source.principalAmount,
      addOnRate: source.addOnInterestRate ?? '',
      interestRate: source.interestRate,
      installmentCount: String(source.installmentCount),
      firstRepaymentDate: source.firstRepaymentDate.slice(0, 10),
      anticipatedDisbursementDate: source.anticipatedDisbursementDate ? source.anticipatedDisbursementDate.slice(0, 10) : '',
      processingFeePercent: feePercent(source.originationFees.processingFee),
      advanceInterestFee: source.originationFees.advanceInterestFee,
      outstandingBalancePayoff: source.originationFees.outstandingBalancePayoff,
      docStampFee: source.originationFees.docStampFee,
      accountManagementFeePercent: feePercent(source.originationFees.accountManagementFee),
      otherFees: source.originationFees.otherFees,
      notarialFee: source.originationFees.notarialFee,
      webFee: source.originationFees.webFee,
      insuranceFee: source.originationFees.insuranceFee,
    });
    setEditExpectedVersion(source.version);
    setEditOriginalLoan(source);
  };

  const openEdit = () => {
    if (!loan) return;
    populateEditForm(loan);
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

  // 2026-07-22: field labels/values compared between what this form last saw (`editOriginalLoan`)
  // and a freshly re-fetched copy, shown in the conflict dialog's "what changed" list. Only
  // fields that actually differ are included.
  const peso = (value: string) => formatPeso(Number.parseFloat(value) || 0);
  const buildConflictFields = (before: LoanAccount, after: LoanAccount): ConcurrencyConflictField[] => {
    const rows: [string, string, string][] = [
      ['Principal amount', peso(before.principalAmount), peso(after.principalAmount)],
      ['Add-on rate', before.addOnInterestRate ?? '-', after.addOnInterestRate ?? '-'],
      ['Interest rate', before.interestRate, after.interestRate],
      ['Installment count', String(before.installmentCount), String(after.installmentCount)],
      ['First repayment date', formatDate(before.firstRepaymentDate), formatDate(after.firstRepaymentDate)],
      [
        'Anticipated disbursement date',
        before.anticipatedDisbursementDate ? formatDate(before.anticipatedDisbursementDate) : '-',
        after.anticipatedDisbursementDate ? formatDate(after.anticipatedDisbursementDate) : '-',
      ],
      ['Processing fee', peso(before.originationFees.processingFee), peso(after.originationFees.processingFee)],
      ['Advance interest fee', peso(before.originationFees.advanceInterestFee), peso(after.originationFees.advanceInterestFee)],
      [
        'Outstanding balance payoff',
        peso(before.originationFees.outstandingBalancePayoff),
        peso(after.originationFees.outstandingBalancePayoff),
      ],
      ['Doc stamp fee', peso(before.originationFees.docStampFee), peso(after.originationFees.docStampFee)],
      ['Account management fee', peso(before.originationFees.accountManagementFee), peso(after.originationFees.accountManagementFee)],
      ['Other fees', peso(before.originationFees.otherFees), peso(after.originationFees.otherFees)],
      ['Notarial fee', peso(before.originationFees.notarialFee), peso(after.originationFees.notarialFee)],
      ['Web fee', peso(before.originationFees.webFee), peso(after.originationFees.webFee)],
      ['Insurance fee', peso(before.originationFees.insuranceFee), peso(after.originationFees.insuranceFee)],
    ];
    return rows.filter(([, b, a]) => b !== a).map(([label, before2, after2]) => ({ label, before: before2, after: after2 }));
  };

  const editMutation = useMutation({
    mutationFn: (vars: { expectedVersion: number }) =>
      apiClient.patch<LoanAccount>(`/loan-accounts/${loanId}`, {
        expectedVersion: vars.expectedVersion,
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
      setEditConflict(null);
      onActionSuccess();
    },
    onError: async (error: unknown) => {
      if (error instanceof ApiError && error.code === 'CONCURRENCY_CONFLICT' && editOriginalLoan) {
        const fresh = await apiClient.get<LoanAccount>(`/loan-accounts/${loanId}`);
        setEditConflict({ fresh, fields: buildConflictFields(editOriginalLoan, fresh) });
        return;
      }
      onActionError(error);
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/approve`, {}),
    onSuccess: onActionSuccess,
    onError: onActionError,
  });

  const activateMutation = useMutation({
    mutationFn: () => {
      if (!activateIdempotencyKeyRef.current) activateIdempotencyKeyRef.current = generateUuid();
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

  const restructureMutation = useMutation({
    mutationFn: () => {
      if (!restructureIdempotencyKeyRef.current) restructureIdempotencyKeyRef.current = generateUuid();
      return apiClient.post<{ oldLoanAccount: LoanAccount; newLoanAccount: LoanAccount }>(
        `/loan-accounts/${loanId}/restructure`,
        {
          installmentCount: Number.parseInt(restructureInstallmentCount, 10),
          firstRepaymentDate: restructureFirstRepaymentDate,
          reason: restructureReason.trim() || undefined,
        },
        { 'Idempotency-Key': restructureIdempotencyKeyRef.current },
      );
    },
    onSuccess: ({ newLoanAccount }) => {
      restructureIdempotencyKeyRef.current = null;
      setRestructureOpen(false);
      setRestructureReason('');
      void queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
      // The current loan is now CLOSED_RESTRUCTURED - jump straight to the new one it produced.
      navigate(`/loans/${newLoanAccount.id}`);
    },
    onError: onActionError,
  });

  const adjustMutation = useMutation({
    mutationFn: () => {
      if (!adjustIdempotencyKeyRef.current) adjustIdempotencyKeyRef.current = generateUuid();
      return apiClient.post<{ oldLoanAccount: LoanAccount; newLoanAccount: LoanAccount }>(
        `/loan-accounts/${loanId}/adjust`,
        {
          firstRepaymentDate: adjustFirstRepaymentDate,
          reason: adjustReason.trim() || undefined,
        },
        { 'Idempotency-Key': adjustIdempotencyKeyRef.current },
      );
    },
    onSuccess: ({ newLoanAccount }) => {
      adjustIdempotencyKeyRef.current = null;
      setAdjustOpen(false);
      setAdjustReason('');
      void queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
      // The current loan is now CLOSED_ADJUSTED - jump straight to the new one it produced.
      navigate(`/loans/${newLoanAccount.id}`);
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
  const openRestructureConfirm = () => {
    setActionError(null);
    setRestructureInstallmentCount('12');
    // Pre-fills to one month from today (the standard amortization first-due-date convention) -
    // editable, per ADR-045's "explicit input, never silently derived" stance.
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    setRestructureFirstRepaymentDate(oneMonthFromNow.toISOString().slice(0, 10));
    setRestructureReason('');
    setRestructureOpen(true);
  };
  const openAdjustConfirm = () => {
    setActionError(null);
    // Pre-fills to one month from today (the standard amortization first-due-date convention) -
    // editable, per ADR-045's "explicit input, never silently derived" stance.
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    setAdjustFirstRepaymentDate(oneMonthFromNow.toISOString().slice(0, 10));
    setAdjustReason('');
    setAdjustOpen(true);
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

  // 2026-07-28 (e-signature default number) - lets LoanSigningPanel default-fill the co-borrower's
  // signing box the same way it already does for the borrower's own box. Two DIFFERENT, non-
  // overlapping linkage mechanisms exist in the live data (see the matching fix/comment in
  // CreateLoanSigningSessionUseCase.ts): a per-LOAN join (`loan.coBorrowerIds`, what every
  // CP12-migrated co-borrower uses) and a per-BORROWER direct attachment (`GET
  // /borrowers/:id/co-borrowers`, what `CoBorrowersCard`'s "Add Co-Borrower" on Client Profile
  // actually creates - ADR-015). Try the loan-level join first (specific to this exact loan), fall
  // back to the client's directly-attached co-borrower if this loan has no join row.
  const coBorrowerId = loan?.coBorrowerIds[0];
  const coBorrowerByLoanQuery = useQuery({
    queryKey: ['co-borrower', coBorrowerId],
    queryFn: () => apiClient.get<CoBorrower>(`/co-borrowers/${coBorrowerId}`),
    enabled: Boolean(coBorrowerId),
  });
  const coBorrowerByBorrowerQuery = useQuery({
    queryKey: ['co-borrowers', loan?.borrowerId],
    queryFn: () => apiClient.get<{ items: CoBorrower[] }>(`/borrowers/${loan!.borrowerId}/co-borrowers`),
    enabled: Boolean(loan?.borrowerId) && !coBorrowerId,
  });
  const coBorrower = coBorrowerByLoanQuery.data ?? coBorrowerByBorrowerQuery.data?.items[0];

  const installmentsQuery = useQuery({
    queryKey: ['repayment-schedule', loanId],
    queryFn: () => apiClient.get<PaginatedResponse<RepaymentInstallment>>(`/loan-accounts/${loanId}/repayment-schedule`),
  });

  // 2026-07-24 (Loan Restructure feature): null unless this loan account was either side of a
  // restructure - gates the "Restructure" button (already-old-side -> disabled, "isang beses
  // lang") and drives the banner showing which loan it links to.
  const restructureQuery = useQuery({
    queryKey: ['loan-restructure', loanId],
    queryFn: () => apiClient.get<LoanRestructureView | null>(`/loan-accounts/${loanId}/restructure`),
  });

  // 2026-07-24 (Loan Adjustment feature): null unless this loan account was either side of an
  // adjustment - gates the "Loan Adjustment" button (already-old-side -> disabled, "isang beses
  // lang") and drives the banner showing which loan it links to.
  const adjustmentQuery = useQuery({
    queryKey: ['loan-adjustment', loanId],
    queryFn: () => apiClient.get<LoanAdjustmentView | null>(`/loan-accounts/${loanId}/adjust`),
  });

  // 2026-07-24 (user-confirmed): once a loan matures (last installment's due date passed) with an
  // unpaid balance, interest keeps accruing on the total past-due balance - penalty itself freezes
  // at maturity (see CurrentPenaltyResolver's maturityDate cap). null for a legacy loan.
  const accruedInterestQuery = useQuery({
    queryKey: ['accrued-interest', loanId],
    queryFn: () => apiClient.get<AccruedInterestFigures | null>(`/loan-accounts/${loanId}/accrued-interest`),
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
      apiClient.post(`/loan-accounts/${loanId}/documents`, { documentTemplateCode }, { 'Idempotency-Key': generateUuid() }),
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

  // ADR-052 (2026-07-19): Statement of Account generation — separate from ADR-051's Documents
  // above (different lifecycle: on-demand at any point, not once after approval; Collection
  // Fee/Other Fee are staff-entered per generation, not derived from any stored field).
  const statementsQuery = useQuery({
    queryKey: ['statements-of-account', loanId],
    queryFn: () => apiClient.get<{ items: GeneratedStatementOfAccountListItem[] }>(`/loan-accounts/${loanId}/statements-of-account`),
  });
  const [soaDialogOpen, setSoaDialogOpen] = React.useState(false);
  // Penalty uses a manually-entered FROM/TO date range applied uniformly across every Past Due
  // installment (2026-07-19, user request - NOT each installment's own due date). Accrued Interest
  // keeps its own separate "as of" date (matches the legacy tool's own independent "To Date" field
  // for that section).
  const [soaPenaltyFromDate, setSoaPenaltyFromDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [soaPenaltyToDate, setSoaPenaltyToDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [soaAccruedInterestAsOfDate, setSoaAccruedInterestAsOfDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [soaCollectionFee, setSoaCollectionFee] = React.useState('0.00');
  const [soaOtherFee, setSoaOtherFee] = React.useState('0.00');
  const [soaError, setSoaError] = React.useState<string | null>(null);

  // Client-side preview only (mirrors StatementOfAccountCalculator's formula) - lets staff check
  // the Penalty/Accrued Interest figures live as they adjust dates, before generating. The backend
  // is still the source of truth for the actual PDF/persisted record; this preview reuses the
  // already-loaded `installments` (same data as the Repayment Schedule table above).
  //
  // 2026-07-28 (ADR-052 addendum, user-confirmed): for a PROSPECTIVE (non-migrated) loan, Penalty
  // is no longer the flat/shared-date-range formula below - it mirrors `resolveComputedPenalty`
  // (ADR-050, daily-prorated, no grace period, due-month-day-count divisor, capped at the loan's
  // maturity date), the exact same figure shown on the live Repayment Schedule. A migrated loan
  // keeps the original flat formula unchanged (it has no live penalty on file to reuse).
  const isProspectiveLoan = !loan?.legacyId;
  const soaPreview = React.useMemo(() => {
    const parseNum = (v: string | null | undefined) => Number.parseFloat(v ?? '') || 0;
    const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
    const penaltyFrom = toDate(soaPenaltyFromDate);
    const penaltyTo = toDate(soaPenaltyToDate);
    const accruedTo = toDate(soaAccruedInterestAsOfDate);
    const daysBetween = (from: Date, to: Date) =>
      Math.max(0, Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000));
    const daysInMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const penaltyDays = isProspectiveLoan ? 0 : daysBetween(penaltyFrom, penaltyTo);

    const previewInstallments = installmentsQuery.data?.items ?? [];
    const sorted = [...previewInstallments].sort((a, b) => a.installmentNumber - b.installmentNumber);

    const lastInstallment = sorted[sorted.length - 1];
    const maturityDate = lastInstallment ? new Date(lastInstallment.dueDate) : null;
    const loanPrincipal = parseNum(loanQuery.data?.principalAmount);
    const loanRate = loanPrincipal > 10000 ? 0.1 : 0.05; // ADR-050 tiering: whole loan's principal, not per-installment.

    let pastDuePrincipal = 0;
    let pastDueInterest = 0;
    let pastDuePenalty = 0;
    for (const inst of sorted) {
      if (new Date(inst.dueDate).getTime() > penaltyTo.getTime()) continue;
      const unpaidPrincipal = parseNum(inst.due.principal) - parseNum(inst.paid.principal);
      const unpaidInterest = parseNum(inst.due.interest) - parseNum(inst.paid.interest);
      const unpaidBase = unpaidPrincipal + unpaidInterest;
      if (unpaidBase <= 0) continue;
      if (unpaidPrincipal > 0) pastDuePrincipal += unpaidPrincipal;
      if (unpaidInterest > 0) pastDueInterest += unpaidInterest;

      if (isProspectiveLoan) {
        const effectiveAsOf = maturityDate && penaltyTo.getTime() > maturityDate.getTime() ? maturityDate : penaltyTo;
        const daysLate = daysBetween(new Date(inst.dueDate), effectiveAsOf);
        if (daysLate > 0) {
          pastDuePenalty += Math.round(((unpaidBase * loanRate) / daysInMonth(new Date(inst.dueDate))) * daysLate * 100) / 100;
        }
      } else if (penaltyDays > 0) {
        const rate = unpaidBase > 10000 ? 0.1 : 0.05;
        pastDuePenalty += Math.round(((unpaidBase * penaltyDays * rate) / 30) * 100) / 100;
      }
    }
    const totalPastDue = pastDuePrincipal + pastDueInterest + pastDuePenalty;

    // Current Amortization Due = next unpaid installment due AFTER penaltyToDate.
    const currentInstallment = sorted.find((inst) => {
      const unpaidPrincipal = parseNum(inst.due.principal) - parseNum(inst.paid.principal);
      const unpaidInterest = parseNum(inst.due.interest) - parseNum(inst.paid.interest);
      return new Date(inst.dueDate).getTime() > penaltyTo.getTime() && unpaidPrincipal + unpaidInterest > 0;
    });
    const currentAmortizationDue = currentInstallment
      ? parseNum(currentInstallment.due.principal) -
        parseNum(currentInstallment.paid.principal) +
        (parseNum(currentInstallment.due.interest) - parseNum(currentInstallment.paid.interest))
      : 0;

    // PN Amount = Principal + Interest summed across the whole original schedule (not just unpaid).
    const pnValue = sorted.reduce((sum, inst) => sum + parseNum(inst.due.principal) + parseNum(inst.due.interest), 0);

    // Account must actually be matured (real "today" past the Maturity Date), not just the picked
    // date — Accrued Interest is only applicable once the loan itself has matured.
    const isMatured = maturityDate ? maturityDate.getTime() <= Date.now() : false;

    const contractualRate = parseNum(loanQuery.data?.contractualInterestRate);
    let accruedInterest = 0;
    if (isMatured && lastInstallment && contractualRate > 0 && totalPastDue > 0) {
      const accruedDays = daysBetween(new Date(lastInstallment.dueDate), accruedTo);
      if (accruedDays > 0) {
        accruedInterest = Math.round(((totalPastDue * (contractualRate / 100)) / 30) * accruedDays * 100) / 100;
      }
    }

    const totalAmountDue =
      currentAmortizationDue + totalPastDue + accruedInterest + (Number.parseFloat(soaCollectionFee) || 0) + (Number.parseFloat(soaOtherFee) || 0);

    return {
      pastDuePrincipal,
      pastDueInterest,
      pastDuePenalty,
      penaltyDays,
      totalPastDue,
      currentAmortizationDue,
      pnValue,
      maturityDate,
      isMatured,
      accruedInterest,
      totalAmountDue,
    };
  }, [installmentsQuery.data, loanQuery.data, isProspectiveLoan, soaPenaltyFromDate, soaPenaltyToDate, soaAccruedInterestAsOfDate, soaCollectionFee, soaOtherFee]);

  const generateStatementMutation = useMutation({
    mutationFn: () =>
      apiClient.post(
        `/loan-accounts/${loanId}/statements-of-account`,
        {
          // Only a migrated loan needs a manual From date - a prospective loan's Penalty is
          // live-computed and ignores it entirely (ADR-052 addendum, 2026-07-28).
          ...(isProspectiveLoan ? {} : { penaltyFromDate: soaPenaltyFromDate }),
          penaltyToDate: soaPenaltyToDate,
          accruedInterestAsOfDate: soaAccruedInterestAsOfDate,
          collectionFee: soaCollectionFee,
          otherFee: soaOtherFee,
        },
        { 'Idempotency-Key': generateUuid() },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['statements-of-account', loanId] });
      setSoaDialogOpen(false);
      setSoaCollectionFee('0.00');
      setSoaOtherFee('0.00');
    },
    onError: (error) => {
      setSoaError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  const downloadStatement = async (generatedStatementId: string, fallbackFileName: string) => {
    try {
      await downloadFile(`/loan-accounts/${loanId}/statements-of-account/${generatedStatementId}/download`, fallbackFileName);
    } catch {
      setSoaError('Could not download the file. Please try again.');
    }
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
  // 2026-07-24 (Loan Restructure feature, user request, follow-up 2026-07-24): same client-side
  // preview convention as Create Loan Account/the block above - rate is copied from this loan,
  // only term/date come from the dialog's inputs. Principal is `restructureNewPrincipal` from the
  // accrued-interest query (unpaid principal + interest across the WHOLE schedule + unpaid
  // penalty + accrued interest + unpaid fees) - the exact figure the backend will actually charge,
  // not the old collectionsBalance-only figure. Falls back to collectionsBalance only while that
  // query is still loading, so the preview isn't briefly blank.
  const restructureInstallmentCountNum = Number.parseInt(restructureInstallmentCount, 10);
  const restructureNewPrincipalNum = accruedInterestQuery.data
    ? num(accruedInterestQuery.data.restructureNewPrincipal)
    : num(loan.collectionsBalance);
  const restructurePreview =
    restructureOpen && restructureFirstRepaymentDate
      ? previewLoanSchedule(restructureNewPrincipalNum, num(loan.interestRate), restructureInstallmentCountNum, new Date(restructureFirstRepaymentDate))
      : null;
  // 2026-07-24 (Loan Adjustment feature): same client-side preview convention as Restructure -
  // principal, rate, and term are all copied verbatim from this loan, only the date changes.
  const adjustPreview =
    adjustOpen && adjustFirstRepaymentDate
      ? previewLoanSchedule(num(loan.principalAmount), num(loan.interestRate), loan.installmentCount, new Date(adjustFirstRepaymentDate))
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
  // 2026-07-24 (Loan Restructure feature, user-confirmed): "Ino offer lang ito sa mga past due at
  // matured account" - any installment currently `LATE` (RepaymentInstallment.status's own live
  // "dueDate passed, still unpaid" definition) covers both. "isang beses lang pwede gawin per loan
  // account" - once this loan is the OLD side of a restructure, never offered again.
  const isPastDueOrMatured = (installmentsQuery.data?.items ?? []).some((i) => i.status === 'LATE');
  const alreadyRestructured = restructureQuery.data?.oldLoanAccountId === loan.id;
  const canRestructure = canManageInstallments && canRecordPayment && isPastDueOrMatured && !alreadyRestructured;
  // 2026-07-24 (Loan Adjustment feature, user-confirmed): "ina apply sa mga wala pang bayad na
  // account... kailangan before ng 1st due date lang pwede i Loan Adjust ang account" - ACTIVE
  // only, zero payments recorded on any installment, and still before the first installment's own
  // due date. "isang beses lang" - once this loan is the OLD side of an adjustment, never offered
  // again.
  const adjustInstallments = installmentsQuery.data?.items ?? [];
  const hasAnyPayment = adjustInstallments.some((i) => num(i.paid.total) > 0);
  const firstInstallmentDueDate = adjustInstallments.reduce<Date | null>(
    (earliest, i) => (earliest === null || new Date(i.dueDate) < earliest ? new Date(i.dueDate) : earliest),
    null,
  );
  const isBeforeFirstDueDate = firstInstallmentDueDate === null || new Date() < firstInstallmentDueDate;
  const alreadyAdjusted = adjustmentQuery.data?.oldLoanAccountId === loan.id;
  const canAdjust = canManageInstallments && loan.status === 'ACTIVE' && !hasAnyPayment && isBeforeFirstDueDate && !alreadyAdjusted;
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
          {/* 2026-07-24 (UI polish, user-confirmed): at most one solid/primary button per view -
              whichever action is THE next expected step for this status (Record Payment while
              ACTIVE, Disburse Loan while APPROVED, Approve Loan while PENDING_APPROVAL). Every
              other action (Undo Approve/Undo Disburse/Restructure/Loan Adjustment/Edit) is a
              secondary, less-frequent action and lives in the "More actions" menu below instead
              of competing for the same visual weight. */}
          {canRecordPayment && (
            <Button size="sm" onClick={() => setRecordPaymentOpen(true)}>
              Record Payment
            </Button>
          )}
          {canActivateLoanAccount && loan.status === 'APPROVED' && (
            <Button size="sm" onClick={() => openConfirm('ACTIVATE')}>
              Disburse Loan
            </Button>
          )}
          {canApproveLoanAccount && loan.status === 'PENDING_APPROVAL' && (
            <Button size="sm" onClick={() => openConfirm('APPROVE')}>
              Approve Loan
            </Button>
          )}
          {(() => {
            // 2026-07-16/24 (Undo Approve / Undo Activate, user request): MIS-only, matching the
            // backend's requireRole('MIS') gate — a narrower tier than canCreateLoanAccount
            // (ORIGINATION_ROLES), same reasoning as Reverse Payment below.
            const canUndoApprove = currentAccount.roles.includes('MIS') && loan.status === 'APPROVED';
            const canUndoActivate = currentAccount.roles.includes('MIS') && loan.status === 'ACTIVE';
            const canEdit = canCreateLoanAccount && loan.status === 'PENDING_APPROVAL';
            const hasAnySecondaryAction = canUndoApprove || canUndoActivate || canRestructure || canAdjust || canEdit;
            if (!hasAnySecondaryAction) return null;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    More actions <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && <DropdownMenuItem onSelect={openEdit}>Edit</DropdownMenuItem>}
                  {canUndoApprove && <DropdownMenuItem onSelect={() => openConfirm('UNDO_APPROVE')}>Undo Approve</DropdownMenuItem>}
                  {canUndoActivate && (
                    <DropdownMenuItem
                      disabled={hasRepayment}
                      onSelect={() => openConfirm('UNDO_ACTIVATE')}
                      title={hasRepayment ? 'Cannot undo - a payment has already been recorded against this loan.' : undefined}
                    >
                      Undo Disburse
                    </DropdownMenuItem>
                  )}
                  {canRestructure && <DropdownMenuItem onSelect={openRestructureConfirm}>Restructure</DropdownMenuItem>}
                  {canAdjust && <DropdownMenuItem onSelect={openAdjustConfirm}>Loan Adjustment</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
        </div>
      </div>

      {actionError && !confirmAction && !reverseTarget && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ADR-007 §4 (2026-07-08 decision, backfilled 2026-07-23) - one of the 79 legacy CLOSED
          loans whose migrated balance doesn't sum to zero despite being marked fully settled.
          Migrated as-is per that decision (no figure here was corrected or invented); this banner
          is the actual "flag for manual accounting review" the decision called for, since nothing
          surfaced it in the UI until now. */}
      {loan.legacyNonReconcilingClosedBalance && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Legacy migration flag (ADR-007 §4): this loan is marked Closed, but its migrated balance does not sum to ₱0.00. Migrated
            as-is from the legacy system without correction - needs manual accounting review before being treated as fully settled.
          </span>
        </div>
      )}

      {/* 2026-07-24 (Loan Restructure feature): this loan participated in a restructure, on
          either side - link to whichever loan it isn't. */}
      {restructureQuery.data && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs text-primary">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {restructureQuery.data.oldLoanAccountId === loan.id ? (
            <span>
              This loan was restructured into{' '}
              <Link to={`/loans/${restructureQuery.data.newLoanAccountId}`} className="underline underline-offset-2">
                {restructureQuery.data.newLoanCode}
              </Link>
              {' '}on {formatDate(restructureQuery.data.createdAt)}.
            </span>
          ) : (
            <span>
              This loan was created by restructuring{' '}
              <Link to={`/loans/${restructureQuery.data.oldLoanAccountId}`} className="underline underline-offset-2">
                {restructureQuery.data.oldLoanCode}
              </Link>
              {' '}on {formatDate(restructureQuery.data.createdAt)} ({formatPeso(num(restructureQuery.data.previousCollectionsBalance))} prior balance).
            </span>
          )}
        </div>
      )}

      {/* 2026-07-24 (Loan Adjustment feature): this loan participated in an adjustment, on either
          side - link to whichever loan it isn't. */}
      {adjustmentQuery.data && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs text-primary">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {adjustmentQuery.data.oldLoanAccountId === loan.id ? (
            <span>
              This loan was adjusted into{' '}
              <Link to={`/loans/${adjustmentQuery.data.newLoanAccountId}`} className="underline underline-offset-2">
                {adjustmentQuery.data.newLoanCode}
              </Link>
              {' '}on {formatDate(adjustmentQuery.data.createdAt)}.
            </span>
          ) : (
            <span>
              This loan was created by adjusting{' '}
              <Link to={`/loans/${adjustmentQuery.data.oldLoanAccountId}`} className="underline underline-offset-2">
                {adjustmentQuery.data.oldLoanCode}
              </Link>
              {' '}on {formatDate(adjustmentQuery.data.createdAt)} (was {formatDate(adjustmentQuery.data.previousFirstRepaymentDate)}).
            </span>
          )}
        </div>
      )}

      {/* 2026-07-24 (user-confirmed): once matured with an unpaid balance, interest keeps
          accruing on the total past-due balance - a separate figure from Penalty Due, which
          freezes at maturity (CurrentPenaltyResolver's maturityDate cap). Hidden entirely for a
          current loan (daysLate === 0) or a legacy loan (accruedInterestQuery.data === null). */}
      {accruedInterestQuery.data && accruedInterestQuery.data.daysLate > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Accrued interest</CardTitle>
              <Badge variant="warning">Past maturity</Badge>
            </div>
            <CardDescription>
              This loan matured on {formatDate(accruedInterestQuery.data.maturityDate)} (installment #{accruedInterestQuery.data.breakdown.at(-1)?.installmentNumber ?? '?'}
              's due date). Penalty froze on that date - what continues to accrue since then is interest on the total past-due balance, not
              penalty.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{formatPeso(num(accruedInterestQuery.data.accruedInterest))}</span>
              <span className="text-xs text-muted-foreground">as of today</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Total past due ({formatPeso(num(accruedInterestQuery.data.totalPastDue))}) × contractual rate (
              {formatPercentage(accruedInterestQuery.data.contractualRate)}) ÷ 30 × days late ({accruedInterestQuery.data.daysLate}) ={' '}
              {formatPeso(num(accruedInterestQuery.data.accruedInterest))}
            </p>
          </CardContent>
        </Card>
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
                                    <DropdownMenuItem disabled={!canReduceThisRow} onSelect={() => openReduceConfirm(i, penaltyDisplay)}>
                                      Adjust penalty
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

      {(() => {
        // 2026-07-22: everything from here to Recent Activity is drag-to-reorder (see cardOrder
        // state above) - each section's JSX lives as one entry in this map so it can be rendered
        // in whatever order the current user saved, instead of a fixed sequence.
        const cardsById: Record<string, React.ReactNode> = {
          reminders: (
            <RealRemindersPanel loanAccountId={loan.id} loanCode={loan.loanCode} borrower={borrower} installments={installments} />
          ),
          notes: <ProfileNotesPanel ownerType="LOAN_ACCOUNT" ownerId={loan.id} />,
          attachments: (
            <RealAttachmentsPanel
              ownerType="LOAN_ACCOUNT"
              ownerId={loan.id}
              canUpload
              // 2026-07-23 (user request, same as ClientProfilePage): also surface documents
              // uploaded during this loan's own originating application - `sourceApplicationId`
              // is a direct 1:1 link (unlike a Borrower, which can have many applications over
              // time), so there's no "which one" ambiguity here.
              secondaryOwner={loan.sourceApplicationId ? { ownerType: 'LOAN_APPLICATION', ownerId: loan.sourceApplicationId } : undefined}
            />
          ),
          // ADR-051 (2026-07-12): loan document generation — Disclosure Statement, Promissory
          // Note, and other legal documents applicable to this loan's product, available once
          // APPROVED.
          documents: (
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
                                  downloadPath: `/loan-accounts/${loanId}/documents/${doc.latestGeneration!.id}/download`,
                                  title: doc.documentTemplateName,
                                  fileName: buildDocumentFileName(loan.loanCode, doc.documentTemplateName),
                                })
                              }
                            >
                              Preview
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                downloadDocument(doc.latestGeneration!.id, buildDocumentFileName(loan.loanCode, doc.documentTemplateName))
                              }
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
          ),
          esignature: (
            <LoanSigningPanel
              loanId={loan.id}
              loanCode={loan.loanCode}
              defaultPhoneNumber={borrower?.mobilePhone1 ?? undefined}
              defaultCoBorrowerPhoneNumber={coBorrower?.phoneNumber ?? undefined}
              borrowerName={borrower?.fullName}
              coBorrowerName={coBorrower?.fullName}
              borrowerEmail={borrower?.email ?? undefined}
              coBorrowerEmail={coBorrower?.emailAddress ?? undefined}
              canSend={canGenerateDocuments}
            />
          ),
          // ADR-052 (2026-07-19): Statement of Account — a separate, on-demand collection
          // document, distinct from the required/conditional Documents above (ADR-051 §1).
          soa: (
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Statement of Account</CardTitle>
            <CardDescription>Generate a Statement of Account PDF for this loan, as of a chosen date.</CardDescription>
          </div>
          {canGenerateDocuments && (
            <Button size="sm" onClick={() => setSoaDialogOpen(true)}>
              <Receipt className="mr-2 h-4 w-4" /> Create SOA
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!canGenerateDocuments ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Available once this loan is approved.</p>
          ) : statementsQuery.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {soaError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{soaError}</span>
                </div>
              )}
              <ul className="space-y-2">
                {(statementsQuery.data?.items ?? []).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{item.soaNumber} · {formatPeso(num(item.totalAmountDue))}</p>
                      <p className="text-xs text-muted-foreground">
                        Penalty {formatDate(item.penaltyFromDate)} – {formatDate(item.penaltyToDate)} · Accrued Interest as of {formatDate(item.accruedInterestAsOfDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Generated by {item.generatedByName} · {formatDate(item.generatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPreviewTarget({
                            downloadPath: `/loan-accounts/${loanId}/statements-of-account/${item.id}/download`,
                            title: item.soaNumber,
                            fileName: buildDocumentFileName(loan.loanCode, 'Statement_of_Account', item.soaNumber),
                          })
                        }
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          downloadStatement(item.id, buildDocumentFileName(loan.loanCode, 'Statement_of_Account', item.soaNumber))
                        }
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
                  </li>
                ))}
                {(statementsQuery.data?.items ?? []).length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No Statement of Account generated yet for this loan.</p>
                )}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
          ),
        };

        // The Create-SOA dialog is a portal (renders detached from this DOM position when open),
        // so it doesn't need to live inside the reorderable cardsById map above - it's tied to the
        // "soa" card's own state/button regardless of where "soa" lands in the current order.
        const soaDialog = (
      <Dialog open={soaDialogOpen} onOpenChange={(open) => { setSoaDialogOpen(open); if (!open) setSoaError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Statement of Account</DialogTitle>
            <DialogDescription>Account details are filled in automatically. Review the figures below before generating.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-secondary/40 p-3">
              <p className="mb-2 text-sm font-medium">Account information</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <p className="text-muted-foreground">Loan ID</p>
                  <p className="font-medium">{loan.loanCode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Loan date</p>
                  <p className="font-medium">{loan.anticipatedDisbursementDate ? formatDate(loan.anticipatedDisbursementDate) : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Term</p>
                  <p className="font-medium">{loan.installmentCount} months</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Maturity date</p>
                  <p className="font-medium">{soaPreview.maturityDate ? formatDate(soaPreview.maturityDate) : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">PN amount</p>
                  <p className="font-medium">{formatPeso(soaPreview.pnValue)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-secondary/40 p-3">
              <p className="mb-2 text-sm font-medium">Balances</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <p className="text-muted-foreground">Current amortization</p>
                  <p className="font-medium">{formatPeso(soaPreview.currentAmortizationDue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Principal past due</p>
                  <p className="font-medium">{formatPeso(soaPreview.pastDuePrincipal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Interest past due</p>
                  <p className="font-medium">{formatPeso(soaPreview.pastDueInterest)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total past due</p>
                  <p className="font-medium">{formatPeso(soaPreview.totalPastDue)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-md bg-secondary/40 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-medium">Penalty</p>
                {isProspectiveLoan && <Badge variant="success">Live computed</Badge>}
              </div>
              {isProspectiveLoan ? (
                <>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Same figure shown on this loan's Repayment Schedule - computed as of the date below.
                  </p>
                  <Label htmlFor="soa-penalty-to-date">As of date</Label>
                  <Input
                    id="soa-penalty-to-date"
                    type="date"
                    value={soaPenaltyToDate}
                    onChange={(e) => setSoaPenaltyToDate(e.target.value)}
                  />
                  <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs">
                    <p className="text-muted-foreground">Past due penalty</p>
                    <p className="font-medium">{formatPeso(soaPreview.pastDuePenalty)}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="soa-penalty-from-date">From date</Label>
                      <Input
                        id="soa-penalty-from-date"
                        type="date"
                        value={soaPenaltyFromDate}
                        onChange={(e) => setSoaPenaltyFromDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="soa-penalty-to-date">To date</Label>
                      <Input
                        id="soa-penalty-to-date"
                        type="date"
                        value={soaPenaltyToDate}
                        onChange={(e) => setSoaPenaltyToDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Days</p>
                      <p className="font-medium">{soaPreview.penaltyDays}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Penalty amount</p>
                      <p className="font-medium">{formatPeso(soaPreview.pastDuePenalty)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Migrated loan - rate is 5%/month per installment with an unpaid balance ≤ ₱10,000, otherwise 10%/month.
                  </p>
                </>
              )}
            </div>
            <div className={cn('rounded-md bg-secondary/40 p-3', !soaPreview.isMatured && 'opacity-60')}>
              <p className="mb-2 text-sm font-medium">Accrued interest</p>
              <Label htmlFor="soa-accrued-as-of-date">As of date</Label>
              <Input
                id="soa-accrued-as-of-date"
                type="date"
                value={soaAccruedInterestAsOfDate}
                onChange={(e) => setSoaAccruedInterestAsOfDate(e.target.value)}
                disabled={!soaPreview.isMatured}
              />
              {soaPreview.isMatured ? (
                <div className="mt-2 border-t pt-2 text-xs">
                  <p className="text-muted-foreground">Accrued interest amount</p>
                  <p className="font-medium">{formatPeso(soaPreview.accruedInterest)}</p>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Not applicable until maturity{soaPreview.maturityDate ? ` (${formatDate(soaPreview.maturityDate)})` : ''}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="soa-collection-fee">Collection Fee</Label>
                <Input
                  id="soa-collection-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={soaCollectionFee}
                  onChange={(e) => setSoaCollectionFee(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="soa-other-fee">Other Fee</Label>
                <Input
                  id="soa-other-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={soaOtherFee}
                  onChange={(e) => setSoaOtherFee(e.target.value)}
                />
              </div>
            </div>
            {isProspectiveLoan && (
              <div className="flex items-start gap-2 rounded-md border bg-secondary/40 p-2.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Migrated loans have no live penalty on file - a manual From/To date range appears instead for those accounts.</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-md bg-primary/10 p-3">
              <p className="text-sm font-medium text-primary">Total amount due</p>
              <p className="text-lg font-medium text-primary">{formatPeso(soaPreview.totalAmountDue)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoaDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => generateStatementMutation.mutate()} disabled={generateStatementMutation.isPending}>
              {generateStatementMutation.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        );

        cardsById.activityTimeline = (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Log of all actions taken on this loan account by loan officers</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileActivityTimeline profileType="LOAN_ACCOUNT" profileId={loan.id} showDetailsToggle={false} />
        </CardContent>
      </Card>
        );
        cardsById.recentActivity = <RecentActivityPanel label="Loan Account" entityId={loan.id} />;

        return (
          <>
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
              <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
                {cardOrder.map((id) => (
                  <SortableSection key={id} id={id}>
                    {cardsById[id]}
                  </SortableSection>
                ))}
              </SortableContext>
            </DndContext>
            {soaDialog}
          </>
        );
      })()}

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
            <Button
              onClick={() => editExpectedVersion !== null && editMutation.mutate({ expectedVersion: editExpectedVersion })}
              disabled={editMutation.isPending || editExpectedVersion === null}
            >
              {editMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editConflict && (
        <ConcurrencyConflictDialog
          open={Boolean(editConflict)}
          onOpenChange={(open) => !open && setEditConflict(null)}
          changedFields={editConflict.fields}
          overwritePending={editMutation.isPending}
          onReload={() => {
            populateEditForm(editConflict.fresh);
            setEditConflict(null);
          }}
          onOverwrite={() => editMutation.mutate({ expectedVersion: editConflict.fresh.version })}
        />
      )}

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
          {confirmAction === 'ACTIVATE' && (
            <div className="space-y-1.5 rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Principal amount</span>
                <span>{formatPeso(Number(loan.principalAmount))}</span>
              </div>
              {DISBURSEMENT_FEE_FIELDS.filter(({ key }) => Number(loan.originationFees[key]) > 0).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between text-muted-foreground">
                  <span>Less: {label}</span>
                  <span>-{formatPeso(Number(loan.originationFees[key]))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-1.5 font-medium">
                <span>Net proceeds (amount to disburse)</span>
                <span>{formatPeso(Number(loan.netProceeds))}</span>
              </div>
            </div>
          )}
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
            <DialogTitle>Adjust penalty</DialogTitle>
            <DialogDescription>
              {reduceTarget &&
                `Installment #${reduceTarget.installmentNumber} · ${formatDate(reduceTarget.dueDate)}. Raise or lower this installment's penalty - freezes it at the amount entered, so it stops recalculating day over day until paid or adjusted again. Can't go above what the penalty formula would produce today. Approved outside this system; the reason below records that reference.`}
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
              placeholder="e.g. Approved by Branch Manager, memo #2026-0714"
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
              {reduceMutation.isPending ? 'Adjusting…' : 'Adjust penalty'}
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
              placeholder="e.g. Approved by Branch Manager, memo #2026-0714"
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

      <Dialog open={restructureOpen} onOpenChange={(open) => !open && !restructureMutation.isPending && setRestructureOpen(false)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Restructure loan</DialogTitle>
            <DialogDescription>
              Creates a brand new loan account with unpaid principal + unpaid interest (whole remaining schedule) + unpaid penalty +
              accrued interest + unpaid fees as its principal, using the same product and interest rate. This loan closes as
              Restructured. Can only be done once per loan account.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">New principal</p>
              <p className="font-semibold">{formatPeso(restructureNewPrincipalNum)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest rate</p>
              <p className="font-semibold">{formatPercentage(loan.interestRate)} / month</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Product</p>
              <p className="font-semibold">Same as {loan.loanCode}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="restructure-installment-count">New term (installments)</Label>
              <Input
                id="restructure-installment-count"
                type="number"
                min="1"
                step="1"
                value={restructureInstallmentCount}
                onChange={(e) => setRestructureInstallmentCount(e.target.value)}
                disabled={restructureMutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restructure-first-repayment-date">First repayment date</Label>
              <Input
                id="restructure-first-repayment-date"
                type="date"
                value={restructureFirstRepaymentDate}
                onChange={(e) => setRestructureFirstRepaymentDate(e.target.value)}
                disabled={restructureMutation.isPending}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="restructure-reason">Reason (optional)</Label>
            <Textarea
              id="restructure-reason"
              placeholder="e.g. Client requested a lower monthly amount"
              value={restructureReason}
              onChange={(e) => setRestructureReason(e.target.value)}
              disabled={restructureMutation.isPending}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Schedule preview</p>
            {!restructurePreview ? (
              <p className="rounded-md border py-6 text-center text-sm text-muted-foreground">Enter a valid term and date to preview the schedule.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Preview only - final schedule is generated by the server on submit. Monthly payment:{' '}
                  <span className="font-semibold text-foreground">{formatPeso(restructurePreview.monthlyPayment)}</span>
                </p>
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
                    {restructurePreview.schedule.map((entry) => (
                      <TableRow key={entry.installmentNumber}>
                        <TableCell>{entry.installmentNumber}</TableCell>
                        <TableCell>{formatDate(entry.dueDate)}</TableCell>
                        <TableCell className="text-right">{formatPeso(entry.principalPortion)}</TableCell>
                        <TableCell className="text-right">{formatPeso(entry.interestPortion)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatPeso(entry.payment)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatPeso(entry.endingPrincipal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>

          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestructureOpen(false)} disabled={restructureMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => restructureMutation.mutate()}
              disabled={
                restructureMutation.isPending ||
                !restructureInstallmentCount.trim() ||
                Number.parseInt(restructureInstallmentCount, 10) <= 0 ||
                !restructureFirstRepaymentDate
              }
            >
              {restructureMutation.isPending ? 'Restructuring…' : 'Restructure loan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={(open) => !open && !adjustMutation.isPending && setAdjustOpen(false)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Adjustment</DialogTitle>
            <DialogDescription>
              Creates a brand new loan account with the same principal, interest rate, term, and product as this loan - only the
              first repayment date changes. This loan closes as Adjusted. Only allowed before this loan's first installment is due,
              and only while no payments have been made. Can only be done once per loan account.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Principal</p>
              <p className="font-semibold">{formatPeso(num(loan.principalAmount))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest rate</p>
              <p className="font-semibold">{formatPercentage(loan.interestRate)} / month</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Term</p>
              <p className="font-semibold">{loan.installmentCount} installments</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Current first repayment date</Label>
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{formatDate(loan.firstRepaymentDate)}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-first-repayment-date">New first repayment date</Label>
              <Input
                id="adjust-first-repayment-date"
                type="date"
                value={adjustFirstRepaymentDate}
                onChange={(e) => setAdjustFirstRepaymentDate(e.target.value)}
                disabled={adjustMutation.isPending}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-reason">Reason (optional)</Label>
            <Textarea
              id="adjust-reason"
              placeholder="e.g. Wrong due date encoded at origination"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              disabled={adjustMutation.isPending}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Schedule preview</p>
            {!adjustPreview ? (
              <p className="rounded-md border py-6 text-center text-sm text-muted-foreground">Enter a valid date to preview the schedule.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Preview only - final schedule is generated by the server on submit. Monthly payment:{' '}
                  <span className="font-semibold text-foreground">{formatPeso(adjustPreview.monthlyPayment)}</span>
                </p>
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
                    {adjustPreview.schedule.map((entry) => (
                      <TableRow key={entry.installmentNumber}>
                        <TableCell>{entry.installmentNumber}</TableCell>
                        <TableCell>{formatDate(entry.dueDate)}</TableCell>
                        <TableCell className="text-right">{formatPeso(entry.principalPortion)}</TableCell>
                        <TableCell className="text-right">{formatPeso(entry.interestPortion)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatPeso(entry.payment)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatPeso(entry.endingPrincipal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>

          {actionError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjustMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => adjustMutation.mutate()} disabled={adjustMutation.isPending || !adjustFirstRepaymentDate}>
              {adjustMutation.isPending ? 'Adjusting…' : 'Adjust loan'}
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
