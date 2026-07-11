import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { useLogPageView } from '@/lib/activityLog';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useRole } from '@/lib/roleContext';
import { apiClient, ApiError, fetchAllPages } from '@/lib/apiClient';
import { previewLoanSchedule } from '@/lib/loanSchedulePreview';
import { formatDate, formatPeso } from '@/lib/utils';
import type { Borrower, LoanAccount, LoanProduct, LoanProductVersion, PaginatedResponse } from '@/lib/loanApiTypes';

/** Only `DECLINING_BALANCE`/`DECLINING_BALANCE_DISCOUNTED` versions — `ActivateLoanUseCase` rejects `FLAT` outright (`UnsupportedInterestCalculationMethodError`), so offering one here would let staff create a loan account that can never actually be activated. */
function activeSupportedVersion(product: LoanProduct): LoanProductVersion | undefined {
  return product.versions.find((v) => v.isActive && v.interestCalculationMethod !== 'FLAT');
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Default first repayment date: one month after today — a starting point only, always editable. */
function defaultFirstRepaymentDate(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Find Client -> Loan Terms -> Schedule Preview -> Create. Scoped to an EXISTING client only
 * (2026-07-11 user decision) — a renewal or any new loan account goes straight here without
 * needing its own reviewed/approved Loan Application first. A brand-new (not-yet-a-client)
 * borrower isn't supported by this first version; add them via Client Data, then come back here.
 *
 * Schedule computation itself is NOT done here — `previewLoanSchedule()` is a client-side preview
 * only (see its own doc comment). The real, authoritative schedule is generated server-side by
 * `AmortizationScheduleGenerator` at Activate time, once this loan account (created here in
 * PENDING_APPROVAL) has been approved.
 */
export function LoanAccountCreatePage() {
  useLogPageView('Create Loan Account');
  const navigate = useNavigate();
  const { currentAccount } = useRole();

  const [selectedBorrower, setSelectedBorrower] = React.useState<Borrower | null>(null);
  const [clientSearch, setClientSearch] = React.useState('');
  const debouncedClientSearch = useDebouncedValue(clientSearch);
  const clientSearchQuery = useQuery({
    queryKey: ['borrowers', 'search', debouncedClientSearch],
    queryFn: () => apiClient.get<PaginatedResponse<Borrower>>(`/borrowers?search=${encodeURIComponent(debouncedClientSearch)}&limit=10`),
    enabled: !selectedBorrower && debouncedClientSearch.trim().length > 0,
  });
  const clientResults = clientSearchQuery.data?.items ?? [];

  const clientLoansQuery = useQuery({
    queryKey: ['loan-accounts', 'by-borrower', selectedBorrower?.id],
    queryFn: () => apiClient.get<PaginatedResponse<LoanAccount>>(`/loan-accounts?borrowerId=${selectedBorrower!.id}&limit=50`),
    enabled: Boolean(selectedBorrower),
  });
  const clientLoans = clientLoansQuery.data?.items ?? [];
  const hasActiveLoan = clientLoans.some((l) => l.status === 'ACTIVE' || l.status === 'ACTIVE_IN_ARREARS');

  const changeClient = () => {
    setSelectedBorrower(null);
    setClientSearch('');
  };

  const productsQuery = useQuery({
    queryKey: ['loan-products', 'all'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
    enabled: Boolean(selectedBorrower),
  });
  const availableProducts = (productsQuery.data ?? []).filter((p) => activeSupportedVersion(p));

  const [loanProductId, setLoanProductId] = React.useState('');
  const selectedProduct = availableProducts.find((p) => p.id === loanProductId);
  const selectedVersion = selectedProduct ? activeSupportedVersion(selectedProduct) : undefined;

  const [principalAmount, setPrincipalAmount] = React.useState('');
  const [installmentCount, setInstallmentCount] = React.useState('');
  const [interestRate, setInterestRate] = React.useState('');
  const [firstRepaymentDate, setFirstRepaymentDate] = React.useState(defaultFirstRepaymentDate());

  // Fills in the product's configured defaults whenever a new product is selected — still freely
  // editable afterward, same "default then editable" pattern as Payment Recording's amount field.
  React.useEffect(() => {
    if (!selectedVersion) return;
    setPrincipalAmount(selectedVersion.loanAmountDefault ?? selectedVersion.loanAmountMin);
    setInstallmentCount(String(selectedVersion.installmentCountDefault ?? selectedVersion.installmentCountMin));
    setInterestRate(selectedVersion.defaultInterestRate ?? '');
  }, [selectedVersion]);

  const principalNum = Number.parseFloat(principalAmount) || 0;
  const installmentCountNum = Number.parseInt(installmentCount, 10) || 0;
  const interestRateNum = Number.parseFloat(interestRate) || 0;

  const principalOutOfRange =
    selectedVersion !== undefined &&
    (principalNum < Number.parseFloat(selectedVersion.loanAmountMin) ||
      (selectedVersion.loanAmountMax !== null && principalNum > Number.parseFloat(selectedVersion.loanAmountMax)));
  const installmentCountOutOfRange =
    selectedVersion !== undefined &&
    (installmentCountNum < selectedVersion.installmentCountMin ||
      (selectedVersion.installmentCountMax !== null && installmentCountNum > selectedVersion.installmentCountMax));
  const interestRateOutOfRange =
    selectedVersion !== undefined &&
    interestRateNum > 0 &&
    ((selectedVersion.minInterestRate !== null && interestRateNum < Number.parseFloat(selectedVersion.minInterestRate)) ||
      (selectedVersion.maxInterestRate !== null && interestRateNum > Number.parseFloat(selectedVersion.maxInterestRate)));

  const preview =
    principalNum > 0 && interestRateNum > 0 && installmentCountNum > 0 && firstRepaymentDate
      ? previewLoanSchedule(principalNum, interestRateNum, installmentCountNum, new Date(firstRepaymentDate))
      : null;

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanAccount>('/loan-accounts', {
        borrowerId: selectedBorrower!.id,
        loanProductVersionId: selectedVersion!.id,
        branchId: currentAccount.branchId,
        principalAmount: principalNum.toFixed(2),
        interestRate: interestRateNum.toFixed(3),
        installmentCount: installmentCountNum,
        firstRepaymentDate,
      }),
    onSuccess: (loan) => {
      navigate(`/loans/${loan.id}`);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Could not reach the server. Check your connection and try again.');
      }
    },
  });

  const openConfirm = () => {
    setSubmitError(null);
    setConfirmOpen(true);
  };

  const canSubmit =
    Boolean(selectedBorrower) &&
    Boolean(selectedVersion) &&
    principalNum > 0 &&
    !principalOutOfRange &&
    installmentCountNum > 0 &&
    !installmentCountOutOfRange &&
    interestRateNum > 0 &&
    !interestRateOutOfRange &&
    Boolean(firstRepaymentDate);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/loans')}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to Loan Accounts
      </Button>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">New Loan Account</h2>
        <p className="text-sm text-muted-foreground">
          Creates a PENDING_APPROVAL loan account for an existing client — approve and activate it afterward from the loan's own
          detail page.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          {!selectedBorrower ? (
            <>
              <CardHeader>
                <CardTitle>Find Client</CardTitle>
                <CardDescription>Search by name — this loan account will be linked to an existing client.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Search client name..."
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
                        onClick={() => setSelectedBorrower(b)}
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
                <p className="rounded-md border bg-secondary/40 p-2.5 text-xs text-muted-foreground">
                  New to the company (not a client yet)? Add them under Client Data first, then come back here.
                </p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedBorrower.fullName}</CardTitle>
                    <CardDescription>Loan cycle: {selectedBorrower.loanCycle}</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={changeClient}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Change
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border bg-secondary/40 p-3 text-xs text-muted-foreground">
                  {clientLoansQuery.isLoading ? (
                    'Loading loan history…'
                  ) : clientLoans.length === 0 ? (
                    'No previous loan accounts on file.'
                  ) : (
                    <>
                      <p className="mb-1 font-medium text-foreground">Existing loan accounts ({clientLoans.length}):</p>
                      <ul className="space-y-0.5">
                        {clientLoans.map((l) => (
                          <li key={l.id} className="flex items-center justify-between">
                            <span>{l.loanCode}</span>
                            <Badge variant="outline">{l.status}</Badge>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {hasActiveLoan && (
                  <p className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                    This client already has an active (or in-arrears) loan account — for your awareness only, this does not block
                    creating another one.
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="product">Product</Label>
                  <Select value={loanProductId} onValueChange={setLoanProductId} disabled={productsQuery.isLoading}>
                    <SelectTrigger id="product">
                      <SelectValue placeholder={productsQuery.isLoading ? 'Loading…' : 'Select a product...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedVersion && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="principal">Principal Amount</Label>
                      <Input
                        id="principal"
                        type="number"
                        min="0"
                        step="0.01"
                        value={principalAmount}
                        onChange={(e) => setPrincipalAmount(e.target.value)}
                      />
                      <p className={`text-xs ${principalOutOfRange ? 'text-destructive' : 'text-muted-foreground'}`}>
                        Range: {formatPeso(Number.parseFloat(selectedVersion.loanAmountMin))}
                        {selectedVersion.loanAmountMax ? ` – ${formatPeso(Number.parseFloat(selectedVersion.loanAmountMax))}` : '+'}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="term">Term (months)</Label>
                      <Input id="term" type="number" min="1" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
                      <p className={`text-xs ${installmentCountOutOfRange ? 'text-destructive' : 'text-muted-foreground'}`}>
                        Range: {selectedVersion.installmentCountMin}
                        {selectedVersion.installmentCountMax ? `–${selectedVersion.installmentCountMax}` : '+'} months
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="rate">Contractual Rate (% monthly)</Label>
                      <Input id="rate" type="number" min="0" step="0.001" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                      {(selectedVersion.minInterestRate || selectedVersion.maxInterestRate) && (
                        <p className={`text-xs ${interestRateOutOfRange ? 'text-destructive' : 'text-muted-foreground'}`}>
                          Range: {selectedVersion.minInterestRate ?? '0'}%{selectedVersion.maxInterestRate ? `–${selectedVersion.maxInterestRate}%` : '+'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="first-repayment">First Repayment Date</Label>
                      <Input
                        id="first-repayment"
                        type="date"
                        min={todayIsoDate()}
                        value={firstRepaymentDate}
                        onChange={(e) => setFirstRepaymentDate(e.target.value)}
                      />
                    </div>

                    <Button className="w-full" disabled={!canSubmit} onClick={openConfirm}>
                      Create Loan Account
                    </Button>
                  </>
                )}

                {productsQuery.data && availableProducts.length === 0 && (
                  <p className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                    No products are currently available for origination — every product either has no Active version, or its Active
                    version uses the Flat interest method (not yet supported for activation).
                  </p>
                )}
              </CardContent>
            </>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Schedule Preview</CardTitle>
              <CardDescription>Per-installment breakdown for the terms entered</CardDescription>
            </div>
            <Badge variant="outline">Preview — final schedule is generated by the server at Activate</Badge>
          </CardHeader>
          <CardContent>
            {!preview ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {selectedBorrower ? 'Enter loan terms to see the schedule.' : 'Select a client to get started.'}
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm">
                  Monthly Payment: <span className="font-semibold">{formatPeso(preview.monthlyPayment)}</span>
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
                    {preview.schedule.map((entry) => (
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !createMutation.isPending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Loan Account Creation</DialogTitle>
            <DialogDescription>
              Create a {selectedProduct?.name} loan account for {selectedBorrower?.fullName} — {formatPeso(principalNum)} over{' '}
              {installmentCountNum} months at {interestRateNum}% monthly? This creates the account in Pending Approval; it will need to
              be approved and activated separately.
            </DialogDescription>
          </DialogHeader>
          {submitError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Yes, create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
