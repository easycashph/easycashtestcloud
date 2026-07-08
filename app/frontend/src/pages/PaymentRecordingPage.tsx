import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ACTIVE_PAYMENT_METHODS, MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { previewCrossInstallmentAllocation, type InstallmentAllocationPreviewRow } from '@/lib/paymentAllocationPreview';
import { formatDate, formatPeso } from '@/lib/utils';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { Borrower, LoanAccount, PaginatedResponse, ProcessPaymentResponse, RepaymentInstallment } from '@/lib/loanApiTypes';

type AllocationMode = 'AUTOMATIC' | 'MANUAL';

const PAYABLE_STATUSES: LoanAccount['status'][] = ['ACTIVE', 'ACTIVE_IN_ARREARS'];

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Column sort here is DISPLAY-ONLY — it never changes which installments
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
 * itself is unchanged — `previewCrossInstallmentAllocation()` is a legitimate client-side preview
 * of the same fees→penalty→interest→principal rule the backend enforces authoritatively; only its
 * data source changed, from mock installments to real ones.
 *
 * Manual allocation mode has no backend equivalent (`ProcessPaymentUseCase` only ever runs the
 * automatic engine) — per design §6 point 2, it stays visible but disabled, not removed.
 */
export function PaymentRecordingPage() {
  useLogPageView('Payment Recording');
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('loanId');

  const loansQuery = useQuery({
    queryKey: ['loan-accounts', 'payable'],
    queryFn: async () => {
      const page = await apiClient.get<PaginatedResponse<LoanAccount>>('/loan-accounts?limit=200');
      return page.items.filter((l) => PAYABLE_STATUSES.includes(l.status));
    },
  });
  const payableLoans = loansQuery.data ?? [];

  const borrowerIds = React.useMemo(() => [...new Set((loansQuery.data ?? []).map((l) => l.borrowerId))], [loansQuery.data]);
  const borrowersQuery = useQuery({
    queryKey: ['borrowers', borrowerIds],
    queryFn: async () => {
      const entries = await Promise.all(
        borrowerIds.map(async (id) => [id, await apiClient.get<Borrower>(`/borrowers/${id}`)] as const),
      );
      return new Map(entries);
    },
    enabled: borrowerIds.length > 0,
  });
  const borrowerName = (borrowerId: string) => {
    const b = borrowersQuery.data?.get(borrowerId);
    return b ? `${b.firstName} ${b.lastName}` : 'Loading…';
  };

  const [loanId, setLoanId] = React.useState('');
  React.useEffect(() => {
    if (loanId || payableLoans.length === 0) return;
    setLoanId(preselected && payableLoans.some((l) => l.id === preselected) ? preselected : payableLoans[0]!.id);
    // Runs once payableLoans first becomes available — intentionally not re-running on every
    // payableLoans/preselected change, so a staff member's in-progress selection is never
    // silently overwritten by a background refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payableLoans.length]);

  const [loanSearch, setLoanSearch] = React.useState('');
  const [loanStatusFilter, setLoanStatusFilter] = React.useState<'ALL' | 'ACTIVE' | 'ACTIVE_IN_ARREARS'>('ALL');

  const searchedLoans = payableLoans.filter((l) => {
    const query = loanSearch.trim().toLowerCase();
    const matchesSearch = query.length === 0 || borrowerName(l.borrowerId).toLowerCase().includes(query) || l.loanCode.toLowerCase().includes(query);
    const matchesStatus = loanStatusFilter === 'ALL' || l.status === loanStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const selectedLoan = payableLoans.find((l) => l.id === loanId);
  const loanOptions =
    selectedLoan && !searchedLoans.some((l) => l.id === selectedLoan.id) ? [selectedLoan, ...searchedLoans] : searchedLoans;

  const [amount, setAmount] = React.useState('1000.00');
  const [allocationMode, setAllocationMode] = React.useState<AllocationMode>('AUTOMATIC');
  const [paymentMethod, setPaymentMethod] = React.useState(ACTIVE_PAYMENT_METHODS[0]!.code);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const idempotencyKeyRef = React.useRef<string | null>(null);

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

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
      return apiClient.post<ProcessPaymentResponse>(
        `/loan-accounts/${loanId}/payments`,
        { paymentAmount: amount },
        { 'Idempotency-Key': idempotencyKeyRef.current },
      );
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
          Live — posts a real payment against <code>app/backend</code>. Automatic allocation: fees → penalty → interest → principal,
          oldest installment first (ADR-009).
        </p>
      </div>

      {loansQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load loan accounts. Is the backend running?
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>Select a loan and enter an amount to preview allocation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="loan-search">Find loan account</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="loan-search"
                  placeholder="Search borrower or loan code..."
                  className="pl-8"
                  value={loanSearch}
                  onChange={(e) => setLoanSearch(e.target.value)}
                />
              </div>
              <Select
                value={loanStatusFilter}
                onValueChange={(v) => setLoanStatusFilter(v as 'ALL' | 'ACTIVE' | 'ACTIVE_IN_ARREARS')}
              >
                <SelectTrigger aria-label="Filter loan accounts by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All payable statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active only</SelectItem>
                  <SelectItem value="ACTIVE_IN_ARREARS">In Arrears only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loan-select">Loan account</Label>
              <Select value={loanId} onValueChange={setLoanId} disabled={loansQuery.isLoading || payableLoans.length === 0}>
                <SelectTrigger id="loan-select">
                  <SelectValue placeholder={loansQuery.isLoading ? 'Loading…' : 'Select a loan'} />
                </SelectTrigger>
                <SelectContent>
                  {loanOptions.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {borrowerName(l.borrowerId)} — {l.loanCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {loansQuery.isLoading
                  ? 'Loading loan accounts…'
                  : `${searchedLoans.length} of ${payableLoans.length} payable loan accounts match.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Payment amount</Label>
              <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Allocation</Label>
              <Tabs value={allocationMode} onValueChange={(v) => setAllocationMode(v as AllocationMode)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="AUTOMATIC">Automatic</TabsTrigger>
                  <TabsTrigger value="MANUAL" disabled>
                    Manual
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                {allocationMode === 'AUTOMATIC'
                  ? 'System splits the payment automatically (fees → penalty → interest → principal).'
                  : 'Not yet supported in live mode — automatic allocation only.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Mode of payment</Label>
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
              <p className="text-xs text-muted-foreground">Recorded for staff reference only — not yet a field on the backend loan account.</p>
            </div>

            {selectedLoan && (
              <div className="rounded-md border bg-secondary/40 p-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{borrowerName(selectedLoan.borrowerId)}</span> — {selectedLoan.loanCode}
                </p>
                <p className="mt-1">Collections balance: {formatPeso(parseAmount(selectedLoan.collectionsBalance))}</p>
                <p>Accounting balance: {formatPeso(parseAmount(selectedLoan.accountingBalance))}</p>
              </div>
            )}

            <Button className="w-full" disabled={!loanId || paymentAmount <= 0} onClick={openConfirm}>
              Submit Payment
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Allocation Preview</CardTitle>
              <CardDescription>Per-installment split for the entered amount</CardDescription>
            </div>
            <Badge variant="outline">Preview — final split is computed by the server on submit</Badge>
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

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Payment Recording')} title="Recent Activity — Payment Recording" />

      <Dialog open={confirmOpen} onOpenChange={(open) => !paymentMutation.isPending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              Post {formatPeso(paymentAmount)} against {selectedLoan ? `${borrowerName(selectedLoan.borrowerId)} — ${selectedLoan.loanCode}` : 'this loan'}?
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
