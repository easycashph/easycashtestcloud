import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Bell, Clock, Mail, MessageSquareText, Sparkles } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { Borrower as RealBorrower, LoanAccount, LoanTransaction, PaginatedResponse, RepaymentInstallment } from '@/lib/loanApiTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoanStatusBadge, InstallmentStatusBadge } from '@/components/StatusBadge';
import { AttachmentsPanel as RealAttachmentsPanel } from '@/components/AttachmentsPanel';
import { NotesPanel as RealNotesPanel } from '@/components/NotesPanel';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ProfileActivityTimeline } from '@/components/ProfileActivityTimeline';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import type { LoanRiskAssessment, RiskLevel } from '@/lib/riskAssessmentApiTypes';
import { cn, formatDate, formatPeso } from '@/lib/utils';

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
 * + Notes + Reminders added 2026-07-12. `getMockLoan()` only ever knows about hand-authored mock
 * loans - a loan from `LoanListPage`'s now-real list (a UUID, migrated from legacy data) doesn't
 * exist there and would otherwise hit this page's "not found" state. Real: balances, borrower,
 * repayment schedule, risk assessment, payment history, Approve/Activate actions (`POST
 * /loan-accounts/:id/approve` and `/activate`, same role tier as loan origination per ADR-038
 * §3.1/§3.6), Attachments (`AttachmentsPanel`, `ownerType="LOAN_ACCOUNT"`), Notes (`NotesPanel`),
 * and Reminders (`RealRemindersPanel` - real trigger schedule computed from the real repayment
 * schedule, business-confirmed 2026-07-12; SMS/Email sending itself stays "Coming Soon", no
 * provider connected yet). Every tab on this page is now real - see
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

function buildRealReminderMessage(params: {
  borrowerName: string;
  loanCode: string;
  installmentNumber: number;
  installmentsTotalCount: number;
  installmentsPaidCount: number;
  amountDue: number;
  dueDate: string;
  penaltyDue: number;
}): string {
  const lines = [
    `Hi ${params.borrowerName},`,
    '',
    `This is a reminder from Easycash Lending Company Inc. regarding your loan account ${params.loanCode}.`,
    '',
    `Installment #${params.installmentNumber} of ${params.installmentsTotalCount}: ${formatPeso(params.amountDue)} due ${formatDate(params.dueDate)}.`,
    `Payment progress: ${params.installmentsPaidCount} of ${params.installmentsTotalCount} installments paid so far.`,
  ];
  if (params.penaltyDue > 0) {
    lines.push(`Penalty fee for late payment: ${formatPeso(params.penaltyDue)}.`);
  }
  lines.push('', 'Please settle at your earliest convenience to avoid additional penalties. Thank you!', '- Easycash Lending Company Inc.');
  return lines.join('\n');
}

/**
 * Real reminder trigger schedule (confirmed business policy, see `computeReminderTriggers`) for
 * this loan's next unpaid installment, computed from the already-fetched real repayment schedule
 * - no extra query needed. Deliberately does NOT claim any trigger was "Sent": no SMS/email
 * provider is connected yet (pending MIS/Nomer, per 2026-07-12 conversation), so every trigger is
 * shown as "Due" (its date has arrived) or "Upcoming", never as a notification that actually went
 * out. `PaymentRemindersPage.tsx`'s real worklist uses the same honest framing.
 */
function RealRemindersPanel({
  loanCode,
  borrower,
  installments,
}: {
  loanCode: string;
  borrower: RealBorrower | undefined;
  installments: RepaymentInstallment[];
}) {
  const [expandedType, setExpandedType] = React.useState<ReminderTriggerType | null>(null);
  const now = new Date();
  const unpaid = installments.filter((i) => i.status !== 'PAID');
  const nextDue = unpaid.find((i) => new Date(i.dueDate) >= now) ?? unpaid[unpaid.length - 1];

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
  const installmentsPaidCount = installments.filter((i) => i.status === 'PAID').length;
  const triggers = computeReminderTriggers(new Date(nextDue.dueDate), nextDue.status === 'LATE');
  const borrowerName = borrower ? `${borrower.firstName} ${borrower.lastName}` : 'the borrower';
  const message = buildRealReminderMessage({
    borrowerName,
    loanCode,
    installmentNumber: nextDue.installmentNumber,
    installmentsTotalCount: installments.length,
    installmentsPaidCount,
    amountDue,
    dueDate: nextDue.dueDate,
    penaltyDue: nextDue.status === 'LATE' ? num(nextDue.due.penalty) : 0,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-muted-foreground" /> Reminders
        </CardTitle>
        <CardDescription>
          Trigger schedule for installment #{nextDue.installmentNumber} - no SMS/Email provider is connected yet, so nothing below has
          actually been sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {triggers.map((trigger) => {
          const due = trigger.date <= now;
          return (
            <div key={trigger.type} className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center justify-between p-3 text-left"
                onClick={() => setExpandedType((cur) => (cur === trigger.type ? null : trigger.type))}
              >
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{REMINDER_TRIGGER_LABELS[trigger.type]}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(trigger.date.toISOString())}</span>
                </div>
                <Badge variant={due ? 'warning' : 'outline'}>
                  <span className="flex items-center gap-1">
                    {due ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {due ? 'Due' : 'Upcoming'}
                  </span>
                </Badge>
              </button>
              {expandedType === trigger.type && (
                <div className="space-y-3 border-t p-3">
                  <pre className="whitespace-pre-wrap rounded-md border bg-secondary/40 p-3 text-sm">{message}</pre>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4" /> SMS ({borrower?.mobilePhone1 ?? 'no number on file'})
                      </span>
                      <Badge variant="secondary">Coming Soon</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Mail className="h-4 w-4" /> Email ({borrower?.email ?? 'no email on file'})
                      </span>
                      <Badge variant="secondary">Coming Soon</Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RealLoanDetailView({ loanId }: { loanId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreateLoanAccount } = useRole();
  const [confirmAction, setConfirmAction] = React.useState<'APPROVE' | 'ACTIVATE' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const activateIdempotencyKeyRef = React.useRef<string | null>(null);

  const loanQuery = useQuery({
    queryKey: ['loan-account', loanId],
    queryFn: () => apiClient.get<LoanAccount>(`/loan-accounts/${loanId}`),
    retry: false,
  });
  const loan = loanQuery.data;

  const approveMutation = useMutation({
    mutationFn: () => apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/approve`),
    onSuccess: () => {
      setConfirmAction(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['loan-account', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
    },
    onError: (error: unknown) => {
      setActionError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => {
      if (!activateIdempotencyKeyRef.current) activateIdempotencyKeyRef.current = crypto.randomUUID();
      return apiClient.post<LoanAccount>(`/loan-accounts/${loanId}/activate`, undefined, {
        'Idempotency-Key': activateIdempotencyKeyRef.current,
      });
    },
    onSuccess: () => {
      activateIdempotencyKeyRef.current = null;
      setConfirmAction(null);
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['loan-account', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['repayment-schedule', loanId] });
    },
    onError: (error: unknown) => {
      setActionError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  const confirmLoanStatusChange = () => {
    if (confirmAction === 'APPROVE') approveMutation.mutate();
    else if (confirmAction === 'ACTIVATE') activateMutation.mutate();
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
    queryFn: () => apiClient.get<PaginatedResponse<LoanTransaction>>(`/loan-accounts/${loanId}/transactions?limit=200`),
  });

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
  const transactions = transactionsQuery.data?.items ?? [];
  const num = (v: string) => Number.parseFloat(v) || 0;

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
          <LoanStatusBadge status={loan.status} />
          {canCreateLoanAccount && loan.status === 'APPROVED' && (
            <Button size="sm" onClick={() => setConfirmAction('ACTIVATE')}>
              Activate Loan
            </Button>
          )}
          {canCreateLoanAccount && loan.status === 'PENDING_APPROVAL' && (
            <Button size="sm" onClick={() => setConfirmAction('APPROVE')}>
              Approve Loan
            </Button>
          )}
        </div>
      </div>

      <RiskAssessmentCard loanId={loan.id} />

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <MiniStat label="Collections Balance" value={formatPeso(num(loan.collectionsBalance))} emphasize />
          <MiniStat label="Accounting Balance" value={formatPeso(num(loan.accountingBalance))} emphasize />
          <MiniStat label="Principal" value={formatPeso(num(loan.balances.principalBalance))} />
          <MiniStat label="Interest" value={formatPeso(num(loan.balances.interestBalance))} />
          <MiniStat label="Penalty" value={formatPeso(num(loan.balances.penaltyBalance))} />
          <MiniStat label="Fees" value={formatPeso(num(loan.balances.feesBalance))} />
          <MiniStat label="Principal Amount" value={formatPeso(num(loan.principalAmount))} />
          <MiniStat label="Interest Rate" value={`${loan.interestRate}%`} />
          <MiniStat label="Installments" value={String(loan.installmentCount)} />
          <MiniStat label="First Repayment" value={formatDate(loan.firstRepaymentDate)} />
        </CardContent>
      </Card>

      <Card>
        <Tabs defaultValue="schedule">
          <CardHeader className="pb-2">
            <TabsList>
              <TabsTrigger value="schedule">Repayment Schedule ({installments.length})</TabsTrigger>
              <TabsTrigger value="payments">Payment History ({transactions.length})</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="schedule" className="mt-0">
              {installmentsQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
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
                      <TableCell className="text-right font-medium text-muted-foreground">Paid</TableCell>
                      <TableCell className="font-medium text-muted-foreground">Status</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((i) => {
                      const late = wasInstallmentLate(i);
                      return (
                        <TableRow key={i.id} className={late ? 'bg-destructive/5' : undefined}>
                          <TableCell>{i.installmentNumber}</TableCell>
                          <TableCell>{formatDate(i.dueDate)}</TableCell>
                          <TableCell className="text-right">{formatPeso(num(i.due.principal))}</TableCell>
                          <TableCell className="text-right">{formatPeso(num(i.due.interest))}</TableCell>
                          <TableCell className="text-right">{formatPeso(num(i.paid.principal) + num(i.paid.interest))}</TableCell>
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Rows shaded red are the installments counted as "late" in the Risk Assessment card above - currently overdue, or
                paid after their due date.
              </p>
            </TabsContent>
            <TabsContent value="payments" className="mt-0">
              {transactionsQuery.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
              ) : transactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No transactions recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell className="font-medium text-muted-foreground">Date</TableCell>
                      <TableCell className="font-medium text-muted-foreground">Type</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Amount</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">Balance After</TableCell>
                      <TableCell className="font-medium text-muted-foreground">Comment</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{formatDate(t.entryDate)}</TableCell>
                        <TableCell>
                          <TransactionTypeBadge type={t.type} />
                        </TableCell>
                        <TableCell className="text-right">{formatPeso(num(t.amount))}</TableCell>
                        <TableCell className="text-right">{formatPeso(num(t.balanceAfter))}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.comment ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <RealRemindersPanel loanCode={loan.loanCode} borrower={borrower} installments={installments} />

      <RealNotesPanel ownerType="LOAN_ACCOUNT" ownerId={loan.id} />

      <RealAttachmentsPanel ownerType="LOAN_ACCOUNT" ownerId={loan.id} canUpload />

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

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Confirm {confirmAction === 'APPROVE' ? 'approval' : 'disbursement'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'APPROVE'
                ? `This will approve ${loan.loanCode} - the account moves from Pending Approval to Approved, ready to be activated/disbursed. This is a safety-net confirmation to prevent an accidental click.`
                : `This will activate ${loan.loanCode} - disbursing the loan and generating its repayment schedule (${loan.installmentCount} installments starting ${formatDate(loan.firstRepaymentDate)}), moving it to Active. This is a safety-net confirmation to prevent an accidental click.`}
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button onClick={confirmLoanStatusChange} disabled={approveMutation.isPending || activateMutation.isPending}>
              Yes, confirm
            </Button>
          </DialogFooter>
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
