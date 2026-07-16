import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldTooltip } from '@/components/FieldTooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { ACTIVE_PAYMENT_METHODS } from '@/lib/staticConfig';
import { previewCrossInstallmentAllocation, type InstallmentAllocationPreviewRow } from '@/lib/paymentAllocationPreview';
import { formatDate, formatPeso } from '@/lib/utils';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { Borrower, LoanAccount, PaginatedResponse, ProcessPaymentResponse, RepaymentInstallment } from '@/lib/loanApiTypes';

type AllocationMode = 'AUTOMATIC' | 'MANUAL';

/** One manual per-installment entry (Payment Recording "Manual" tab) - every field is a raw text input value, parsed on demand. */
interface ManualEntry {
  principal: string;
  interest: string;
  penalty: string;
  fees: string;
}

function manualEntryTotal(entry: ManualEntry): number {
  return (
    (Number.parseFloat(entry.principal) || 0) +
    (Number.parseFloat(entry.interest) || 0) +
    (Number.parseFloat(entry.penalty) || 0) +
    (Number.parseFloat(entry.fees) || 0)
  );
}

/**
 * 2026-07-16: penalty must fall back to `i.penaltyOverride`, NOT `i.currentPenaltyOwed` — that
 * field also reflects ADR-050's live daily-accrual projection, which the backend's actual payment
 * allocation (`ProcessPaymentUseCase`) deliberately does NOT charge against (a today-relative
 * display projection, never posted to the ledger as collectible) — only an explicit Reduce Penalty
 * override is. Using the live figure here would show/auto-fill/allocate a different amount than
 * what the backend actually applies. Fees have no such live-vs-frozen split, so `currentFeesDue`
 * (= `feesOverride?.amount ?? due.fees`) is already override-only and safe to use directly.
 */
function remainingDue(i: RepaymentInstallment) {
  const owedPenalty = parseAmount(i.penaltyOverride?.amount ?? i.due.penalty);
  const owedFees = parseAmount(i.currentFeesDue);
  return {
    principal: Math.max(0, parseAmount(i.due.principal) - parseAmount(i.paid.principal)),
    interest: Math.max(0, parseAmount(i.due.interest) - parseAmount(i.paid.interest)),
    penalty: Math.max(0, owedPenalty - parseAmount(i.paid.penalty)),
    fees: Math.max(0, owedFees - parseAmount(i.paid.fees)),
  };
}

const PAYABLE_STATUSES: LoanAccount['status'][] = ['ACTIVE', 'ACTIVE_IN_ARREARS'];

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Column sort here is DISPLAY-ONLY - it never changes which installments
 * were actually offered a share of the payment. `previewCrossInstallmentAllocation`
 * must keep computing over `unpaidInstallments` in oldest-due-first order
 * (ADR-009 §2); re-sorting the underlying installments to match a column
 * click would silently change the allocation itself, not just how it's
 * displayed. So the sort here only reorders the already-computed
 * `preview.rows` for browsing, via a `dueDate` looked up per row.
 */
function getPreviewRowSortValue(
  row: InstallmentAllocationPreviewRow & { dueDate: string },
  key: string,
): string | number | Date | null | undefined {
  switch (key) {
    case 'installmentNumber':
      return row.installmentNumber;
    case 'dueDate':
      return new Date(row.dueDate);
    case 'feesApplied':
      return row.feesApplied;
    case 'penaltyApplied':
      return row.penaltyApplied;
    case 'interestApplied':
      return row.interestApplied;
    case 'principalApplied':
      return row.principalApplied;
    default:
      return undefined;
  }
}

/**
 * Frontend↔Backend Wiring Pilot, Stage 1
 * (`docs/Architecture/FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md`). Real loan/installment data via
 * `GET /loan-accounts`, `/repayment-schedule`, `/borrowers/:id`; real payment submission via
 * `POST /loan-accounts/:id/payments` (idempotency-key protected). The allocation preview table
 * itself is unchanged - `previewCrossInstallmentAllocation()` is a legitimate client-side preview
 * of the same fees→penalty→interest→principal rule the backend enforces authoritatively; only its
 * data source changed, from mock installments to real ones.
 *
 * Manual allocation mode (2026-07-10): staff pick specific unpaid installments and enter an exact
 * Principal/Interest/Penalty/Fees split per installment, which `ProcessPaymentUseCase` now accepts
 * as `manualAllocations` instead of running its automatic fees→penalty→interest→principal engine.
 * Client-side validates the four fields sum to the payment amount before enabling Submit; the
 * backend re-validates authoritatively (per-installment remaining-due caps + exact total match)
 * before posting.
 */
/** Everything the post-payment confirmation dialog needs, captured at success time (the form/queries reset underneath it). */
interface PaymentSuccessInfo {
  response: ProcessPaymentResponse;
  loanId: string;
  loanCode: string;
  borrowerName: string;
  amount: number;
  paidAt: string;
  orNumber?: string;
}

export function PaymentRecordingPage() {
  useLogPageView('Record Payment');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedLoanId = searchParams.get('loanId');

  // Step 1: find the client. Deep-linked from LoanDetailPage's "Record Payment" button
  // (?loanId=...) resolves the client automatically instead of making staff search again.
  const [selectedBorrower, setSelectedBorrower] = React.useState<Borrower | null>(null);
  const [loanId, setLoanId] = React.useState('');

  const preselectedLoanQuery = useQuery({
    queryKey: ['loan-accounts', preselectedLoanId],
    queryFn: () => apiClient.get<LoanAccount>(`/loan-accounts/${preselectedLoanId}`),
    enabled: Boolean(preselectedLoanId) && !selectedBorrower,
  });
  React.useEffect(() => {
    if (!preselectedLoanQuery.data || selectedBorrower) return;
    const loan = preselectedLoanQuery.data;
    void apiClient.get<Borrower>(`/borrowers/${loan.borrowerId}`).then((borrower) => {
      setSelectedBorrower(borrower);
      setLoanId(loan.id);
    });
  }, [preselectedLoanQuery.data, selectedBorrower]);

  const [clientSearch, setClientSearch] = React.useState('');
  const debouncedClientSearch = useDebouncedValue(clientSearch);
  const clientSearchQuery = useQuery({
    queryKey: ['borrowers', 'search', debouncedClientSearch],
    queryFn: () => apiClient.get<PaginatedResponse<Borrower>>(`/borrowers?search=${encodeURIComponent(debouncedClientSearch)}&limit=10`),
    enabled: !selectedBorrower && debouncedClientSearch.trim().length > 0,
  });
  const clientResults = clientSearchQuery.data?.items ?? [];

  const chooseClient = (borrower: Borrower) => {
    setSelectedBorrower(borrower);
    setLoanId('');
  };
  const changeClient = () => {
    setSelectedBorrower(null);
    setLoanId('');
    setClientSearch('');
  };

  // Step 2: that client's own active loans only - never the whole company's ~1,300 payable loans.
  const clientLoansQuery = useQuery({
    queryKey: ['loan-accounts', 'by-borrower', selectedBorrower?.id],
    queryFn: () => apiClient.get<PaginatedResponse<LoanAccount>>(`/loan-accounts?borrowerId=${selectedBorrower!.id}&limit=50`),
    enabled: Boolean(selectedBorrower),
  });
  const clientPayableLoans = (clientLoansQuery.data?.items ?? []).filter((l) => PAYABLE_STATUSES.includes(l.status));
  const selectedLoan = clientPayableLoans.find((l) => l.id === loanId);

  // Starts blank rather than a hardcoded guess (e.g. "1000.00") — the effect below fills it in
  // once the oldest unpaid installment's actual total due is known, per loan selection.
  const [amount, setAmount] = React.useState('');
  const todayDateString = () => new Date().toISOString().slice(0, 10);
  // Defaults to today but stays editable — staff often record a payment (e.g. cash collected in
  // the field) after the fact, and the backend's ProcessPaymentUseCase already accepts an explicit
  // paidAt; this UI simply exposes it instead of silently always using "now".
  const [paidAt, setPaidAt] = React.useState(todayDateString());
  // OR#/AR# (2026-07-11 user request): matches the SDevTech system's own receipt-number fields.
  // OR# is required — a real payment always has an Official Receipt; AR# is optional since not
  // every payment channel issues an Acknowledgment Receipt.
  const [orNumber, setOrNumber] = React.useState('');
  const [arNumber, setArNumber] = React.useState('');
  const [allocationMode, setAllocationMode] = React.useState<AllocationMode>('AUTOMATIC');
  const [paymentMethod, setPaymentMethod] = React.useState('BANK_TRANSFER');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<PaymentSuccessInfo | null>(null);
  const idempotencyKeyRef = React.useRef<string | null>(null);

  // Manual mode (2026-07-10): staff picks specific unpaid installments and types the exact
  // Principal/Interest/Penalty/Fees split for each, overriding the automatic waterfall. Keyed by
  // installmentId - an installment only appears here once staff has explicitly included it.
  const [manualEntries, setManualEntries] = React.useState<Record<string, ManualEntry>>({});
  React.useEffect(() => {
    setManualEntries({});
  }, [loanId]);
  const toggleManualInstallment = (installmentId: string, include: boolean) => {
    setManualEntries((prev) => {
      const next = { ...prev };
      if (include) {
        next[installmentId] = { principal: '', interest: '', penalty: '', fees: '' };
      } else {
        delete next[installmentId];
      }
      return next;
    });
  };
  const updateManualField = (installmentId: string, field: keyof ManualEntry, value: string) => {
    setManualEntries((prev) => ({ ...prev, [installmentId]: { ...prev[installmentId]!, [field]: value } }));
  };
  const manualTotal = Object.values(manualEntries).reduce((sum, e) => sum + manualEntryTotal(e), 0);

  const installmentsQuery = useQuery({
    queryKey: ['repayment-schedule', loanId],
    queryFn: () => apiClient.get<PaginatedResponse<RepaymentInstallment>>(`/loan-accounts/${loanId}/repayment-schedule`),
    enabled: Boolean(loanId),
  });
  const unpaidInstallments = (installmentsQuery.data?.items ?? [])
    .filter((i) => i.status !== 'PAID')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Guards the auto-fill effect below so it only ever fires once per loan selection — without
  // this, checking merely `amount === ''` couldn't tell "just switched loans, never filled in"
  // apart from "staff manually cleared the field via backspace", so clearing the amount to type a
  // different figure kept snapping it right back to the auto-filled total (2026-07-15 bug report).
  const hasAutoFilledAmountRef = React.useRef(false);

  // Clears the previous loan's amount immediately on switch, so it never briefly shows a stale
  // figure while the new loan's schedule is still loading. Also clears OR#/AR# — a receipt number
  // is specific to one payment, never reused across a different loan selection.
  React.useEffect(() => {
    setAmount('');
    setOrNumber('');
    setArNumber('');
    hasAutoFilledAmountRef.current = false;
  }, [loanId]);
  // Auto-fills once the oldest unpaid installment's real total due is known — the amount staff
  // will most commonly want to collect. Only fires once per loan selection (guarded by the ref
  // above), not merely "whenever amount happens to be blank" — otherwise staff could never
  // deliberately clear the field to type a different amount.
  React.useEffect(() => {
    if (hasAutoFilledAmountRef.current || amount !== '' || unpaidInstallments.length === 0) return;
    const oldest = remainingDue(unpaidInstallments[0]!);
    const total = oldest.principal + oldest.interest + oldest.penalty + oldest.fees;
    setAmount(total.toFixed(2));
    hasAutoFilledAmountRef.current = true;
  }, [amount, unpaidInstallments]);

  const paymentAmount = Number.parseFloat(amount) || 0;
  const preview = previewCrossInstallmentAllocation(
    paymentAmount,
    unpaidInstallments.map((i) => {
      const r = remainingDue(i);
      return {
        id: i.id,
        installmentNumber: i.installmentNumber,
        remainingDue: { feesDue: r.fees, penaltyDue: r.penalty, interestDue: r.interest, principalDue: r.principal },
      };
    }),
  );
  const previewRowsWithDueDate = preview.rows.map((row) => ({
    ...row,
    dueDate: unpaidInstallments.find((i) => i.id === row.installmentId)?.dueDate ?? '',
  }));
  const { sorted: sortedPreviewRows, sort: previewSort, toggleSort: togglePreviewSort } = useSortableTable(
    previewRowsWithDueDate,
    getPreviewRowSortValue,
    { key: 'dueDate', direction: 'desc' },
  );

  const totals = preview.rows.reduce(
    (acc, row) => ({
      fees: acc.fees + row.feesApplied,
      penalty: acc.penalty + row.penaltyApplied,
      interest: acc.interest + row.interestApplied,
      principal: acc.principal + row.principalApplied,
    }),
    { fees: 0, penalty: 0, interest: 0, principal: 0 },
  );

  const manualInstallmentCount = Object.keys(manualEntries).length;
  // Cent-level float comparison - same epsilon the automatic Remainder box's peso display already
  // rounds to, so "matches" here agrees with what staff sees on screen.
  const manualMismatch = manualInstallmentCount === 0 || Math.abs(manualTotal - paymentAmount) > 0.005;

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      const base = { paymentAmount: amount, paidAt, orNumber: orNumber.trim() || undefined, arNumber: arNumber.trim() || undefined };
      const body =
        allocationMode === 'MANUAL'
          ? {
              ...base,
              allocations: Object.entries(manualEntries).map(([installmentId, e]) => ({
                installmentId,
                principal: (Number.parseFloat(e.principal) || 0).toFixed(2),
                interest: (Number.parseFloat(e.interest) || 0).toFixed(2),
                penalty: (Number.parseFloat(e.penalty) || 0).toFixed(2),
                fees: (Number.parseFloat(e.fees) || 0).toFixed(2),
              })),
            }
          : base;
      return apiClient.post<ProcessPaymentResponse>(`/loan-accounts/${loanId}/payments`, body, {
        'Idempotency-Key': idempotencyKeyRef.current,
      });
    },
    onSuccess: (response) => {
      idempotencyKeyRef.current = null;
      setConfirmOpen(false);
      setSubmitError(null);
      setSuccessInfo({
        response,
        loanId,
        loanCode: selectedLoan?.loanCode ?? '',
        borrowerName: selectedBorrower?.fullName ?? '',
        amount: paymentAmount,
        paidAt,
        orNumber: orNumber.trim() || undefined,
      });
      setOrNumber('');
      setArNumber('');
      setAmount('');
      hasAutoFilledAmountRef.current = true; // do not auto-fill over the just-cleared field until a new loan is picked
      // refetchQueries (not invalidateQueries) - forces the actual network refetch of this loan's
      // repayment schedule right now, rather than only marking it stale. The "Next due" summary
      // below reads unpaidInstallments straight from this query, and previously wasn't reliably
      // picking up the just-recorded payment until a full page reload (2026-07-15 bug report).
      void queryClient.refetchQueries({ queryKey: ['loan-accounts'] });
      void queryClient.refetchQueries({ queryKey: ['repayment-schedule', loanId] });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setSubmitError('This loan was just updated by another action (or this payment is already being processed). Refresh and try again.');
        } else if (error.status === 403) {
          setSubmitError("You don't have permission to record a payment on this loan.");
        } else {
          setSubmitError(error.message);
        }
      } else {
        setSubmitError('Could not reach the server. Check your connection and try again.');
      }
    },
  });

  const openConfirm = () => {
    idempotencyKeyRef.current = null;
    setSubmitError(null);
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Record Payment</h2>
        <p className="text-sm text-muted-foreground">
          Live - posts a real payment against <code>app/backend</code>. Automatic allocation: fees → penalty → interest → principal,
          oldest installment first (ADR-009).
        </p>
      </div>

      {clientLoansQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load this client's loan accounts. Is the backend running?
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          {!selectedBorrower ? (
            <>
              <CardHeader>
                <CardTitle>Find Client</CardTitle>
                <CardDescription>Search by borrower name or loan code, then choose one of their active loans.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="client-search"
                    autoFocus
                    placeholder="Search client name or loan code..."
                    className="pl-8"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                </div>

                {clientSearchQuery.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>}

                {!clientSearchQuery.isLoading && debouncedClientSearch.trim().length > 0 && clientResults.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">No clients match "{debouncedClientSearch}".</p>
                )}

                {clientResults.length > 0 && (
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {clientResults.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => chooseClient(b)}
                        className="w-full rounded-md border p-2.5 text-left text-sm hover:bg-secondary/60"
                      >
                        <p className="font-medium">{b.fullName}</p>
                        {b.mobilePhone1 && <p className="text-xs text-muted-foreground">{b.mobilePhone1}</p>}
                      </button>
                    ))}
                  </div>
                )}

                {debouncedClientSearch.trim().length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Start typing to find a client.</p>
                )}
              </CardContent>
            </>
          ) : !loanId ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedBorrower.fullName}</CardTitle>
                    <CardDescription>Choose which loan to record a payment against.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={changeClient}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Change client
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {clientLoansQuery.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading loans…</p>}
                {!clientLoansQuery.isLoading && clientPayableLoans.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">This client has no active loans to pay.</p>
                )}
                {clientPayableLoans.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLoanId(l.id)}
                    className="w-full rounded-md border p-2.5 text-left text-sm hover:bg-secondary/60"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{l.loanCode}</p>
                      <Badge variant={l.status === 'ACTIVE_IN_ARREARS' ? 'destructive' : 'success'}>
                        {l.status === 'ACTIVE_IN_ARREARS' ? 'In Arrears' : 'Active'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Collections balance: {formatPeso(parseAmount(l.collectionsBalance))}
                    </p>
                  </button>
                ))}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Payment Details</CardTitle>
                    <CardDescription>Enter an amount to preview allocation.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setLoanId('')}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Change loan
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedLoan ? (
                  <div className="rounded-md border bg-secondary/40 p-3 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{selectedBorrower.fullName}</span> - {selectedLoan.loanCode}
                    </p>
                    <p className="mt-1">Collections balance: {formatPeso(parseAmount(selectedLoan.collectionsBalance))}</p>
                    <p>Accounting balance: {formatPeso(parseAmount(selectedLoan.accountingBalance))}</p>
                    {installmentsQuery.isLoading ? (
                      <p className="mt-2 border-t pt-2">Loading next due amount…</p>
                    ) : installmentsQuery.isError ? (
                      <p className="mt-2 border-t pt-2 text-destructive">
                        Could not load the repayment schedule ({installmentsQuery.error instanceof ApiError ? installmentsQuery.error.message : 'unknown error'}).
                      </p>
                    ) : unpaidInstallments.length > 0 ? (
                      <div className="mt-2 border-t pt-2">
                        {(() => {
                          const oldest = unpaidInstallments[0]!;
                          const remaining = remainingDue(oldest);
                          const totalRemaining = remaining.principal + remaining.interest + remaining.penalty + remaining.fees;
                          return (
                            <p>
                              <span className="font-medium text-foreground">Next due:</span> Installment #{oldest.installmentNumber} ·{' '}
                              {formatDate(oldest.dueDate)} · <span className="font-medium text-foreground">{formatPeso(totalRemaining)}</span>
                            </p>
                          );
                        })()}
                      </div>
                    ) : (
                      <p className="mt-2 border-t pt-2">No unpaid installments remain on this loan.</p>
                    )}
                  </div>
                ) : (
                  !clientLoansQuery.isLoading && (
                    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                      This loan is no longer payable - it's fully paid (Closed) or otherwise not Active. No payment can be recorded
                      against it.
                    </div>
                  )
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="flex items-center gap-1">
                    Payment amount <FieldTooltip text="Total peso amount the borrower is paying today." />
                  </Label>
                  <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="paid-at">Payment date</Label>
                  <Input id="paid-at" type="date" max={todayDateString()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                  <p className="text-xs text-muted-foreground">When the payment was actually received — defaults to today, editable for a late-entered payment.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="or-number">OR#</Label>
                    <Input id="or-number" placeholder="Official Receipt #" value={orNumber} onChange={(e) => setOrNumber(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Leave blank if not yet issued — enter AR# instead, add OR# later.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ar-number">AR#</Label>
                    <Input id="ar-number" placeholder="Acknowledgment Receipt #" value={arNumber} onChange={(e) => setArNumber(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    Allocation{' '}
                    <FieldTooltip text="Automatic lets the system split the payment across fees, penalty, interest, and principal. Manual lets you choose exact amounts per installment." />
                  </Label>
                  <Tabs value={allocationMode} onValueChange={(v) => setAllocationMode(v as AllocationMode)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="AUTOMATIC">Automatic</TabsTrigger>
                      <TabsTrigger value="MANUAL">Manual</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <p className="text-xs text-muted-foreground">
                    {allocationMode === 'AUTOMATIC'
                      ? 'System splits the payment automatically (fees → penalty → interest → principal).'
                      : 'Pick installments below and type the exact Principal/Interest/Penalty/Fees amounts. The four fields must add up to the payment amount before you can submit.'}
                  </p>
                </div>

                {allocationMode === 'MANUAL' && (
                  <div className="space-y-1.5">
                    <Label>Installments</Label>
                    {installmentsQuery.isLoading ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">Loading installments…</p>
                    ) : unpaidInstallments.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">No unpaid installments for this loan.</p>
                    ) : (
                      <div className="max-h-96 space-y-2 overflow-y-auto">
                        {unpaidInstallments.map((inst) => {
                          const due = remainingDue(inst);
                          const entry = manualEntries[inst.id];
                          const included = Boolean(entry);
                          return (
                            <div key={inst.id} className="rounded-md border p-2.5">
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={included}
                                  onChange={(e) => toggleManualInstallment(inst.id, e.target.checked)}
                                />
                                <span className="font-medium">Installment #{inst.installmentNumber}</span>
                                <span className="text-xs text-muted-foreground">{formatDate(inst.dueDate)}</span>
                              </label>
                              {included && entry && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div>
                                    <Label htmlFor={`${inst.id}-principal`} className="text-xs text-muted-foreground">
                                      Principal (due {formatPeso(due.principal)})
                                    </Label>
                                    <Input
                                      id={`${inst.id}-principal`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={entry.principal}
                                      onChange={(e) => updateManualField(inst.id, 'principal', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`${inst.id}-interest`} className="text-xs text-muted-foreground">
                                      Interest (due {formatPeso(due.interest)})
                                    </Label>
                                    <Input
                                      id={`${inst.id}-interest`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={entry.interest}
                                      onChange={(e) => updateManualField(inst.id, 'interest', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`${inst.id}-penalty`} className="text-xs text-muted-foreground">
                                      Penalty (due {formatPeso(due.penalty)})
                                    </Label>
                                    <Input
                                      id={`${inst.id}-penalty`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={entry.penalty}
                                      onChange={(e) => updateManualField(inst.id, 'penalty', e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`${inst.id}-fees`} className="text-xs text-muted-foreground">
                                      Fees (due {formatPeso(due.fees)})
                                    </Label>
                                    <Input
                                      id={`${inst.id}-fees`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={entry.fees}
                                      onChange={(e) => updateManualField(inst.id, 'fees', e.target.value)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div
                      className={`rounded-md border p-2 text-center text-xs ${
                        manualMismatch ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-success/40 bg-success/10'
                      }`}
                    >
                      Entered total: {formatPeso(manualTotal)} / Payment amount: {formatPeso(paymentAmount)}
                      {manualMismatch && ' - must match before submitting.'}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="payment-method" className="flex items-center gap-1">
                    Mode of payment <FieldTooltip text="How the borrower is paying - cash, bank transfer, over-the-counter, etc." />
                  </Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVE_PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m.code} value={m.code}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Recorded for staff reference only - not yet a field on the backend loan account.</p>
                </div>

                <Button
                  className="w-full"
                  disabled={!selectedLoan || paymentAmount <= 0 || (allocationMode === 'MANUAL' && manualMismatch)}
                  onClick={openConfirm}
                >
                  Submit Payment
                </Button>
              </CardContent>
            </>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Allocation Preview</CardTitle>
              <CardDescription>Per-installment split for the entered amount, dated {formatDate(paidAt)}</CardDescription>
            </div>
            <Badge variant="outline">Preview - final split is computed by the server on submit</Badge>
          </CardHeader>
          <CardContent>
            {installmentsQuery.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading installments…</p>
            ) : unpaidInstallments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No unpaid installments for this loan.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead sortKey="installmentNumber" currentSort={previewSort} onSort={togglePreviewSort}>
                        #
                      </SortableTableHead>
                      <SortableTableHead sortKey="dueDate" currentSort={previewSort} onSort={togglePreviewSort} isDateColumn>
                        Due Date
                      </SortableTableHead>
                      <SortableTableHead sortKey="principalApplied" currentSort={previewSort} onSort={togglePreviewSort} className="text-right">
                        Principal
                      </SortableTableHead>
                      <SortableTableHead sortKey="interestApplied" currentSort={previewSort} onSort={togglePreviewSort} className="text-right">
                        Interest
                      </SortableTableHead>
                      <SortableTableHead sortKey="penaltyApplied" currentSort={previewSort} onSort={togglePreviewSort} className="text-right">
                        Penalty
                      </SortableTableHead>
                      <SortableTableHead sortKey="feesApplied" currentSort={previewSort} onSort={togglePreviewSort} className="text-right">
                        Fees
                      </SortableTableHead>
                      <TableCell className="text-right font-medium text-muted-foreground">Total</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPreviewRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                          Enter a payment amount above ₱0.00 to see the allocation.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedPreviewRows.map((row) => (
                        <TableRow key={row.installmentId}>
                          <TableCell>{row.installmentNumber}</TableCell>
                          <TableCell>{formatDate(row.dueDate)}</TableCell>
                          <TableCell className="text-right">{formatPeso(row.principalApplied)}</TableCell>
                          <TableCell className="text-right">{formatPeso(row.interestApplied)}</TableCell>
                          <TableCell className="text-right">{formatPeso(row.penaltyApplied)}</TableCell>
                          <TableCell className="text-right">{formatPeso(row.feesApplied)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatPeso(row.principalApplied + row.interestApplied + row.penaltyApplied + row.feesApplied)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="text-sm font-semibold">{formatPeso(totals.principal)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Interest</p>
                    <p className="text-sm font-semibold">{formatPeso(totals.interest)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Penalty</p>
                    <p className="text-sm font-semibold">{formatPeso(totals.penalty)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Fees</p>
                    <p className="text-sm font-semibold">{formatPeso(totals.fees)}</p>
                  </div>
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-center">
                    <p className="text-xs text-muted-foreground">Remainder</p>
                    <p className="text-sm font-semibold">{formatPeso(preview.remainder)}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <RecentActivityPanel label="Record Payment" />

      <Dialog open={confirmOpen} onOpenChange={(open) => !paymentMutation.isPending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              Post {formatPeso(paymentAmount)} against {selectedLoan && selectedBorrower ? `${selectedBorrower.fullName} — ${selectedLoan.loanCode}` : 'this loan'},
              dated {formatDate(paidAt)}
              {orNumber.trim() ? `, OR# ${orNumber.trim()}` : ''}
              {arNumber.trim() ? `, AR# ${arNumber.trim()}` : ''}? This cannot be undone from this screen.
            </DialogDescription>
          </DialogHeader>
          {submitError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={paymentMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? 'Posting…' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successInfo !== null} onOpenChange={(open) => !open && setSuccessInfo(null)}>
        <DialogContent className="max-w-xl">
          {successInfo && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <DialogTitle>Payment recorded</DialogTitle>
                </div>
                <DialogDescription>
                  {successInfo.loanCode} · {successInfo.borrowerName}
                  {successInfo.orNumber ? ` · OR# ${successInfo.orNumber}` : ''} · {formatDate(successInfo.paidAt)}
                </DialogDescription>
              </DialogHeader>
              <p className="text-2xl font-semibold">{formatPeso(successInfo.amount)}</p>
              {successInfo.response.appliedAllocations.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Applied to:</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell className="text-xs font-medium text-muted-foreground">Installment</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">Fees</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">Penalty</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">Interest</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">Principal</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground">Total</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {successInfo.response.appliedAllocations.map((a) => (
                        <TableRow key={a.repaymentInstallmentId}>
                          <TableCell className="text-xs">
                            {a.installmentNumber !== null ? `#${a.installmentNumber}` : '—'}
                            {a.installmentDueDate ? ` · ${formatDate(a.installmentDueDate)}` : ''}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{formatPeso(parseAmount(a.feesApplied))}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{formatPeso(parseAmount(a.penaltyApplied))}</TableCell>
                          <TableCell className="text-right text-xs">{formatPeso(parseAmount(a.interestApplied))}</TableCell>
                          <TableCell className="text-right text-xs">{formatPeso(parseAmount(a.principalApplied))}</TableCell>
                          <TableCell className="text-right text-xs font-medium">
                            {formatPeso(
                              parseAmount(a.feesApplied) +
                                parseAmount(a.penaltyApplied) +
                                parseAmount(a.interestApplied) +
                                parseAmount(a.principalApplied),
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {parseAmount(successInfo.response.remainder) > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs text-warning">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {formatPeso(parseAmount(successInfo.response.remainder))} was not applied - it exceeds everything currently
                    due on this loan. Only the applied amount was posted.
                  </span>
                </div>
              )}
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Loan balance after</p>
                <p className="text-base font-semibold">
                  {formatPeso(parseAmount(successInfo.response.loanAccount.collectionsBalance))}
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuccessInfo(null);
                    changeClient();
                  }}
                >
                  Close
                </Button>
                <Button onClick={() => navigate(`/loans/${successInfo.loanId}`)}>View loan</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
