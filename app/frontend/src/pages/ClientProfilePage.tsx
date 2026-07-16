import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Briefcase, FilePlus2, Home, Landmark, Mail, Pencil, Phone, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/PhoneInput';
import { Label } from '@/components/ui/label';
import { FieldTooltip } from '@/components/FieldTooltip';
import { FieldLockToggle } from '@/components/FieldLockToggle';
import { RoleAbbr } from '@/components/RoleAbbr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { AttachmentsPanel } from '@/components/AttachmentsPanel';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ProfileActivityTimeline } from '@/components/ProfileActivityTimeline';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, fetchAllPages, uploadFile } from '@/lib/apiClient';
import { ATTACHMENT_ACCEPTED_MIME, ATTACHMENT_ACCEPTED_TYPES, ATTACHMENT_MAX_FILE_SIZE_BYTES } from '@/lib/documentApiTypes';
import type { Borrower as RealBorrower, LoanAccount, LoanAccountStatus, LoanProduct } from '@/lib/loanApiTypes';
import type { LoanApplication } from '@/lib/loanApplicationApiTypes';
import { LoanApplicationForm } from '@/pages/LoanApplicationCreatePage';
import { LoanAccountForm } from '@/pages/LoanAccountCreatePage';
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

  const queryKeyForAvatar = ['attachments', 'BORROWER', borrower.id];
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ownerType', 'BORROWER');
      formData.append('ownerId', borrower.id);
      formData.append('documentCategory', 'PROFILE_PICTURE');
      return uploadFile('/attachments', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyForAvatar });
    },
  });
  const handlePhotoFileSelected = (file: File) => {
    if (!ATTACHMENT_ACCEPTED_MIME.has(file.type)) {
      setPhotoError('Unsupported file type. Allowed: PDF, JPEG, PNG.');
      return;
    }
    if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      setPhotoError(`File exceeds the ${ATTACHMENT_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`);
      return;
    }
    setPhotoError(null);
    uploadPhotoMutation.mutate(file);
  };

  React.useEffect(() => {
    if (open) {
      setDraft(draftFromBorrower(borrower));
      setAddressTouched(false);
      setPhotoError(null);
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

        <div className="flex items-center gap-3 border-b pb-4">
          <ApplicantAvatar
            ownerType="BORROWER"
            ownerId={borrower.id}
            initials={((borrower.firstName[0] ?? '') + (borrower.lastName[0] ?? '')).toUpperCase()}
            className="h-14 w-14"
          />
          <div className="space-y-1">
            <input
              ref={photoInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoFileSelected(file);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadPhotoMutation.isPending}
              onClick={() => photoInputRef.current?.click()}
            >
              {uploadPhotoMutation.isPending ? 'Uploading…' : 'Upload Profile Picture'}
            </Button>
            {photoError && <p className="text-xs text-destructive">{photoError}</p>}
            {uploadPhotoMutation.isError && !photoError && (
              <p className="text-xs text-destructive">Could not upload the photo. Please try again.</p>
            )}
          </div>
        </div>

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
            <PhoneInput
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
 * Frontend↔Backend Wiring Pilot, extended 2026-07-09 after CP12. `getMockBorrower()` only knows
 * hand-authored mock clients - a borrower id from `ClientListPage`'s now-real list (a UUID,
 * migrated from legacy data) doesn't exist there and would otherwise hit this page's "not found"
 * state. Deliberately minimal, same scope decision as `LoanDetailPage.tsx`'s `RealLoanDetailView`:
 * personal info + real loan history. Editing is now real (`RealEditClientDialog`). "Create Loan
 * Account" moved to the Loan Applicant Profile page (2026-07-14) - it's gated per-application
 * there (`application.createdBorrowerId` set + `status === 'APPROVED'`), not per-client. Attachments
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Risk &amp; Payment Summary</CardTitle>
        </div>
        {summary && <Badge variant={RISK_BADGE_VARIANT[summary.riskLevel]}>{RISK_LEVEL_LABEL[summary.riskLevel]}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading risk summary…</p>
        ) : !summary ? (
          <p className="text-sm text-muted-foreground">Could not load the risk summary.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-y-1.5 text-xs sm:grid-cols-4">
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
            <p className="text-xs text-muted-foreground">{summary.recommendation}</p>
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
  const queryClient = useQueryClient();
  const { canAccessLoanApplications } = useRole();
  const [editOpen, setEditOpen] = React.useState(false);
  const [createApplicationOpen, setCreateApplicationOpen] = React.useState(false);
  const [createLoanAccountOpen, setCreateLoanAccountOpen] = React.useState(false);

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
    // caches the plain LoanProduct[] array under different assumptions about shape/freshness.
    queryKey: ['loan-products', 'all', 'clientProfilePage'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
  });
  const versionToProductName = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of rawProductsQuery.data ?? []) {
      for (const v of p.versions ?? []) map.set(v.id, p.name);
    }
    return map;
  }, [rawProductsQuery.data]);

  const applicationsQuery = useQuery({
    queryKey: ['loan-applications', 'all', 'clientProfilePage'],
    queryFn: () => fetchAllPages<LoanApplication>('/loan-applications'),
  });

  const loans = (loansQuery.data ?? []).filter((l) => l.borrowerId === borrowerId);
  const hasActiveLoan = loans.some((l) => ACTIVE_LOAN_STATUSES.has(l.status));
  // This client's own applications - either the walk-in flow that later converted INTO this
  // client (createdBorrowerId, via Borrower.sourceApplicationId), or a renewal application
  // started directly FROM this client's profile (borrowerId, the "Create Loan Application" flow
  // added 2026-07-14). Newest first, for prefill and display.
  const myApplications = (applicationsQuery.data ?? [])
    .filter((a) => a.createdBorrowerId === borrowerId || a.borrowerId === borrowerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // A client cannot have 2 loan applications going at once: a new (renewal) application cannot be
  // started while an earlier one is anything other than DECLINED and hasn't yet produced a loan
  // account (2026-07-14: previously only blocked on PREAPPROVED/PREDECLINED, which let a second
  // application be started while an APPROVED-but-not-yet-converted one was still "waiting to
  // become a loan account" - closed that gap). Mirrors the backend's own check in
  // CreateLoanApplicationUseCase (belt-and-suspenders: this is just the UI gate).
  const hasPendingApplication = myApplications.some((a) => a.status !== 'DECLINED' && !a.createdLoanAccountId);
  const canCreateLoanApplicationNow = canAccessLoanApplications && !hasActiveLoan && !hasPendingApplication;
  // Clickable only once the client has no active/in-arrears loan account AND has an Approved
  // application that hasn't already produced a loan account (mirrors the "Create Loan Account"
  // dialog gating on the Loan Application Detail page, just keyed off the client instead of a
  // single application).
  const approvedApplicationAwaitingLoanAccount = myApplications.find((a) => a.status === 'APPROVED' && !a.createdLoanAccountId);
  const canCreateLoanAccountNow = !hasActiveLoan && approvedApplicationAwaitingLoanAccount !== undefined;

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
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        Real client, migrated from legacy data (CP12) - details, loan history, Create Loan Account, and Attachments below are live.
      </div>

      {/* Tile grid - two compact columns on large screens */}
      <div className="grid gap-4 lg:grid-cols-2">
      {/* Client basic info tile */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
          <div className="flex items-center gap-3">
            <ApplicantAvatar
              ownerType="BORROWER"
              ownerId={borrower.id}
              initials={((borrower.firstName[0] ?? '') + (borrower.lastName[0] ?? '')).toUpperCase()}
              className="h-10 w-10 shrink-0"
              fallbackClassName="text-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{borrower.fullName}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {borrower.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Loan cycle {borrower.loanCycle}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {formatMobileNumber(borrower.mobilePhone1)}
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {borrower.email ?? '-'}
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {addressLine}
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {borrower.incomeDetail?.position ?? '-'}, {borrower.incomeDetail?.employerName ?? '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Income: </span>
              {borrower.incomeDetail?.monthlyIncome != null ? formatPeso(borrower.incomeDetail.monthlyIncome) : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Civil status: </span>
              {borrower.civilStatus ?? '-'}
            </div>
            <div>
              <span className="text-muted-foreground">DOB: </span>
              {borrower.birthDate ? formatDate(borrower.birthDate) : '-'}
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
          <CardTitle className="text-sm">Loan Applications</CardTitle>
          {canAccessLoanApplications ? (
            <Button size="sm" disabled={!canCreateLoanApplicationNow} onClick={() => setCreateApplicationOpen(true)}>
              <FilePlus2 className="mr-1.5 h-3.5 w-3.5" /> Create Loan Application
            </Button>
          ) : (
            <Badge variant="outline" className="text-xs">
              Only <RoleAbbr role="MIS" />, <RoleAbbr role="Loan Operation Manager" />, or <RoleAbbr role="CRM" /> can create loan applications
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {hasActiveLoan && canAccessLoanApplications && (
            <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              This client still has an active (or in-arrears) loan account - a new application can be started once it's closed.
            </p>
          )}
          {!hasActiveLoan && hasPendingApplication && canAccessLoanApplications && (
            <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              This client already has a loan application that isn't Declined yet and hasn't produced a loan account - only one can
              be open at a time.
            </p>
          )}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Date</TableCell>
                <TableCell className="font-medium text-muted-foreground">Category</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">Requested Amount</TableCell>
                <TableCell className="font-medium text-muted-foreground">Status</TableCell>
                <TableCell className="font-medium text-muted-foreground">Loan Account</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myApplications.map((application) => (
                <TableRow key={application.id} className="cursor-pointer" onClick={() => navigate(`/applications/${application.id}`)}>
                  <TableCell className="text-xs">{formatDate(application.createdAt)}</TableCell>
                  <TableCell>{application.requestedCategory}</TableCell>
                  <TableCell className="text-right">{formatPeso(application.requestedAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={application.status === 'APPROVED' ? 'success' : application.status === 'DECLINED' ? 'destructive' : 'outline'}>
                      {application.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {application.createdLoanAccountId ? (
                      <Link
                        to={`/loans/${application.createdLoanAccountId}`}
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Landmark className="h-3 w-3" /> {application.createdLoanAccountCode ?? 'View'}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {myApplications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No loan applications on record for this client.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <RiskPaymentSummaryCard borrowerId={borrowerId} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
          <div>
            <CardTitle className="text-sm">Loan History</CardTitle>
            <CardDescription className="text-xs">
              {canCreateLoanAccountNow
                ? 'Ready to originate - the client has an approved application and no active loan.'
                : hasActiveLoan
                  ? "This client still has an active (or in-arrears) loan account."
                  : myApplications.length === 0
                    ? 'This client has no loan application on record yet.'
                    : 'This client has no Approved loan application awaiting a loan account.'}
            </CardDescription>
          </div>
          <Button size="sm" disabled={!canCreateLoanAccountNow} onClick={() => setCreateLoanAccountOpen(true)}>
            <Landmark className="mr-1.5 h-3.5 w-3.5" /> Create Loan Account
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
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
                    <LoanStatusBadge status={loan.status} isMatured={loan.isMatured} />
                  </TableCell>
                  <TableCell className="text-right">{formatPeso(num(loan.principalAmount))}</TableCell>
                  {(() => {
                    // Not yet Activated - every balance column is genuinely 0 only because the
                    // amortization schedule hasn't been generated yet, not because there's no
                    // obligation. "—" avoids that reading as "nothing owed"/"fully paid".
                    const notYetActivated = loan.status === 'PENDING_APPROVAL' || loan.status === 'APPROVED';
                    return (
                      <>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.balances.interestBalance))}</TableCell>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.balances.penaltyBalance))}</TableCell>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.balances.feesBalance))}</TableCell>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.collectionsBalance))}</TableCell>
                      </>
                    );
                  })()}
                </TableRow>
              ))}
              {loansQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    Loading loans…
                  </TableCell>
                </TableRow>
              )}
              {!loansQuery.isLoading && loans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    No loans on record for this client.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <AttachmentsPanel ownerType="BORROWER" ownerId={borrower.id} canUpload />

      {/* Activity Timeline - ADR-050 */}
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-sm">Activity Timeline</CardTitle>
          <CardDescription className="text-xs">Log of all actions taken on this client profile by loan officers</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ProfileActivityTimeline profileType="BORROWER" profileId={borrowerId} />
        </CardContent>
      </Card>

      <RecentActivityPanel label="Client Profile" entityId={borrowerId} />
      </div>

      <RealEditClientDialog open={editOpen} onOpenChange={setEditOpen} borrower={borrower} />

      <Dialog open={createApplicationOpen} onOpenChange={setCreateApplicationOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Loan Application</DialogTitle>
            <DialogDescription>
              Prefilled from {borrower.fullName}&apos;s most recent loan application, as a renewal. Review and edit before submitting.
            </DialogDescription>
          </DialogHeader>
          {createApplicationOpen && (
            <LoanApplicationForm
              prefillFrom={myApplications[0]}
              lockedBorrowerId={borrowerId}
              showChrome={false}
              onCreated={(application) => {
                setCreateApplicationOpen(false);
                navigate(`/applications/${application.id}`);
              }}
              onCancel={() => setCreateApplicationOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createLoanAccountOpen} onOpenChange={setCreateLoanAccountOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Loan Account</DialogTitle>
            <DialogDescription>For {borrower.fullName}. Review before submitting.</DialogDescription>
          </DialogHeader>
          {createLoanAccountOpen && (
            <LoanAccountForm
              lockedBorrower={borrower}
              prefillTermMonths={approvedApplicationAwaitingLoanAccount?.requestedTermMonths}
              showChrome={false}
              onCreated={(loan) => {
                setCreateLoanAccountOpen(false);
                queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
                queryClient.invalidateQueries({ queryKey: ['loan-application', 'all'] });
                navigate(`/loans/${loan.id}`);
              }}
              onCancel={() => setCreateLoanAccountOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
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
