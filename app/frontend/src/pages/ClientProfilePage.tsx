import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Briefcase, Home, Landmark, Mail, Pencil, Phone, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldTooltip } from '@/components/FieldTooltip';
import { FieldLockToggle } from '@/components/FieldLockToggle';
import { RoleAbbr } from '@/components/RoleAbbr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { AttachmentsPanel } from '@/components/AttachmentsPanel';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ProfileActivityTimeline } from '@/components/ProfileActivityTimeline';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, fetchAllPages } from '@/lib/apiClient';
import type { Borrower as RealBorrower, LoanAccount, LoanAccountStatus, LoanProduct } from '@/lib/loanApiTypes';
import type { LoanApplication } from '@/lib/loanApplicationApiTypes';
import type { BorrowerRiskSummary, RiskLevel } from '@/lib/riskAssessmentApiTypes';
import { type AddressDraft, emptyAddressDraft, PsgcAddressPicker } from '@/components/PsgcAddressPicker';
import { formatDate, formatMobileNumber, formatPeso, toProperCase } from '@/lib/utils';

interface RealEditDraft {
  firstName: string;
  lastName: string;
  middleName: string;
  mobilePhone1: string;
  email: string;
  civilStatus: string;
  address: AddressDraft;
}

function draftFromBorrower(borrower: RealBorrower): RealEditDraft {
  const existing = borrower.addresses[0];
  return {
    firstName: borrower.firstName,
    lastName: borrower.lastName,
    middleName: borrower.middleName ?? '',
    mobilePhone1: borrower.mobilePhone1 ?? '',
    email: borrower.email ?? '',
    civilStatus: borrower.civilStatus ?? '',
    address: existing
      ? {
          houseUnitNumber: existing.houseUnitNumber ?? '',
          street: existing.street ?? '',
          barangay: existing.barangay ?? '',
          cityMunicipality: existing.cityMunicipality ?? '',
          province: existing.province ?? '',
          zipCode: existing.zipCode ?? '',
        }
      : emptyAddressDraft(),
  };
}

/**
 * Real edit dialog for a migrated (CP12) client - wired to `PATCH /borrowers/:id`. Address entry
 * uses the cascading `PsgcAddressPicker` instead of free text, so a saved address can never again
 * end up as a raw PSGC code (see scripts/fix-coded-addresses.ts). The picker can't pre-select the
 * client's existing address into its dropdowns (no name->code reverse lookup - see the picker's own
 * doc comment), so the current address is shown as read-only context above it; leaving the picker
 * untouched keeps the existing address unchanged.
 */
function RealEditClientDialog({
  open,
  onOpenChange,
  borrower,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrower: RealBorrower;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<RealEditDraft>(() => draftFromBorrower(borrower));
  const [addressTouched, setAddressTouched] = React.useState(false);
  const [unlocked, setUnlocked] = React.useState({
    firstName: false,
    lastName: false,
    middleName: false,
    mobilePhone1: false,
    email: false,
    civilStatus: false,
    address: false,
  });
  const toggleUnlock = (field: keyof typeof unlocked) => setUnlocked((u) => ({ ...u, [field]: !u[field] }));

  React.useEffect(() => {
    if (open) {
      setDraft(draftFromBorrower(borrower));
      setAddressTouched(false);
      setUnlocked({
        firstName: false,
        lastName: false,
        middleName: false,
        mobilePhone1: false,
        email: false,
        civilStatus: false,
        address: false,
      });
    }
  }, [open, borrower]);

  const existingAddress = borrower.addresses[0];
  const existingAddressLine = existingAddress
    ? toProperCase(
        [existingAddress.houseUnitNumber, existingAddress.street, existingAddress.barangay, existingAddress.cityMunicipality, existingAddress.province]
          .filter(Boolean)
          .join(', '),
      )
    : 'None on file';

  const updateMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<RealBorrower>(`/borrowers/${borrower.id}`, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        middleName: draft.middleName || undefined,
        mobilePhone1: draft.mobilePhone1 || undefined,
        email: draft.email || undefined,
        civilStatus: draft.civilStatus || undefined,
        ...(addressTouched
          ? {
              addresses: [
                {
                  houseUnitNumber: draft.address.houseUnitNumber || undefined,
                  street: draft.address.street || undefined,
                  barangay: draft.address.barangay || undefined,
                  cityMunicipality: draft.address.cityMunicipality || undefined,
                  province: draft.address.province || undefined,
                  zipCode: draft.address.zipCode || undefined,
                },
              ],
            }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['borrower', borrower.id] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Client Details</DialogTitle>
          <DialogDescription>
            Updates the real client record. Every field starts locked - click "Click to edit" next to a field to unlock it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                First Name <FieldTooltip text="Client's legal first name, as shown on a valid ID." />
              </Label>
              <FieldLockToggle unlocked={unlocked.firstName} onToggle={() => toggleUnlock('firstName')} />
            </div>
            <Input
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              disabled={!unlocked.firstName}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Last Name <FieldTooltip text="Client's legal surname, as shown on a valid ID." />
              </Label>
              <FieldLockToggle unlocked={unlocked.lastName} onToggle={() => toggleUnlock('lastName')} />
            </div>
            <Input
              value={draft.lastName}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
              disabled={!unlocked.lastName}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Middle Name <FieldTooltip text="Client's legal middle name, if any." />
              </Label>
              <FieldLockToggle unlocked={unlocked.middleName} onToggle={() => toggleUnlock('middleName')} />
            </div>
            <Input
              value={draft.middleName}
              onChange={(e) => setDraft({ ...draft, middleName: e.target.value })}
              disabled={!unlocked.middleName}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Contact Number <FieldTooltip text="Client's active mobile number for SMS/call follow-ups." />
              </Label>
              <FieldLockToggle unlocked={unlocked.mobilePhone1} onToggle={() => toggleUnlock('mobilePhone1')} />
            </div>
            <Input
              value={draft.mobilePhone1}
              onChange={(e) => setDraft({ ...draft, mobilePhone1: e.target.value })}
              placeholder="09XX XXX XXXX"
              disabled={!unlocked.mobilePhone1}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Email <FieldTooltip text="Client's email, used for document copies or notices." />
              </Label>
              <FieldLockToggle unlocked={unlocked.email} onToggle={() => toggleUnlock('email')} />
            </div>
            <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} disabled={!unlocked.email} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Civil Status <FieldTooltip text="Client's current civil status." />
              </Label>
              <FieldLockToggle unlocked={unlocked.civilStatus} onToggle={() => toggleUnlock('civilStatus')} />
            </div>
            <Select
              value={draft.civilStatus}
              onValueChange={(v) => setDraft({ ...draft, civilStatus: v })}
              disabled={!unlocked.civilStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Single">Single</SelectItem>
                <SelectItem value="Married">Married</SelectItem>
                <SelectItem value="Widowed">Widowed</SelectItem>
                <SelectItem value="Separated">Separated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1">
              Address <FieldTooltip text="Replacing this replaces the client's entire address on file - leave untouched to keep the current one." />
            </Label>
            <FieldLockToggle unlocked={unlocked.address} onToggle={() => toggleUnlock('address')} />
          </div>
          <p className="text-xs text-muted-foreground">
            Current on file: <span className="font-medium text-foreground">{existingAddressLine}</span>. Select below to replace it -
            leave untouched to keep the current address.
          </p>
          <fieldset disabled={!unlocked.address} className="disabled:opacity-50">
            <PsgcAddressPicker
              value={draft.address}
              onChange={(patch) => {
                setAddressTouched(true);
                setDraft((prev) => ({ ...prev, address: { ...prev.address, ...patch } }));
              }}
            />
          </fieldset>
        </div>

        {updateMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {updateMutation.error instanceof Error ? updateMutation.error.message : 'Could not save changes.'}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Real "Create Loan Account" against `POST /loan-accounts` - the first real (non-mock) loan
 * origination flow in the frontend. `loanCode` is a required, staff-typed field rather than
 * client-generated: no confirmed loan-code numbering rule exists yet for the real system (the
 * mock's BL-REG_NNNNN-style codes were never confirmed as the production convention), and
 * CLAUDE.md forbids fabricating financial/business logic - same reasoning as ADR-045's explicit,
 * never-derived `firstRepaymentDate`. Deliberately narrower than the mock `CreateLoanAccountDialog`
 * (no fee waivers, disbursement bank, payment method): those aren't accepted by
 * `createLoanAccountSchema` yet either - this dialog only offers fields the real API can persist.
 */
function RealCreateLoanAccountDialog({
  open,
  onOpenChange,
  borrower,
  eligibleApplication,
  productVersions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrower: RealBorrower;
  eligibleApplication: LoanApplication;
  productVersions: { id: string; label: string; version: LoanProduct['versions'][number] }[];
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [loanProductVersionId, setLoanProductVersionId] = React.useState('');
  const [loanCode, setLoanCode] = React.useState('');
  const [principalAmount, setPrincipalAmount] = React.useState('');
  const [interestRate, setInterestRate] = React.useState('');
  const [installmentCount, setInstallmentCount] = React.useState('');
  const [gracePeriodDays, setGracePeriodDays] = React.useState('');
  const [firstRepaymentDate, setFirstRepaymentDate] = React.useState('');

  const selectedVersion = productVersions.find((v) => v.id === loanProductVersionId)?.version;

  React.useEffect(() => {
    if (!open) return;
    setLoanProductVersionId('');
    setLoanCode('');
    setPrincipalAmount(String(eligibleApplication.requestedAmount ?? ''));
    setInterestRate('');
    setInstallmentCount(String(eligibleApplication.requestedTermMonths ?? ''));
    setGracePeriodDays('');
    setFirstRepaymentDate('');
  }, [open, eligibleApplication]);

  React.useEffect(() => {
    if (!selectedVersion) return;
    if (selectedVersion.defaultInterestRate) setInterestRate(selectedVersion.defaultInterestRate);
    if (selectedVersion.installmentCountDefault) setInstallmentCount(String(selectedVersion.installmentCountDefault));
    setGracePeriodDays(String(selectedVersion.gracePeriodDefaultDays ?? 0));
  }, [selectedVersion]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanAccount>('/loan-accounts', {
        loanCode: loanCode.trim(),
        borrowerId: borrower.id,
        loanProductVersionId,
        branchId: borrower.branchId,
        principalAmount,
        interestRate,
        installmentCount: Number(installmentCount),
        gracePeriodDays: gracePeriodDays ? Number(gracePeriodDays) : undefined,
        firstRepaymentDate,
      }),
    onSuccess: (loan) => {
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['loan-application', eligibleApplication.id] });
      navigate(`/loans/${loan.id}`);
    },
  });

  const canSubmit =
    loanProductVersionId.trim() &&
    loanCode.trim() &&
    principalAmount.trim() &&
    interestRate.trim() &&
    installmentCount.trim() &&
    firstRepaymentDate.trim() &&
    !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Loan Account</DialogTitle>
          <DialogDescription>
            From {borrower.fullName}'s approved application ({eligibleApplication.requestedCategory}). Creates the real loan account
            record - review before submitting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Loan Product</Label>
            <Select value={loanProductVersionId} onValueChange={setLoanProductVersionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {productVersions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Loan Code</Label>
            <Input value={loanCode} onChange={(e) => setLoanCode(e.target.value)} placeholder="e.g. BL-REG_00063" />
          </div>
          <div className="space-y-1.5">
            <Label>Principal Amount</Label>
            <Input type="number" value={principalAmount} onChange={(e) => setPrincipalAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Interest Rate (%)</Label>
            <Input type="number" step="0.001" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Installment Count</Label>
            <Input type="number" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Grace Period (days)</Label>
            <Input type="number" value={gracePeriodDays} onChange={(e) => setGracePeriodDays(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>First Repayment Date</Label>
            <Input type="date" value={firstRepaymentDate} onChange={(e) => setFirstRepaymentDate(e.target.value)} />
          </div>
        </div>

        {createMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {createMutation.error instanceof Error ? createMutation.error.message : 'Could not create the loan account.'}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit}>
            Create Loan Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-09 after CP12. `getMockBorrower()` only knows
 * hand-authored mock clients - a borrower id from `ClientListPage`'s now-real list (a UUID,
 * migrated from legacy data) doesn't exist there and would otherwise hit this page's "not found"
 * state. Deliberately minimal, same scope decision as `LoanDetailPage.tsx`'s `RealLoanDetailView`:
 * personal info + real loan history. Editing is now real (`RealEditClientDialog`). Create Loan
 * Account is now real too (`RealCreateLoanAccountDialog`, gated on a `LoanApplication` whose
 * `createdBorrowerId` matches this client and has no `createdLoanAccountId` yet). Attachments
 * stay mock-only.
 */
const RISK_BADGE_VARIANT: Record<RiskLevel, 'success' | 'warning' | 'destructive'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'destructive',
};
const RISK_LEVEL_LABEL: Record<RiskLevel, string> = { LOW: 'Low Risk', MEDIUM: 'Medium Risk', HIGH: 'High Risk' };

/**
 * Deterministic, rule-based summary computed by the LMS itself (backend's
 * `BorrowerRiskSummaryService`) from this client's real loan/repayment history across every loan
 * they've ever had - no external AI model. Advisory only.
 */
function RiskPaymentSummaryCard({ borrowerId }: { borrowerId: string }) {
  const query = useQuery({
    queryKey: ['borrower-risk-summary', borrowerId],
    queryFn: () => apiClient.get<BorrowerRiskSummary>(`/borrowers/${borrowerId}/risk-summary`),
  });
  const summary = query.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Risk &amp; Payment Summary</CardTitle>
        </div>
        {summary && <Badge variant={RISK_BADGE_VARIANT[summary.riskLevel]}>{RISK_LEVEL_LABEL[summary.riskLevel]}</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading risk summary…</p>
        ) : !summary ? (
          <p className="text-sm text-muted-foreground">Could not load the risk summary.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm sm:grid-cols-4">
              <dt className="text-muted-foreground">Active loans</dt>
              <dd className="text-right font-medium sm:text-left">{summary.activeLoanCount}</dd>
              <dt className="text-muted-foreground">Total exposure</dt>
              <dd className="text-right font-medium sm:text-left">{formatPeso(Number(summary.totalExposure))}</dd>
              <dt className="text-muted-foreground">Worst days past due</dt>
              <dd className="text-right font-medium sm:text-left">{summary.worstDaysPastDue}</dd>
              <dt className="text-muted-foreground">Late payments (lifetime)</dt>
              <dd className="text-right font-medium sm:text-left">{summary.lifetimeLateInstallmentCount}</dd>
              <dt className="text-muted-foreground">On-time payment rate</dt>
              <dd className="text-right font-medium sm:text-left">
                {summary.onTimePaymentRate === null ? 'No payment history yet' : `${Math.round(summary.onTimePaymentRate * 100)}%`}
              </dd>
            </dl>
            <p className="text-sm text-muted-foreground">{summary.recommendation}</p>
            <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
              Computed by the LMS from this client's real loan/repayment history - a deterministic rule-based calculation, not an
              external AI model.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** A loan account is "active" for the "one active loan at a time" rule if it hasn't reached any closed state yet. */
const ACTIVE_LOAN_STATUSES: ReadonlySet<LoanAccountStatus> = new Set(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ACTIVE_IN_ARREARS']);

function RealClientProfileView({ borrowerId }: { borrowerId: string }) {
  const navigate = useNavigate();
  const { canCreateLoanAccount } = useRole();
  const [editOpen, setEditOpen] = React.useState(false);
  const [createLoanOpen, setCreateLoanOpen] = React.useState(false);

  const borrowerQuery = useQuery({
    queryKey: ['borrower', borrowerId],
    queryFn: () => apiClient.get<RealBorrower>(`/borrowers/${borrowerId}`),
    retry: false,
  });
  const borrower = borrowerQuery.data;

  const loansQuery = useQuery({
    queryKey: ['loan-accounts', 'all'],
    queryFn: () => fetchAllPages<LoanAccount>('/loan-accounts'),
  });
  const rawProductsQuery = useQuery({
    // Deliberately NOT ['loan-products', 'all'] - that key is shared by every other page that
    // caches the plain LoanProduct[] array under different assumptions about shape/freshness. See
    // this query's original doc comment (now on `productVersionOptions` below) for why a distinct
    // key matters here.
    queryKey: ['loan-products', 'all', 'clientProfilePage'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
  });
  // Deliberately a distinct key from every other page's `['loan-products', 'all']` cache (see
  // `rawProductsQuery` above) - reusing that key served this page's derived shape to other
  // array-shaped consumers on later navigation and crashed them.
  const versionToProductName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of rawProductsQuery.data ?? []) {
      for (const v of p.versions ?? []) map.set(v.id, p.name);
    }
    return map;
  }, [rawProductsQuery.data]);
  const productVersionOptions = React.useMemo(
    () =>
      (rawProductsQuery.data ?? []).flatMap((p) =>
        (p.versions ?? [])
          .filter((v) => v.isActive)
          .map((v) => ({ id: v.id, label: `${p.name} (v${v.versionNumber})`, version: v })),
      ),
    [rawProductsQuery.data],
  );

  const applicationsQuery = useQuery({
    queryKey: ['loan-applications', 'all', 'clientProfilePage'],
    queryFn: () => fetchAllPages<LoanApplication>('/loan-applications'),
  });

  const loans = (loansQuery.data ?? []).filter((l) => l.borrowerId === borrowerId);
  const hasActiveLoan = loans.some((l) => ACTIVE_LOAN_STATUSES.has(l.status));
  // A new loan account may only be created from a specific, still-unconverted APPROVED
  // application that produced this client (see LoanApplicationDetailPage's "Create Client
  // Profile" flow) - every loan, including a renewal, needs its own reviewed/approved application.
  const eligibleApplication = (applicationsQuery.data ?? []).find(
    (a) => a.createdBorrowerId === borrowerId && a.status === 'APPROVED' && !a.createdLoanAccountId,
  );
  const canCreateLoanAccountNow = canCreateLoanAccount && !hasActiveLoan && Boolean(eligibleApplication);

  if (borrowerQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading client…</p>;
  }

  if (!borrower) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Client not found: {borrowerId}</p>
      </div>
    );
  }

  const address = borrower.addresses[0];
  const addressLine = address
    ? toProperCase(
        [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province].filter(Boolean).join(', '),
      )
    : '-';
  const num = (v: string) => Number.parseFloat(v) || 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        Real client, migrated from legacy data (CP12) - details, loan history, Create Loan Account, and Attachments below are live.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {((borrower.firstName[0] ?? '') + (borrower.lastName[0] ?? '')).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="mt-2">{borrower.fullName}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {borrower.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit / Customize Details
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> {formatMobileNumber(borrower.mobilePhone1)}
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" /> {borrower.email ?? '-'}
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" /> {addressLine}
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              {borrower.incomeDetail?.position ?? '-'}, {borrower.incomeDetail?.employerName ?? '-'}
            </div>
            <dl className="grid grid-cols-2 gap-y-2 border-t pt-3">
              <dt className="text-muted-foreground">Civil status</dt>
              <dd className="text-right font-medium">{borrower.civilStatus ?? '-'}</dd>
              <dt className="text-muted-foreground">Date of birth</dt>
              <dd className="text-right font-medium">{borrower.birthDate ? formatDate(borrower.birthDate) : '-'}</dd>
              <dt className="text-muted-foreground">Loan cycle</dt>
              <dd className="text-right font-medium">{borrower.loanCycle}</dd>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <RiskPaymentSummaryCard borrowerId={borrowerId} />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Loan History</CardTitle>
              {canCreateLoanAccount ? (
                <Button size="sm" disabled={!canCreateLoanAccountNow} onClick={() => setCreateLoanOpen(true)}>
                  <Landmark className="mr-1.5 h-3.5 w-3.5" /> Create Loan Account
                </Button>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Only <RoleAbbr role="MIS" />, <RoleAbbr role="Loan Operation Manager" />, or <RoleAbbr role="CRM" /> can create loan accounts
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {hasActiveLoan && canCreateLoanAccount && (
                <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  This client already has an active (or in-arrears) loan account. A client cannot have 2 active loan accounts at once.
                </p>
              )}
              {!hasActiveLoan && canCreateLoanAccount && !eligibleApplication && (
                <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  This client has no approved loan application on file. Every loan account - including a renewal - must come from its
                  own reviewed and approved Loan Application first.
                </p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Loan Code</TableCell>
                    <TableCell className="font-medium text-muted-foreground">Product</TableCell>
                    <TableCell className="font-medium text-muted-foreground">Status</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">Principal Balance</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">Interest Balance</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">Penalty Balance</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">Fees Balance</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">Collections Balance</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => (
                    <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                      <TableCell className="font-mono text-xs">{loan.loanCode}</TableCell>
                      <TableCell>{versionToProductName.get(loan.loanProductVersionId) ?? '-'}</TableCell>
                      <TableCell>
                        <LoanStatusBadge status={loan.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatPeso(num(loan.principalAmount))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(loan.balances.interestBalance))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(loan.balances.penaltyBalance))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(loan.balances.feesBalance))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(loan.collectionsBalance))}</TableCell>
                    </TableRow>
                  ))}
                  {loansQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Loading loans…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loansQuery.isLoading && loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        No loans on record for this client.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <AttachmentsPanel ownerType="BORROWER" ownerId={borrower.id} canUpload />

      {/* Activity Timeline - ADR-050 */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Log of all actions taken on this client profile by loan officers</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileActivityTimeline profileType="BORROWER" profileId={borrowerId} />
        </CardContent>
      </Card>

      <RecentActivityPanel label="Client Profile" entityId={borrowerId} />

      <RealEditClientDialog open={editOpen} onOpenChange={setEditOpen} borrower={borrower} />
      {eligibleApplication && (
        <RealCreateLoanAccountDialog
          open={createLoanOpen}
          onOpenChange={setCreateLoanOpen}
          borrower={borrower}
          eligibleApplication={eligibleApplication}
          productVersions={productVersionOptions}
        />
      )}
    </div>
  );
}

export function ClientProfilePage() {
  const { borrowerId } = useParams<{ borrowerId: string }>();
  const navigate = useNavigate();

  useLogPageView('Client Profile', borrowerId);

  if (!borrowerId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">No client specified.</p>
      </div>
    );
  }

  return <RealClientProfileView borrowerId={borrowerId} />;
}
