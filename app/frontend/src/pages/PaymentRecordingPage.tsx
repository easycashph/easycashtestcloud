import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComingSoonButton } from '@/components/ComingSoonButton';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { ACTIVE_PAYMENT_METHODS, MOCK_ACTIVITY_LOGS, MOCK_INSTALLMENTS, MOCK_LOANS } from '@/lib/mockData';
import { previewCrossInstallmentAllocation } from '@/lib/paymentAllocationPreview';
import { formatDate, formatPeso } from '@/lib/utils';

type AllocationMode = 'AUTOMATIC' | 'MANUAL';

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

const PAYABLE_LOANS = MOCK_LOANS.filter((l) => l.status === 'ACTIVE' || l.status === 'ACTIVE_IN_ARREARS');

export function PaymentRecordingPage() {
  useLogPageView('Payment Recording');
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('loanId');
  const [loanId, setLoanId] = React.useState(preselected && PAYABLE_LOANS.some((l) => l.id === preselected) ? preselected : PAYABLE_LOANS[0]?.id ?? '');
  const [amount, setAmount] = React.useState('1000.00');
  const [allocationMode, setAllocationMode] = React.useState<AllocationMode>('AUTOMATIC');
  const [manualPrincipal, setManualPrincipal] = React.useState('0.00');
  const [manualInterest, setManualInterest] = React.useState('0.00');
  const [manualPenalty, setManualPenalty] = React.useState('0.00');
  const [manualFees, setManualFees] = React.useState('0.00');

  const loan = PAYABLE_LOANS.find((l) => l.id === loanId);
  const [paymentMethod, setPaymentMethod] = React.useState(loan?.paymentMethod ?? ACTIVE_PAYMENT_METHODS[0]!.code);

  React.useEffect(() => {
    if (loan) setPaymentMethod(loan.paymentMethod);
  }, [loan]);
  const unpaidInstallments = (MOCK_INSTALLMENTS[loanId] ?? [])
    .filter((i) => i.status !== 'PAID')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const paymentAmount = Number.parseFloat(amount) || 0;
  const preview = previewCrossInstallmentAllocation(
    paymentAmount,
    unpaidInstallments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      remainingDue: {
        feesDue: Math.max(0, i.due.fees - i.paid.fees),
        penaltyDue: Math.max(0, i.due.penalty - i.paid.penalty),
        interestDue: Math.max(0, i.due.interest - i.paid.interest),
        principalDue: Math.max(0, i.due.principal - i.paid.principal),
      },
    })),
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

  // Manual allocation (mock only): the staff types in exactly how much of
  // the payment goes to each component, instead of the automatic
  // fees -> penalty -> interest -> principal engine deciding.
  const manualTotals = {
    principal: parseAmount(manualPrincipal),
    interest: parseAmount(manualInterest),
    penalty: parseAmount(manualPenalty),
    fees: parseAmount(manualFees),
  };
  const manualSum = manualTotals.principal + manualTotals.interest + manualTotals.penalty + manualTotals.fees;
  const manualRemainder = Math.round((paymentAmount - manualSum) * 100) / 100;
  const manualMismatch = Math.abs(manualRemainder) > 0.004;

  function prefillManualFromAutomatic() {
    setManualPrincipal(totals.principal.toFixed(2));
    setManualInterest(totals.interest.toFixed(2));
    setManualPenalty(totals.penalty.toFixed(2));
    setManualFees(totals.fees.toFixed(2));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Payment Recording</h2>
        <p className="text-sm text-muted-foreground">
          Allocation preview only — Automatic mode: fees → penalty → interest → principal, oldest installment first (ADR-009). Manual
          mode lets staff type in the exact split. No payment is actually posted from this screen yet.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
            <CardDescription>Select a loan and enter an amount to preview allocation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="loan-select">Loan account</Label>
              <Select value={loanId} onValueChange={setLoanId}>
                <SelectTrigger id="loan-select">
                  <SelectValue placeholder="Select a loan" />
                </SelectTrigger>
                <SelectContent>
                  {PAYABLE_LOANS.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.borrowerName} — {l.loanCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <TabsTrigger value="MANUAL">Manual</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                {allocationMode === 'AUTOMATIC'
                  ? 'System splits the payment automatically (fees → penalty → interest → principal).'
                  : 'Staff manually enters how much of the payment applies to each component.'}
              </p>
            </div>

            {allocationMode === 'MANUAL' && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Manual split</p>
                  <button
                    type="button"
                    onClick={prefillManualFromAutomatic}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Copy automatic split
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="manual-principal" className="text-xs">
                      Principal
                    </Label>
                    <Input
                      id="manual-principal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualPrincipal}
                      onChange={(e) => setManualPrincipal(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manual-interest" className="text-xs">
                      Interest
                    </Label>
                    <Input
                      id="manual-interest"
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualInterest}
                      onChange={(e) => setManualInterest(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manual-penalty" className="text-xs">
                      Penalty
                    </Label>
                    <Input
                      id="manual-penalty"
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualPenalty}
                      onChange={(e) => setManualPenalty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manual-fees" className="text-xs">
                      Fees
                    </Label>
                    <Input id="manual-fees" type="number" min="0" step="0.01" value={manualFees} onChange={(e) => setManualFees(e.target.value)} />
                  </div>
                </div>

                <div
                  className={`rounded-md border px-2 py-1.5 text-xs ${
                    manualMismatch ? 'border-warning/40 bg-warning/10 text-warning-foreground' : 'border-border bg-secondary/40 text-muted-foreground'
                  }`}
                >
                  {manualMismatch ? (
                    <>
                      Manual split ({formatPeso(manualSum)}) does not equal the payment amount ({formatPeso(paymentAmount)}) — difference of{' '}
                      {formatPeso(Math.abs(manualRemainder))} {manualRemainder > 0 ? 'unallocated' : 'over-allocated'}.
                    </>
                  ) : (
                    <>Manual split matches the payment amount exactly.</>
                  )}
                </div>
              </div>
            )}

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
              {paymentMethod === 'AUTO_DEBIT' && (
                <p className="rounded-md border bg-secondary/40 px-2 py-1.5 text-xs text-muted-foreground">
                  ATM Card on File — client consent-based; Easycash debits the account directly.
                </p>
              )}
              {paymentMethod === 'CASH' && loan?.collectionAgentName && (
                <p className="rounded-md border bg-secondary/40 px-2 py-1.5 text-xs text-muted-foreground">
                  Assigned Collection Agent (door-to-door): <span className="font-medium text-foreground">{loan.collectionAgentName}</span>
                </p>
              )}
            </div>

            {loan && (
              <div className="rounded-md border bg-secondary/40 p-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{loan.borrowerName}</span> — {loan.productType}
                </p>
                <p className="mt-1">Collections balance: {formatPeso(loan.collectionsBalance)}</p>
                <p>Accounting balance: {formatPeso(loan.accountingBalance)}</p>
              </div>
            )}

            <ComingSoonButton className="w-full">Submit Payment</ComingSoonButton>
            <p className="text-xs text-muted-foreground">
              Payment posting requires CP13 (HTTP exposure), not yet built. This form only demonstrates the allocation preview —
              Automatic (ADR-009 engine) or Manual (staff-entered split).
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Allocation Preview</CardTitle>
              <CardDescription>
                {allocationMode === 'AUTOMATIC' ? 'Per-installment split for the entered amount' : 'Manually entered component split'}
              </CardDescription>
            </div>
            <Badge variant="outline">Simulated client-side — not the real engine</Badge>
          </CardHeader>
          <CardContent>
            {allocationMode === 'MANUAL' ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Fees</p>
                    <p className="text-sm font-semibold">{formatPeso(manualTotals.fees)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Penalty</p>
                    <p className="text-sm font-semibold">{formatPeso(manualTotals.penalty)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Interest</p>
                    <p className="text-sm font-semibold">{formatPeso(manualTotals.interest)}</p>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="text-sm font-semibold">{formatPeso(manualTotals.principal)}</p>
                  </div>
                  <div
                    className={`rounded-md border p-2 text-center ${manualMismatch ? 'border-warning/40 bg-warning/10' : ''}`}
                  >
                    <p className="text-xs text-muted-foreground">Unallocated</p>
                    <p className="text-sm font-semibold">{formatPeso(manualRemainder)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Manual entry — the staff-typed split above, not the automatic fees → penalty → interest → principal engine (ADR-009).
                  This does not apply against specific installments in this preview; the real posting logic (once CP13 is wired to this
                  screen) would still need to decide which installment(s) each manually-entered component is applied to.
                </p>
              </>
            ) : unpaidInstallments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No unpaid installments for this loan.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                      <TableHead className="text-right">Penalty</TableHead>
                      <TableHead className="text-right">Interest</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                          Enter a payment amount above ₱0.00 to see the allocation.
                        </TableCell>
                      </TableRow>
                    ) : (
                      preview.rows.map((row) => {
                        const installment = unpaidInstallments.find((i) => i.id === row.installmentId)!;
                        return (
                          <TableRow key={row.installmentId}>
                            <TableCell>{row.installmentNumber}</TableCell>
                            <TableCell>{formatDate(installment.dueDate)}</TableCell>
                            <TableCell className="text-right">{formatPeso(row.feesApplied)}</TableCell>
                            <TableCell className="text-right">{formatPeso(row.penaltyApplied)}</TableCell>
                            <TableCell className="text-right">{formatPeso(row.interestApplied)}</TableCell>
                            <TableCell className="text-right">{formatPeso(row.principalApplied)}</TableCell>
                          </TableRow>
                        );
                      })
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
                {preview.remainder > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Remainder after exhausting all unpaid installments shown — overpayment disposition is still{' '}
                    <span className="font-medium">STATUS: UNRESOLVED</span> per CALCULATION_ENGINE_SPEC.md §11, not invented here.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Payment Recording')} title="Recent Activity — Payment Recording" />
    </div>
  );
}
