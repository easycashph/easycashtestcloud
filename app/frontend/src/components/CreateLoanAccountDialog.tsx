import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  ACTIVE_PAYMENT_METHODS,
  ADD_ON_RATE_TIERS,
  computeLoanOriginationSummary,
  DEFAULT_FEE_WAIVERS,
  MOCK_LOAN_PRODUCTS,
  type LoanFeeWaivers,
  type MockLoanAccount,
} from '@/lib/mockData';
import { formatPeso } from '@/lib/utils';

export const ACTIVE_PRODUCTS_FOR_NEW_LOAN = MOCK_LOAN_PRODUCTS.filter((p) => p.isActive);

export interface CreateLoanAccountParams {
  productCode: string;
  principalAmount: number;
  installmentCount: number;
  interestRate: number;
  coBorrowerName: string;
  anticipatedDisbursementDate: string;
  paymentMethod: string;
  disbursementBank?: MockLoanAccount['disbursementBank'];
}

/** Matches `Loans_details`'s Bank Name/ATM Card Number/Bank Account Number/Name on Card fields - only collected for bank-based payment methods. */
const BANK_BASED_PAYMENT_METHODS = new Set(['BANK_TRANSFER', 'AUTO_DEBIT']);

const FEE_WAIVER_LABELS: { key: keyof LoanFeeWaivers; label: string }[] = [
  { key: 'accountManagementFee', label: 'Account Management Fee (1% of principal)' },
  { key: 'processingFee', label: "Processing Fee (product's rate)" },
  { key: 'digitalSignatureFee', label: 'Digital Signature Fee (₱500)' },
  { key: 'notarialFee', label: 'Notarial Fee (₱500)' },
  { key: 'insuranceFee', label: 'Insurance Fee' },
  { key: 'advanceInterestFee', label: 'Advance Interest Fee (if disbursed >30 days before first repayment)' },
  { key: 'documentaryStampTax', label: 'Documentary Stamp Tax (₱150) - waived by default' },
];

/** Seconds the final confirm button stays disabled - a deliberate speed bump against an accidental double-click on a financial commitment. */
const CONFIRM_HOLD_SECONDS = 3;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Matches `createLoanAccountForClient`'s own `firstRepaymentDate` derivation - one month after disbursement. */
function addOneMonthIso(isoDate: string): string {
  const d = new Date(isoDate);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Fields and layout follow the real official calculator
 * (`legacy/reports/201 Loan Docs Generator/201 Loan Docs Encode.xlsx`, `Fill up form` /
 * `manual input for LOAN AMOUNT` sheets): Principal Amount, Term, Add-On Rate (looked up against
 * the `Interest Rate Chart` sheet for the Contractual Rate), Anticipated Disbursement Date,
 * Co-Borrower, Outstanding Balance from a previous loan (renewals) - plus each fee's own Waive
 * toggle (the real form's column `H`: typing `"NO"` zeroes that fee out) and a live Computation
 * Summary (Monthly Amortization, Obligation, Net Proceeds, EIR Monthly/Annual) using
 * `computeLoanOriginationSummary()`.
 *
 * Shared between `ClientProfilePage` (no prefill) and `LoanApplicationDetailPage` (prefilled from
 * the source application's requested product/amount/term) - one form, one set of formulas, no
 * duplicated fee logic between the two entry points.
 */
export function CreateLoanAccountDialog({
  open,
  onOpenChange,
  onCreate,
  initialValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (params: CreateLoanAccountParams) => void;
  /** Prefills the form - e.g. from an approved application's requested product/amount/term. */
  initialValues?: { productCode?: string; principalAmount?: number; installmentCount?: number };
}) {
  const [productCode, setProductCode] = React.useState(initialValues?.productCode ?? '');
  const [principalAmount, setPrincipalAmount] = React.useState(initialValues?.principalAmount ?? 50000);
  const [installmentCount, setInstallmentCount] = React.useState(initialValues?.installmentCount ?? 12);
  const [addOnRatePercent, setAddOnRatePercent] = React.useState<number>(ADD_ON_RATE_TIERS[0] ?? 2);
  const [coBorrowerName, setCoBorrowerName] = React.useState('');
  const [disbursementDate, setDisbursementDate] = React.useState(todayIsoDate());
  const [previousLoanOutstandingBalance, setPreviousLoanOutstandingBalance] = React.useState(0);
  const [waive, setWaive] = React.useState<LoanFeeWaivers>(DEFAULT_FEE_WAIVERS);
  const [paymentMethod, setPaymentMethod] = React.useState('GCASH');
  const [bankName, setBankName] = React.useState('');
  const [atmCardNumber, setAtmCardNumber] = React.useState('');
  const [bankAccountNumber, setBankAccountNumber] = React.useState('');
  const [nameOnCardOrAccount, setNameOnCardOrAccount] = React.useState('');
  const [confirming, setConfirming] = React.useState(false);
  const [confirmHoldRemaining, setConfirmHoldRemaining] = React.useState(CONFIRM_HOLD_SECONDS);

  const product = ACTIVE_PRODUCTS_FOR_NEW_LOAN.find((p) => p.productCode === productCode);
  const firstRepaymentDate = addOneMonthIso(disbursementDate);
  const needsBankDetails = BANK_BASED_PAYMENT_METHODS.has(paymentMethod);

  const summary =
    product && principalAmount > 0 && installmentCount > 0
      ? computeLoanOriginationSummary({
          principal: principalAmount,
          addOnRatePercent,
          termMonths: installmentCount,
          productFeeRules: product.feeRules,
          disbursementDate,
          firstRepaymentDate,
          previousLoanOutstandingBalance,
          waive,
        })
      : null;

  const toggleWaive = (key: keyof LoanFeeWaivers) => setWaive((prev) => ({ ...prev, [key]: !prev[key] }));

  const reset = () => {
    setProductCode(initialValues?.productCode ?? '');
    setPrincipalAmount(initialValues?.principalAmount ?? 50000);
    setInstallmentCount(initialValues?.installmentCount ?? 12);
    setAddOnRatePercent(ADD_ON_RATE_TIERS[0] ?? 2);
    setCoBorrowerName('');
    setDisbursementDate(todayIsoDate());
    setPreviousLoanOutstandingBalance(0);
    setWaive(DEFAULT_FEE_WAIVERS);
    setPaymentMethod('GCASH');
    setBankName('');
    setAtmCardNumber('');
    setBankAccountNumber('');
    setNameOnCardOrAccount('');
  };

  // The 3-second hold counts down only while the safety-net confirm dialog is open, resetting
  // every time it's reopened - so a hasty officer can't pre-empt it by opening/closing repeatedly.
  React.useEffect(() => {
    if (!confirming) {
      setConfirmHoldRemaining(CONFIRM_HOLD_SECONDS);
      return;
    }
    if (confirmHoldRemaining <= 0) return;
    const timer = setTimeout(() => setConfirmHoldRemaining((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [confirming, confirmHoldRemaining]);

  return (
    <>
      <Dialog
        open={open && !confirming}
        onOpenChange={(o) => {
          onOpenChange(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Loan Account</DialogTitle>
            <DialogDescription>Preview only - creates a PENDING_APPROVAL loan account for this client.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Product Sub-type</Label>
              <Select value={productCode} onValueChange={setProductCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVE_PRODUCTS_FOR_NEW_LOAN.map((p) => (
                    <SelectItem key={p.id} value={p.productCode}>
                      {p.productName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Principal Amount</Label>
              <Input type="number" value={principalAmount} onChange={(e) => setPrincipalAmount(Number(e.target.value))} />
              {product && (
                <p className="text-xs text-muted-foreground">
                  Range: {formatPeso(product.loanAmountMin)} – {formatPeso(product.loanAmountMax)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Term (installments, months)</Label>
              <Input type="number" value={installmentCount} onChange={(e) => setInstallmentCount(Number(e.target.value))} />
              {product && (
                <p className="text-xs text-muted-foreground">
                  Range: {product.installmentCountMin}–{product.installmentCountMax} mos
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Add-On Rate (% monthly)</Label>
              <Select value={String(addOnRatePercent)} onValueChange={(v) => setAddOnRatePercent(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADD_ON_RATE_TIERS.map((tier) => (
                    <SelectItem key={tier} value={String(tier)}>
                      {tier}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {summary?.contractualRateFromChart
                  ? `Contractual Rate (Interest Rate Chart): ${summary.contractualRatePercent}%`
                  : 'No Interest Rate Chart entry for this term/rate - Contractual Rate not on file, please confirm with MIS.'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Anticipated Disbursement Date</Label>
              <Input type="date" value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Co-Borrower Name (optional)</Label>
              <Input value={coBorrowerName} onChange={(e) => setCoBorrowerName(e.target.value)} placeholder="e.g. Juan Dela Cruz" />
            </div>
            <div className="space-y-1.5">
              <Label>Outstanding Balance from Previous Loan (renewal)</Label>
              <Input
                type="number"
                value={previousLoanOutstandingBalance}
                onChange={(e) => setPreviousLoanOutstandingBalance(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Leave at 0 for a brand-new loan - paid off from this loan's proceeds otherwise.</p>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Waive Fees</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {FEE_WAIVER_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <Switch checked={waive[key]} onCheckedChange={() => toggleWaive(key)} />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disbursement</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
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
              </div>
              {needsBankDetails && (
                <>
                  <div className="space-y-1.5">
                    <Label>Bank Name</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. BDO Unibank" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bank Account Number</Label>
                    <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>ATM Card Number</Label>
                    <Input value={atmCardNumber} onChange={(e) => setAtmCardNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Name on Card/Account</Label>
                    <Input value={nameOnCardOrAccount} onChange={(e) => setNameOnCardOrAccount(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>

          {summary && (
            <div className="rounded-md border bg-secondary/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Computation Summary</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Monthly Amortization</dt>
                  <dd className="font-semibold">{formatPeso(summary.monthlyPayment)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Obligation</dt>
                  <dd className="font-semibold">{formatPeso(summary.obligation)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Net Proceeds</dt>
                  <dd className="font-semibold text-success">{formatPeso(summary.netProceeds)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">EIR Monthly</dt>
                  <dd className="font-semibold">{summary.addOnMonthlyRatePercent}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">EIR Annual</dt>
                  <dd className="font-semibold">{summary.addOnAnnualRatePercent}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total Deduction</dt>
                  <dd className="font-semibold">{formatPeso(summary.totalDeduction)}</dd>
                </div>
              </dl>
              <ul className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
                <li className="flex justify-between">
                  <span>Account Management Fee{waive.accountManagementFee && ' (waived)'}</span>
                  <span>{formatPeso(summary.fees.accountManagementFee)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Processing Fee{waive.processingFee && ' (waived)'}</span>
                  <span>{formatPeso(summary.fees.processingFee)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Digital Signature Fee{waive.digitalSignatureFee && ' (waived)'}</span>
                  <span>{formatPeso(summary.fees.digitalSignatureFee)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Notarial Fee{waive.notarialFee && ' (waived)'}</span>
                  <span>{formatPeso(summary.fees.notarialFee)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Insurance Fee{waive.insuranceFee && ' (waived)'}</span>
                  <span>{formatPeso(summary.fees.insuranceFee)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Advance Interest Fee{waive.advanceInterestFee && ' (waived)'}</span>
                  <span>{formatPeso(summary.fees.advanceInterestFee)}</span>
                </li>
                {summary.otherProductFees.map((fee) => (
                  <li key={fee.name} className="flex justify-between">
                    <span>
                      {fee.name}
                      {fee.name === 'Documentary Stamp Tax' && waive.documentaryStampTax && ' (waived)'}
                    </span>
                    <span>{formatPeso(fee.amount)}</span>
                  </li>
                ))}
                {summary.previousLoanOutstandingBalance > 0 && (
                  <li className="flex justify-between font-medium text-foreground">
                    <span>Outstanding Balance from Previous Loan</span>
                    <span>{formatPeso(summary.previousLoanOutstandingBalance)}</span>
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Net Proceeds = Principal − (all fees + previous balance, if any), matching the official calculator's{' '}
                <code>Loans_details</code> field set. A waived fee is zeroed out entirely, never redistributed elsewhere.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!product} onClick={() => setConfirming(true)}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Confirm loan account creation
            </DialogTitle>
            <DialogDescription>
              Create a {product?.productName} loan account for {formatPeso(principalAmount)} over {installmentCount} months at{' '}
              {summary?.contractualRatePercent}% monthly (Contractual)? This is a safety-net confirmation to prevent an accidental
              click.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              disabled={confirmHoldRemaining > 0}
              onClick={() => {
                onCreate({
                  productCode,
                  principalAmount,
                  installmentCount,
                  interestRate: summary?.contractualRatePercent ?? 0,
                  coBorrowerName,
                  anticipatedDisbursementDate: disbursementDate,
                  paymentMethod,
                  disbursementBank: needsBankDetails ? { bankName, atmCardNumber, bankAccountNumber, nameOnCardOrAccount } : undefined,
                });
                setConfirming(false);
                onOpenChange(false);
                reset();
              }}
            >
              {confirmHoldRemaining > 0 ? `Yes, create (${confirmHoldRemaining})` : 'Yes, create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
