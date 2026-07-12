import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Search } from 'lucide-react';
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

function remainingDue(i: RepaymentInstallment) {
  return {
    principal: Math.max(0, parseAmount(i.due.principal) - parseAmount(i.paid.principal)),
    interest: Math.max(0, parseAmount(i.due.interest) - parseAmount(i.paid.interest)),
    penalty: Math.max(0, parseAmount(i.due.penalty) - parseAmount(i.paid.penalty)),
    fees: Math.max(0, parseAmount(i.due.fees) - parseAmount(i.paid.fees)),
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
export function PaymentRecordingPage() {
  useLogPageView('Payment Recording');
  const queryClient = useQueryClient();
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

  const [amount, setAmount] = React.useState('1000.00');
  const [allocationMode, setAllocationMode] = React.useState<AllocationMode>('AUTOMATIC');
  const [paymentMethod, setPaymentMethod] = React.useState(ACTIVE_PAYMENT_METHODS[0]!.code);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
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

  const paymentAmount = Number.parseFloat(amount) || 0;
  const preview = previewCrossInstallmentAllocation(
    paymentAmount,
    unpaidInstallments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      remainingDue: {
        feesDue: Math.max(0, parseAmount(i.due.fees) - parseAmount(i.paid.fees)),
        penaltyDue: Math.max(0, parseAmount(i.due.penalty) - parseAmount(i.paid.penalty)),
        interestDue: Math.max(0, parseAmount(i.due.interest) - parseAmount(i.paid.interest)),
        principalDue: Math.max(0, parseAmount(i.due.principal) - parseAmount(i.paid.principal)),
      },
    })),
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
      const body =
        allocationMode === 'MANUAL'
          ? {
              paymentAmount: amount,
              allocations: Object.entries(manualEntries).map(([installmentId, e]) => ({
                installmentId,
                principal: (Number.parseFloat(e.principal) || 0).toFixed(2),
                interest: (Number.parseFloat(e.interest) || 0).toFixed(2),
                penalty: (Number.parseFloat(e.penalty) || 0).toFixed(2),
                fees: (Number.parseFloat(e.fees) || 0).toFixed(2),
              })),
            }
          : { paymentAmount: amount };
      return apiClient.post<ProcessPaymentResponse>(`/loan-accounts/${loanId}/payments`, body, {
        'Idempotency-Key': idempotencyKeyRef.current,
      });
    },
    onSuccess: () => {
      idempotencyKeyRef.current = null;
      setConfirmOpen(false);
      setSubmitError(null);
      void queryClient.invalidateQueries({ queryKey: ['loan-accounts'] });
      void queryClient.invalidateQueries({ queryKey: ['repayment-schedule', loanId] });
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
        <h2 className="text-2xl font-semibold tracking-tight">Payment Recording</h2>
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
                      <Badge variant={l.status === 'ACTIVE_IN_ARREARS' ? 'destructive' : 'outline'}>
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
                {selectedLoan && (
                  <div className="rounded-md border bg-secondary/40 p-3 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{selectedBorrower.fullName}</span> - {selectedLoan.loanCode}
                    </p>
                    <p className="mt-1">Collections balance: {formatPeso(parseAmount(selectedLoan.collectionsBalance))}</p>
                    <p>Accounting balance: {formatPeso(parseAmount(selectedLoan.accountingBalance))}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="amount" className="flex items-center gap-1">
                    Payment amount <FieldTooltip text="Total peso amount the borrower is paying today." />
                  </Label>
                  <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
                  disabled={!loanId || paymentAmount <= 0 || (allocationMode === 'MANUAL' && manualMismatch)}
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
              <CardDescription>Per-installment split for the entered amount</CardDescription>
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
                      <SortableTableHead sortKey="feesApplied" currentSort={previewSort} onSort={togglePreviewSort} className="text-right">
                        Fees
                      </SortableTableHead>
                      <SortableTableHead sortKey="penaltyApplied" currentSort={previewSort} onSort={togglePreviewSort} className="text-right">
                        Penalty
                      </SortableTableHead>
                      <SortableTableHead sortKey="interestApplied" currentSort={previewSort} onSort={togglePreviewSort} className="text-right">
                        Interest
                      </SortableTableHead>
                      <SortableTableHead sortKey="principalApplied" currentSort={previewSort} onSort={togglePreviewSort} className="text-right">
                        Principal
                      </SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPreviewRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                          Enter a payment amount above ₱0.00 to see the allocation.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedPreviewRows.map((row) => (
                        <TableRow key={row.installmentId}>
                          <TableCell>{row.installmentNumber}</TableCell>
                          <TableCell>{formatDate(row.dueDate)}</TableCell>
                          <TableCell className="text-right">{formatPeso(row.feesApplied)}</TableCell>
                          <TableCell className="text-right">{formatPeso(row.penaltyApplied)}</TableCell>
                          <TableCell className="text-right">{formatPeso(row.interestApplied)}</TableCell>
                          <TableCell className="text-right">{formatPeso(row.principalApplied)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Fees</p>
                    <p className="text-sm font-semibold">{formatPeso(totals.fees)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Penalty</p>
                    <p className="text-sm font-semibold">{formatPeso(totals.penalty)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Interest</p>
                    <p className="text-sm font-semibold">{formatPeso(totals.interest)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="text-sm font-semibold">{formatPeso(totals.principal)}</p>
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

      <RecentActivityPanel label="Payment Recording" />

      <Dialog open={confirmOpen} onOpenChange={(open) => !paymentMutation.isPending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              Post {formatPeso(paymentAmount)} against {selectedLoan && selectedBorrower ? `${selectedBorrower.fullName} - ${selectedLoan.loanCode}` : 'this loan'}?
              This cannot be undone from this screen.
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
    </div>
  );
}
