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
import { classifyProductType, groupByProductType } from '@/lib/productTypeClassification';
import { formatDate, formatPeso } from '@/lib/utils';
import type { Borrower, InterestRateChartEntry, LoanAccount, LoanProduct, LoanProductVersion, PaginatedResponse } from '@/lib/loanApiTypes';

/** Only `DECLINING_BALANCE`/`DECLINING_BALANCE_DISCOUNTED` versions — `ActivateLoanUseCase` rejects `FLAT` outright (`UnsupportedInterestCalculationMethodError`), so offering one here would let staff create a loan account that can never actually be activated. */
function activeSupportedVersion(product: LoanProduct): LoanProductVersion | undefined {
  return product.versions.find((v) => v.isActive && v.interestCalculationMethod !== 'FLAT');
}

/** Any active version regardless of interest method - used only to decide whether a Flat-rate
 * product (active on the Loan Products catalog, e.g. "BL-Special") should still be LISTED here
 * (2026-07-14 user decision: show it, disabled, rather than silently omit it - staff were
 * confused seeing fewer Product Classes here than on the catalog page for the same Product
 * Type). `activeSupportedVersion` above still governs what's actually selectable/usable. */
function anyActiveVersion(product: LoanProduct): LoanProductVersion | undefined {
  return product.versions.find((v) => v.isActive);
}

/**
 * Products confirmed (2026-07-11, direct DB query against `loan_accounts`/`loan_applications`/
 * `document_template_mappings`) to have ZERO real usage anywhere — never used to originate a real
 * loan, never referenced by a loan application, no document template linked. Hidden from this
 * dropdown only, purely to declutter it (user request) — deliberately NOT deleted or deactivated
 * at the data layer (no `LoanProductVersion.isActive` change, no DB write), so this is trivially
 * reversible by removing an entry here, and every other page (Loan Products, reports, etc.) still
 * sees these products exactly as before. `CM-Car`'s `name` was separately fixed at the data layer
 * (2026-07-11) — the legacy source record had it corrupted to the literal string
 * "addOnRates:[1.75"; see `scripts/migrate-legacy-data.ts`'s `KNOWN_CORRUPTED_PRODUCT_NAMES` for
 * the full story and the recovered real name ("Chattel Mortgage - Car").
 */
const HIDDEN_PRODUCT_CODES = new Set([
  'SL-Snap-A',
  'SL-Snap-B',
  'SML-Kab',
  'TEST-PROD',
  'SL-OL_NEW',
  'PL-S',
  'SML-OTH',
  'CL-REG',
  'CL-SPEC',
  'CM-Car',
]);

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
 * Insurance Fee — sourced directly from MIS Nomer's Excel LMS's `CalculateInsurance()` VBA macro
 * (legacy/reports/BETA 1.5.83 LMSv3.xlsm), transcribed verbatim, not re-derived: `Total Contract =
 * MonthlyAmortization × Term`; `Insurance = (TotalContract / 1000) × Term`; `+20` when
 * `TotalContract < 50000`; round UP to the nearest whole peso. Verified exact against 4 real
 * loans (SML-REG_00365=260, SML-REG_00364=661, SL-REG_00109=315, SML-REG_00350=120) before being
 * trusted here. The macro's own "Waive Insurance" checkbox isn't reproduced as a separate control
 * — staff can already zero this field out manually, same as every other fee in this form.
 */
function computeInsuranceFee(monthlyAmortization: number, termMonths: number): number {
  const totalContract = monthlyAmortization * termMonths;
  let insurance = (totalContract / 1000) * termMonths;
  if (totalContract < 50000) insurance += 20;
  return Math.ceil(insurance);
}

/**
 * Advance Interest Fee — `docs/Architecture/ADR-046-advance-interest-fee-extended-first-repayment-gap.md`
 * (ACCEPTED, 62.6% exact match / 74.6% within 5% against 449 real loans, 2021 encoding-anomaly
 * cohort excluded). Rate basis is Add-On Rate, NOT Contractual Rate (confirmed two ways in the
 * ADR: population-wide formula-fit testing and direct MIS Assistant testimony). Rounding is
 * ceiling to the nearest whole peso — deliberately NOT this project's usual 2-decimal rounding,
 * per the ADR's own §3.4/§4.
 *
 * ADR-046 §4 also found eligibility is per-product ("some products almost always charge it...
 * others almost never do") and flags "which LoanProductVersions should charge this" as
 * UNRESOLVED, requiring a business decision not yet made. This function does NOT enforce any
 * per-product eligibility — it always returns the formula's result when the >30-day gap exists,
 * exactly like Insurance Fee: a well-evidenced starting suggestion, not an auto-applied rule.
 * Staff decide per loan whether it applies and can zero it out, same as every other fee here.
 */
function computeAdvanceInterestFee(principal: number, addOnRatePercent: number, disbursementDate: Date, firstRepaymentDate: Date): number {
  const gapDays = Math.round((firstRepaymentDate.getTime() - disbursementDate.getTime()) / 86_400_000);
  if (gapDays <= 30) return 0;
  const excessDays = gapDays - 30;
  return Math.ceil(principal * (addOnRatePercent / 100) * (excessDays / 30));
}

/** Everything `computeNetProceedsForPrincipal` needs besides the principal guess itself — one
 * field per fee-affecting input already live in the form. */
interface FeeComputationContext {
  installmentCountNum: number;
  interestRateNum: number;
  addOnRateNum: number;
  disbursementDateObj: Date | null;
  firstRepaymentDateObj: Date | null;
  processingFeePercentNum: number;
  accountManagementFeePercentNum: number;
  outstandingBalancePayoffNum: number;
  docStampFeeNum: number;
  otherFeesNum: number;
  notarialFeeNum: number;
  webFeeNum: number;
}

/** Re-derives Net Proceeds for a given candidate principal, using the exact same formulas as the
 * live form (percent-based Processing/Account Management Fee, computeAdvanceInterestFee,
 * computeInsuranceFee via the same PMT the schedule preview uses) — kept as a pure function so
 * `solveGrossForDesiredNet` below can call it repeatedly without duplicating fee logic. */
function computeNetProceedsForPrincipal(principal: number, ctx: FeeComputationContext): number {
  // Rounded to centavos here, matching the .toFixed(2) the real form applies to these two fields
  // before summing — solving against the unrounded fraction instead left the solver converging on
  // a principal that was off by a centavo once the real (rounded) fee fields were summed.
  const processingFee = Number((((principal * ctx.processingFeePercentNum) / 100)).toFixed(2));
  const accountManagementFee = Number((((principal * ctx.accountManagementFeePercentNum) / 100)).toFixed(2));
  const advanceInterestFee =
    ctx.addOnRateNum > 0 && ctx.disbursementDateObj && ctx.firstRepaymentDateObj
      ? computeAdvanceInterestFee(principal, ctx.addOnRateNum, ctx.disbursementDateObj, ctx.firstRepaymentDateObj)
      : 0;
  const scheduleForGuess =
    ctx.interestRateNum > 0 && ctx.installmentCountNum > 0 && ctx.firstRepaymentDateObj
      ? previewLoanSchedule(principal, ctx.interestRateNum, ctx.installmentCountNum, ctx.firstRepaymentDateObj)
      : null;
  const insuranceFee = scheduleForGuess ? computeInsuranceFee(scheduleForGuess.monthlyPayment, ctx.installmentCountNum) : 0;

  const totalFees =
    processingFee +
    advanceInterestFee +
    ctx.outstandingBalancePayoffNum +
    ctx.docStampFeeNum +
    accountManagementFee +
    ctx.otherFeesNum +
    ctx.notarialFeeNum +
    ctx.webFeeNum +
    insuranceFee;

  return principal - totalFees;
}

/**
 * Reverse-solves the Gross/Principal Amount that nets to `desiredNet` after all fees — the same
 * goal-seek idea as the legacy Excel's own "Net Amount Auto Computation" workbook (`AutoV2`'s
 * F/G/H columns: guess Gross, measure the resulting Net, nudge Gross by the shortfall, repeat).
 * Converges fast because every fee here is at most a percentage of principal, so
 * `computeNetProceedsForPrincipal`'s slope w.r.t. principal stays comfortably below 1 — 12
 * iterations clears sub-centavo precision even at unusually high combined fee percentages.
 */
function solveGrossForDesiredNet(desiredNet: number, ctx: FeeComputationContext): number {
  let guess = desiredNet;
  for (let i = 0; i < 12; i++) {
    const net = computeNetProceedsForPrincipal(guess, ctx);
    const shortfall = desiredNet - net;
    if (Math.abs(shortfall) < 0.005) break;
    guess += shortfall;
  }
  return Math.round(guess * 100) / 100;
}

export function LoanAccountCreatePage() {
  const navigate = useNavigate();
  return (
    <LoanAccountForm
      onCreated={(loan) => navigate(`/loans/${loan.id}`)}
      onCancel={() => navigate('/loans')}
    />
  );
}

/**
 * Find Client -> Loan Terms -> Schedule Preview -> Create. Extracted (2026-07-14) from
 * `LoanAccountCreatePage` so it can also be reused inside a "Create Loan Account" dialog on the
 * Loan Applicant Profile page - `lockedBorrower` skips the Find Client step entirely when the
 * client is already known (e.g. from an Approved application), and `showChrome=false` drops the
 * page header/back button for use inside a Dialog.
 *
 * Scoped to an EXISTING client only (2026-07-11 user decision) — a renewal or any new loan account
 * goes straight here without needing its own reviewed/approved Loan Application first (except when
 * opened from the Loan Applicant Profile flow, which does require one). A brand-new (not-yet-a-
 * client) borrower isn't supported by this first version; add them via List of Clients, then come
 * back here.
 *
 * Schedule computation itself is NOT done here — `previewLoanSchedule()` is a client-side preview
 * only (see its own doc comment). The real, authoritative schedule is generated server-side by
 * `AmortizationScheduleGenerator` at Activate time, once this loan account (created here in
 * PENDING_APPROVAL) has been approved.
 */
export function LoanAccountForm({
  lockedBorrower,
  prefillTermMonths,
  showChrome = true,
  onCreated,
  onCancel,
}: {
  lockedBorrower?: Borrower;
  /** Requested Term (months) from the client's loan application, if opened from one - takes
   * priority over the product's own default term when a product is selected. */
  prefillTermMonths?: number;
  showChrome?: boolean;
  onCreated: (loan: LoanAccount) => void;
  onCancel: () => void;
}) {
  useLogPageView('Create Loan Account');
  const { currentAccount } = useRole();

  const [selectedBorrower, setSelectedBorrower] = React.useState<Borrower | null>(lockedBorrower ?? null);
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
  // Any active, non-hidden product is LISTED (matches the Loan Products catalog page's own
  // "Active" count for the same Product Type) - `activeSupportedVersion` alone would silently drop
  // Flat-rate products (e.g. "BL-Special"), which staff found confusing when a Product Type here
  // showed fewer Product Classes than the catalog page. Flat-only ones are shown disabled instead
  // (`isSelectable: false`, see the Product Class dropdown below).
  const availableProducts = (productsQuery.data ?? [])
    .filter((p) => anyActiveVersion(p) && !HIDDEN_PRODUCT_CODES.has(p.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Product Type -> Product Class two-step picker (2026-07-14) - same grouping as the Loan
  // Products catalog page (`classifyProductType`/`groupByProductType`), so staff pick a category
  // first (Business Loan, Salary Loan, etc.) before narrowing to the specific active product.
  const productGroups = groupByProductType(
    availableProducts.map((p) => ({
      ...p,
      productType: classifyProductType(p.name),
      isSelectable: Boolean(activeSupportedVersion(p)),
    })),
  );
  const [selectedProductType, setSelectedProductType] = React.useState('');
  const productClassOptions = productGroups.find((g) => g.type === selectedProductType)?.rows ?? [];

  const [loanProductId, setLoanProductId] = React.useState('');
  const selectedProduct = availableProducts.find((p) => p.id === loanProductId);
  const selectedVersion = selectedProduct ? activeSupportedVersion(selectedProduct) : undefined;

  // Clears the Product Class choice whenever Product Type changes, so a selection from a
  // previously-picked type can never linger under a different one.
  const handleProductTypeChange = (type: string) => {
    setSelectedProductType(type);
    setLoanProductId('');
  };

  const [principalAmount, setPrincipalAmount] = React.useState('');
  // Amount Entry Mode (2026-07-11): lets staff enter the exact Net Amount a client asked for
  // (e.g. "gusto niya makuha ₱20,000 net") instead of the Gross/Principal — Principal Amount is
  // then reverse-solved via solveGrossForDesiredNet(), same goal-seek idea as the legacy Excel's
  // own "Net Amount Auto Computation" workbook. Principal Amount stays visible and editable in
  // both modes, matching this form's "default then editable" pattern everywhere else.
  const [amountEntryMode, setAmountEntryMode] = React.useState<'gross' | 'net'>('gross');
  const [desiredNetAmount, setDesiredNetAmount] = React.useState('');
  const [installmentCount, setInstallmentCount] = React.useState('');
  const [addOnRate, setAddOnRate] = React.useState('');
  const [interestRate, setInterestRate] = React.useState('');
  // Anticipated Disbursement Date — distinct from First Repayment Date (matches Loans_details'
  // own column split in the Excel LMS); the gap between the two drives Advance Interest Fee
  // (ADR-046). Defaults to today, editable.
  const [disbursementDate, setDisbursementDate] = React.useState(todayIsoDate());
  const [firstRepaymentDate, setFirstRepaymentDate] = React.useState(defaultFirstRepaymentDate());

  // Fills in the product's configured defaults whenever a new product is selected — still freely
  // editable afterward, same "default then editable" pattern as Payment Recording's amount field.
  React.useEffect(() => {
    if (!selectedVersion) return;
    setPrincipalAmount(selectedVersion.loanAmountDefault ?? selectedVersion.loanAmountMin);
    setInstallmentCount(String(prefillTermMonths ?? selectedVersion.installmentCountDefault ?? selectedVersion.installmentCountMin));
    setAddOnRate('');
    setInterestRate(selectedVersion.defaultInterestRate ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion]);

  const rateChartQuery = useQuery({
    queryKey: ['interest-rate-chart'],
    queryFn: () => apiClient.get<PaginatedResponse<InterestRateChartEntry>>('/interest-rate-chart'),
  });
  const rateChart = rateChartQuery.data?.items ?? [];
  // Distinct Add-On Rate options from the Interest Rate Chart (`Rate_details` — see the '201 Loan
  // Docs Encode.xlsx' interest chart this was migrated from), sorted ascending, for the dropdown
  // below - staff pick from the chart's actual rates rather than free-typing a value that may not
  // be on file.
  const addOnRateOptions = React.useMemo(
    () => Array.from(new Set(rateChart.map((e) => e.addOnRatePercent))).sort((a, b) => Number(a) - Number(b)),
    [rateChart],
  );

  const principalNum = Number.parseFloat(principalAmount) || 0;
  const installmentCountNum = Number.parseInt(installmentCount, 10) || 0;
  const addOnRateNum = Number.parseFloat(addOnRate) || 0;
  const interestRateNum = Number.parseFloat(interestRate) || 0;

  // Auto-fills the Contractual Rate from the (Add-On Rate, Term) -> Contractual Rate lookup table
  // (`Rate_details`, see the backend Prisma model's own doc comment) whenever either input changes
  // and a matching chart entry exists — still freely editable afterward (e.g. when nothing matches,
  // matching the pattern every other "default then editable" field in this form already uses).
  const chartMatch =
    addOnRateNum > 0 && installmentCountNum > 0
      ? rateChart.find((e) => Number(e.addOnRatePercent) === addOnRateNum && e.termMonths === installmentCountNum)
      : undefined;
  React.useEffect(() => {
    if (chartMatch) setInterestRate(chartMatch.contractualRatePercent);
    // Only auto-fills when a match is found — deliberately does not clear an already-entered rate
    // when there's no match, so staff can still type one manually (see the "not on file" note below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartMatch?.contractualRatePercent]);

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

  // Origination fees (2026-07-11) — one-time deductions taken at disbursement. Account Management
  // Fee (1% of principal), Notarial Fee, Web Fee, Insurance Fee (computeInsuranceFee — real VBA
  // macro, verified against 4 real loans), and Advance Interest Fee (computeAdvanceInterestFee —
  // ADR-046, verified against 449 real loans) all have confirmed defaults from real data.
  // Processing Fee, Outstanding Balance payoff, Doc Stamp, and Others vary too much per loan (or
  // have no evidence at all) to default — staff enters those directly, starting at 0. All nine
  // fields stay freely editable regardless of whether a default was applied.
  // Processing Fee is entered as a percent of principal (matching the Excel's own O=P/I
  // relationship, just entered in the other direction) — no confirmed formula exists for what
  // that percent should be (see the "not reliably confirmed" note above), so it starts blank.
  const [processingFeePercent, setProcessingFeePercent] = React.useState('');
  const [advanceInterestFee, setAdvanceInterestFee] = React.useState('0.00');
  const [outstandingBalancePayoff, setOutstandingBalancePayoff] = React.useState('0.00');
  const [docStampFee, setDocStampFee] = React.useState('0.00');
  // Account Management Fee is entered as a percent of principal too (same pattern as Processing
  // Fee) — defaults to 1%, the one confirmed real-data rate whenever this fee is charged at all.
  const [accountManagementFeePercent, setAccountManagementFeePercent] = React.useState('1');
  const [otherFees, setOtherFees] = React.useState('0.00');
  const [notarialFee, setNotarialFee] = React.useState('0.00');
  const [webFee, setWebFee] = React.useState('0.00');
  const [insuranceFee, setInsuranceFee] = React.useState('0.00');

  // Notarial/Web Fee defaults: ₱500/₱500 generally, but confirmed ₱300/₱0 specifically for the
  // SL-CORP product (4/4 real loans sampled) — only that exact, confirmed product code gets the
  // override; every other product keeps the general default rather than guessing.
  React.useEffect(() => {
    if (!selectedProduct) return;
    const isSlCorp = selectedProduct.code === 'SL-CORP';
    setNotarialFee(isSlCorp ? '300.00' : '500.00');
    setWebFee(isSlCorp ? '0.00' : '500.00');
  }, [selectedProduct]);

  // Insurance Fee: recomputes live from the schedule preview's Monthly Payment and the term,
  // via computeInsuranceFee() (confirmed formula, see its own doc comment) — still freely
  // editable/zeroable afterward, same pattern as every other default in this form.
  React.useEffect(() => {
    if (preview && installmentCountNum > 0) {
      setInsuranceFee(computeInsuranceFee(preview.monthlyPayment, installmentCountNum).toFixed(2));
    }
  }, [preview?.monthlyPayment, installmentCountNum]);

  // Advance Interest Fee (ADR-046): recomputes live from Principal, Add-On Rate, and the
  // disbursement->first-repayment gap — see computeAdvanceInterestFee's own doc comment for why
  // this stays a per-loan suggestion rather than an auto-applied per-product rule. Still freely
  // editable/zeroable afterward.
  React.useEffect(() => {
    if (principalNum > 0 && addOnRateNum > 0 && disbursementDate && firstRepaymentDate) {
      const fee = computeAdvanceInterestFee(principalNum, addOnRateNum, new Date(disbursementDate), new Date(firstRepaymentDate));
      setAdvanceInterestFee(fee.toFixed(2));
    }
  }, [principalNum, addOnRateNum, disbursementDate, firstRepaymentDate]);

  const processingFeePercentNum = Number.parseFloat(processingFeePercent) || 0;
  const processingFee = ((principalNum * processingFeePercentNum) / 100).toFixed(2);

  const accountManagementFeePercentNum = Number.parseFloat(accountManagementFeePercent) || 0;
  const accountManagementFee = ((principalNum * accountManagementFeePercentNum) / 100).toFixed(2);

  const desiredNetNum = Number.parseFloat(desiredNetAmount) || 0;

  // Net Amount mode: reverse-solves Principal Amount from the desired Net Proceeds, using the
  // exact same fee formulas as everywhere else in this form (see solveGrossForDesiredNet's own
  // doc comment). Still just populates principalAmount — staff can override it afterward like any
  // other auto-filled field, and switching back to Gross mode simply stops re-solving it.
  React.useEffect(() => {
    if (amountEntryMode !== 'net' || desiredNetNum <= 0) return;
    const solved = solveGrossForDesiredNet(desiredNetNum, {
      installmentCountNum,
      interestRateNum,
      addOnRateNum,
      disbursementDateObj: disbursementDate ? new Date(disbursementDate) : null,
      firstRepaymentDateObj: firstRepaymentDate ? new Date(firstRepaymentDate) : null,
      processingFeePercentNum,
      accountManagementFeePercentNum,
      outstandingBalancePayoffNum: Number.parseFloat(outstandingBalancePayoff) || 0,
      docStampFeeNum: Number.parseFloat(docStampFee) || 0,
      otherFeesNum: Number.parseFloat(otherFees) || 0,
      notarialFeeNum: Number.parseFloat(notarialFee) || 0,
      webFeeNum: Number.parseFloat(webFee) || 0,
    });
    setPrincipalAmount(solved.toFixed(2));
  }, [
    amountEntryMode,
    desiredNetNum,
    installmentCountNum,
    interestRateNum,
    addOnRateNum,
    disbursementDate,
    firstRepaymentDate,
    processingFeePercentNum,
    accountManagementFeePercentNum,
    outstandingBalancePayoff,
    docStampFee,
    otherFees,
    notarialFee,
    webFee,
  ]);

  const feeFields = [
    processingFee,
    advanceInterestFee,
    outstandingBalancePayoff,
    docStampFee,
    accountManagementFee,
    otherFees,
    notarialFee,
    webFee,
    insuranceFee,
  ];
  const totalFees = feeFields.reduce((sum, v) => sum + (Number.parseFloat(v) || 0), 0);
  const netProceeds = principalNum - totalFees;

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
        // Informational snapshot fields only (ADR-010) — interestRate above is what actually runs
        // the schedule; these just record which Add-On Rate/Contractual Rate pair was used.
        addOnInterestRate: addOnRateNum > 0 ? addOnRateNum.toFixed(3) : undefined,
        contractualInterestRate: interestRateNum.toFixed(3),
        installmentCount: installmentCountNum,
        firstRepaymentDate,
        anticipatedDisbursementDate: disbursementDate || undefined,
        processingFee,
        advanceInterestFee,
        outstandingBalancePayoff,
        docStampFee,
        accountManagementFee,
        otherFees,
        notarialFee,
        webFee,
        insuranceFee,
      }),
    onSuccess: (loan) => {
      onCreated(loan);
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
    Boolean(firstRepaymentDate) &&
    netProceeds >= 0;

  return (
    <div className="space-y-6">
      {showChrome && (
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to List of Loan Accounts
          </Button>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">New Loan Account</h2>
            <p className="text-sm text-muted-foreground">
              Creates a PENDING_APPROVAL loan account for an existing client — approve and activate it afterward from the loan's own
              detail page.
            </p>
          </div>
        </>
      )}

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
                  New to the company (not a client yet)? Add them under List of Clients first, then come back here.
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
                  {!lockedBorrower && (
                    <Button variant="ghost" size="sm" onClick={changeClient}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Change
                    </Button>
                  )}
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
                  <Label htmlFor="product-type">Product Type</Label>
                  <Select value={selectedProductType} onValueChange={handleProductTypeChange} disabled={productsQuery.isLoading}>
                    <SelectTrigger id="product-type">
                      <SelectValue placeholder={productsQuery.isLoading ? 'Loading…' : 'Select a product type...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {productGroups.map((g) => (
                        <SelectItem key={g.type} value={g.type}>
                          {g.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="product">Product Class</Label>
                  <Select value={loanProductId} onValueChange={setLoanProductId} disabled={!selectedProductType}>
                    <SelectTrigger id="product">
                      <SelectValue placeholder={selectedProductType ? 'Select a product class...' : 'Select a product type first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {productClassOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={!p.isSelectable}>
                          <span className="flex items-center gap-2">
                            {p.name}
                            {!p.isSelectable && (
                              <Badge variant="outline" className="text-[10px]" title="Flat-rate products can't be activated yet - not selectable here">
                                Not yet activatable
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedVersion && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Amount Entry Mode</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={amountEntryMode === 'gross' ? 'default' : 'outline'}
                          onClick={() => setAmountEntryMode('gross')}
                        >
                          Gross Amount
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={amountEntryMode === 'net' ? 'default' : 'outline'}
                          onClick={() => setAmountEntryMode('net')}
                        >
                          Desired Net Amount
                        </Button>
                      </div>
                    </div>

                    {amountEntryMode === 'net' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="desired-net">Desired Net Amount</Label>
                        <Input
                          id="desired-net"
                          type="number"
                          min="0"
                          step="0.01"
                          value={desiredNetAmount}
                          onChange={(e) => setDesiredNetAmount(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Principal Amount below is solved automatically so Net Proceeds matches this exactly.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="principal">{amountEntryMode === 'net' ? 'Principal Amount (solved)' : 'Principal Amount'}</Label>
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
                      <Label htmlFor="add-on-rate">Add-On Rate (% monthly)</Label>
                      <Select value={addOnRate} onValueChange={setAddOnRate}>
                        <SelectTrigger id="add-on-rate">
                          <SelectValue placeholder={rateChartQuery.isLoading ? 'Loading…' : 'Select an Add-On Rate...'} />
                        </SelectTrigger>
                        <SelectContent>
                          {addOnRateOptions.map((rate) => (
                            <SelectItem key={rate} value={rate}>
                              {rate}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Looks up the Contractual Rate below from the Interest Rate Chart, by this rate and the term.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="rate">Contractual Rate (% monthly)</Label>
                      <Input id="rate" type="number" min="0" step="0.001" value={interestRate} readOnly disabled className="bg-muted" />
                      {addOnRateNum > 0 && installmentCountNum > 0 && !chartMatch ? (
                        <p className="text-xs text-warning">
                          No Interest Rate Chart entry for {addOnRateNum}% / {installmentCountNum} months — not on file, please confirm
                          with MIS before proceeding.
                        </p>
                      ) : (
                        (selectedVersion.minInterestRate || selectedVersion.maxInterestRate) && (
                          <p className={`text-xs ${interestRateOutOfRange ? 'text-destructive' : 'text-muted-foreground'}`}>
                            Range: {selectedVersion.minInterestRate ?? '0'}%{selectedVersion.maxInterestRate ? `–${selectedVersion.maxInterestRate}%` : '+'}
                          </p>
                        )
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="disbursement-date">Anticipated Disbursement Date</Label>
                      <Input
                        id="disbursement-date"
                        type="date"
                        value={disbursementDate}
                        onChange={(e) => setDisbursementDate(e.target.value)}
                      />
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
                      <p className="text-xs text-muted-foreground">
                        A gap over 30 days from disbursement auto-computes an Advance Interest Fee below (ADR-046).
                      </p>
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

        {selectedBorrower && selectedVersion && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Origination Fees</CardTitle>
              <CardDescription>
                One-time deductions taken at disbursement. Account Management Fee, Notarial Fee, and Web Fee are pre-filled from
                confirmed real-data defaults — every field stays editable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="processing-fee-percent">Processing Fee (%)</Label>
                  <Input
                    id="processing-fee-percent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={processingFeePercent}
                    onChange={(e) => setProcessingFeePercent(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">= {formatPeso(Number.parseFloat(processingFee))}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="advance-interest-fee">Advance Interest</Label>
                  <Input
                    id="advance-interest-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={advanceInterestFee}
                    onChange={(e) => setAdvanceInterestFee(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-computed when disbursement-to-first-repayment gap exceeds 30 days (ADR-046) — zero it out if this product/loan
                    shouldn't charge it.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="outstanding-balance">Outstanding Balance (previous loan)</Label>
                  <Input
                    id="outstanding-balance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={outstandingBalancePayoff}
                    onChange={(e) => setOutstandingBalancePayoff(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave at 0 for a brand-new loan — paid off from this loan's proceeds otherwise (renewal).</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-stamp">Doc Stamp</Label>
                  <Input id="doc-stamp" type="number" min="0" step="0.01" value={docStampFee} onChange={(e) => setDocStampFee(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account-mgmt-fee-percent">Account Management Fee (%)</Label>
                  <Input
                    id="account-mgmt-fee-percent"
                    type="number"
                    min="0"
                    step="0.01"
                    value={accountManagementFeePercent}
                    onChange={(e) => setAccountManagementFeePercent(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Defaults to 1% (confirmed real-data rate) = {formatPeso(Number.parseFloat(accountManagementFee))}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="other-fees">Others</Label>
                  <Input id="other-fees" type="number" min="0" step="0.01" value={otherFees} onChange={(e) => setOtherFees(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notarial-fee">Notarial Fee</Label>
                  <Input id="notarial-fee" type="number" min="0" step="0.01" value={notarialFee} onChange={(e) => setNotarialFee(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="web-fee">Web Fee</Label>
                  <Input id="web-fee" type="number" min="0" step="0.01" value={webFee} onChange={(e) => setWebFee(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="insurance-fee">Insurance Fee</Label>
                  <Input id="insurance-fee" type="number" min="0" step="0.01" value={insuranceFee} onChange={(e) => setInsuranceFee(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Auto-computed from Monthly Payment × Term (confirmed formula) — zero it out to waive.</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border bg-secondary/40 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total Fees</p>
                  <p className="font-semibold">{formatPeso(totalFees)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Net Proceeds (Principal − Total Fees)</p>
                  <p className={`font-semibold ${netProceeds < 0 ? 'text-destructive' : 'text-success'}`}>{formatPeso(netProceeds)}</p>
                </div>
              </div>
              {netProceeds < 0 && (
                <p className="text-xs text-destructive">Total fees exceed the principal amount — check the entries above before submitting.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !createMutation.isPending && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Loan Account Creation</DialogTitle>
            <DialogDescription>
              Create a {selectedProduct?.name} loan account for {selectedBorrower?.fullName} — {formatPeso(principalNum)} over{' '}
              {installmentCountNum} months at {interestRateNum}% monthly, net proceeds {formatPeso(netProceeds)} after{' '}
              {formatPeso(totalFees)} in fees? This creates the account in Pending Approval; it will need to be approved and activated
              separately.
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
