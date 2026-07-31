import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Briefcase, FilePlus2, Home, Landmark, Mail, Pencil, Phone, Plus, ShieldCheck, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSection } from '@/components/SortableSection';
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
import { NumberInput } from '@/components/NumberInput';
import { computeAge } from '@/lib/computeAge';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ProfileActivityTimeline } from '@/components/ProfileActivityTimeline';
import { type AddressDraft, emptyAddressDraft, PsgcAddressPicker } from '@/components/PsgcAddressPicker';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, ApiError, fetchAllPages, uploadFile } from '@/lib/apiClient';
import { ATTACHMENT_ACCEPTED_MIME, ATTACHMENT_ACCEPTED_TYPES, ATTACHMENT_MAX_FILE_SIZE_BYTES } from '@/lib/documentApiTypes';
import type { Borrower as RealBorrower, CoBorrower, LoanAccount, LoanAccountStatus, LoanProduct } from '@/lib/loanApiTypes';
import type { LoanApplication } from '@/lib/loanApplicationApiTypes';
import { LoanApplicationForm } from '@/pages/LoanApplicationCreatePage';
import { LoanAccountForm } from '@/pages/LoanAccountCreatePage';
import type { BorrowerRiskSummary, RiskLevel } from '@/lib/riskAssessmentApiTypes';
import { formatDate, formatMobileNumber, formatPeso, toProperCase } from '@/lib/utils';

interface RealEditDraft {
  firstName: string;
  lastName: string;
  middleName: string;
  gender: string;
  birthDate: string;
  placeOfBirth: string;
  nationality: string;
  homeOwnership: string;
  mobilePhone1: string;
  email: string;
  civilStatus: string;
  occupation: string;
  employer: string;
  monthlyIncome: string;
  address: AddressDraft;
}

function draftFromBorrower(borrower: RealBorrower): RealEditDraft {
  const existing = borrower.addresses[0];
  return {
    firstName: borrower.firstName,
    lastName: borrower.lastName,
    middleName: borrower.middleName ?? '',
    gender: borrower.gender ?? '',
    birthDate: borrower.birthDate ?? '',
    placeOfBirth: borrower.placeOfBirth ?? '',
    nationality: borrower.nationality ?? '',
    homeOwnership: borrower.homeOwnership ?? '',
    mobilePhone1: borrower.mobilePhone1 ?? '',
    email: borrower.email ?? '',
    civilStatus: borrower.civilStatus ?? '',
    occupation: borrower.incomeDetail?.position ?? '',
    employer: borrower.incomeDetail?.employerName ?? '',
    monthlyIncome: borrower.incomeDetail?.monthlyIncome != null ? String(borrower.incomeDetail.monthlyIncome) : '',
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
    gender: false,
    birthDate: false,
    placeOfBirth: false,
    nationality: false,
    homeOwnership: false,
    mobilePhone1: false,
    email: false,
    civilStatus: false,
    occupation: false,
    employer: false,
    monthlyIncome: false,
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
        gender: false,
        birthDate: false,
        placeOfBirth: false,
        nationality: false,
        homeOwnership: false,
        mobilePhone1: false,
        email: false,
        civilStatus: false,
        occupation: false,
        employer: false,
        monthlyIncome: false,
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
        gender: draft.gender || undefined,
        birthDate: draft.birthDate || undefined,
        placeOfBirth: draft.placeOfBirth || undefined,
        nationality: draft.nationality || undefined,
        homeOwnership: draft.homeOwnership || undefined,
        mobilePhone1: draft.mobilePhone1 || undefined,
        email: draft.email || undefined,
        civilStatus: draft.civilStatus || undefined,
        occupation: draft.occupation || undefined,
        employer: draft.employer || undefined,
        monthlyIncome: draft.monthlyIncome.trim() ? Number(draft.monthlyIncome) : undefined,
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
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Gender <FieldTooltip text="Client's gender." />
              </Label>
              <FieldLockToggle unlocked={unlocked.gender} onToggle={() => toggleUnlock('gender')} />
            </div>
            <Select value={draft.gender} onValueChange={(v) => setDraft({ ...draft, gender: v })} disabled={!unlocked.gender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Birth Date <FieldTooltip text="Client's date of birth." />
              </Label>
              <FieldLockToggle unlocked={unlocked.birthDate} onToggle={() => toggleUnlock('birthDate')} />
            </div>
            <Input
              type="date"
              value={draft.birthDate}
              onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })}
              disabled={!unlocked.birthDate}
            />
            {computeAge(draft.birthDate) !== null && (
              <p className="text-xs text-muted-foreground">Age: {computeAge(draft.birthDate)}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Place of Birth <FieldTooltip text="Client's place of birth." />
              </Label>
              <FieldLockToggle unlocked={unlocked.placeOfBirth} onToggle={() => toggleUnlock('placeOfBirth')} />
            </div>
            <Input
              value={draft.placeOfBirth}
              onChange={(e) => setDraft({ ...draft, placeOfBirth: e.target.value })}
              disabled={!unlocked.placeOfBirth}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Nationality <FieldTooltip text="Client's nationality." />
              </Label>
              <FieldLockToggle unlocked={unlocked.nationality} onToggle={() => toggleUnlock('nationality')} />
            </div>
            <Input
              value={draft.nationality}
              onChange={(e) => setDraft({ ...draft, nationality: e.target.value })}
              disabled={!unlocked.nationality}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Home Ownership <FieldTooltip text="Client's home ownership status." />
              </Label>
              <FieldLockToggle unlocked={unlocked.homeOwnership} onToggle={() => toggleUnlock('homeOwnership')} />
            </div>
            <Select
              value={draft.homeOwnership}
              onValueChange={(v) => setDraft({ ...draft, homeOwnership: v })}
              disabled={!unlocked.homeOwnership}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Owned">Owned</SelectItem>
                <SelectItem value="Renting">Renting</SelectItem>
                <SelectItem value="Living with family">Living with family</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Occupation <FieldTooltip text="Client's job title/occupation." />
              </Label>
              <FieldLockToggle unlocked={unlocked.occupation} onToggle={() => toggleUnlock('occupation')} />
            </div>
            <Input
              value={draft.occupation}
              onChange={(e) => setDraft({ ...draft, occupation: e.target.value })}
              disabled={!unlocked.occupation}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Employer <FieldTooltip text="Client's current employer." />
              </Label>
              <FieldLockToggle unlocked={unlocked.employer} onToggle={() => toggleUnlock('employer')} />
            </div>
            <Input
              value={draft.employer}
              onChange={(e) => setDraft({ ...draft, employer: e.target.value })}
              disabled={!unlocked.employer}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Monthly Income <FieldTooltip text="Client's gross monthly income." />
              </Label>
              <FieldLockToggle unlocked={unlocked.monthlyIncome} onToggle={() => toggleUnlock('monthlyIncome')} />
            </div>
            <NumberInput
              min="0"
              value={draft.monthlyIncome}
              onChange={(e) => setDraft({ ...draft, monthlyIncome: e.target.value })}
              disabled={!unlocked.monthlyIncome}
            />
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
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Risk &amp; Payment Summary</CardTitle>
        </div>
        {summary && <Badge variant={RISK_BADGE_VARIANT[summary.riskLevel]}>{RISK_LEVEL_LABEL[summary.riskLevel]}</Badge>}
      </CardHeader>
      <CardContent className="flex-1 space-y-2 p-4 pt-0">
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

interface CoBorrowerDraft {
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
  emailAddress: string;
  relationship: string;
  employer: string;
}

const EMPTY_CO_BORROWER_DRAFT: CoBorrowerDraft = {
  firstName: '',
  middleName: '',
  lastName: '',
  phoneNumber: '',
  emailAddress: '',
  relationship: '',
  employer: '',
};

function draftFromCoBorrower(cb: CoBorrower): CoBorrowerDraft {
  return {
    firstName: cb.firstName,
    middleName: cb.middleName ?? '',
    lastName: cb.lastName,
    phoneNumber: cb.phoneNumber ?? '',
    emailAddress: cb.emailAddress ?? '',
    relationship: cb.relationship ?? '',
    employer: cb.employer ?? '',
  };
}

function addressDraftFromCoBorrower(cb: CoBorrower): AddressDraft {
  const addr = cb.addresses[0];
  return addr
    ? {
        houseUnitNumber: addr.houseUnitNumber ?? '',
        street: addr.street ?? '',
        barangay: addr.barangay ?? '',
        cityMunicipality: addr.cityMunicipality ?? '',
        province: addr.province ?? '',
        zipCode: addr.zipCode ?? '',
      }
    : emptyAddressDraft();
}

function formatCoBorrowerAddress(cb: CoBorrower): string {
  const addr = cb.addresses[0];
  if (!addr) return '-';
  return (
    [addr.houseUnitNumber, addr.street, addr.barangay, addr.cityMunicipality, addr.province, addr.zipCode].filter(Boolean).join(', ') || '-'
  );
}

/** 2026-07-25 - shows this client's co-borrower (ADR-015: per-Borrower, applies to every one of
 * their loans) sourced from whichever loan application named one. Deliberately edit-only once a
 * co-borrower exists - CRM decision (2026-07-25): a client's co-borrower must always be traceable
 * back to what was verified on an application, so staff correct/replace the existing record
 * in place (e.g. when the person named at intake doesn't pass verification) rather than adding
 * an unrelated second one. "Add" only appears while none exists yet - for older applications
 * that never captured a co-borrower, or clients created without one. */
function CoBorrowersCard({ borrowerId }: { borrowerId: string }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<CoBorrowerDraft>({ ...EMPTY_CO_BORROWER_DRAFT });
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['co-borrowers', borrowerId],
    queryFn: () => apiClient.get<{ items: CoBorrower[] }>(`/borrowers/${borrowerId}/co-borrowers`),
  });
  const coBorrowers = query.data?.items ?? [];
  const existing = coBorrowers[0] ?? null;

  const openDialog = () => {
    setDraft(existing ? draftFromCoBorrower(existing) : { ...EMPTY_CO_BORROWER_DRAFT });
    setAddressDraft(existing ? addressDraftFromCoBorrower(existing) : emptyAddressDraft());
    setSubmitError(null);
    setEditOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: draft.firstName.trim(),
        middleName: draft.middleName.trim() || undefined,
        lastName: draft.lastName.trim(),
        phoneNumber: draft.phoneNumber.trim() || undefined,
        emailAddress: draft.emailAddress.trim() || undefined,
        relationship: draft.relationship.trim() || undefined,
        employer: draft.employer.trim() || undefined,
        addresses: Object.values(addressDraft).some((v) => v.trim()) ? [addressDraft] : undefined,
      };
      return existing
        ? apiClient.patch<CoBorrower>(`/co-borrowers/${existing.id}`, payload)
        : apiClient.post<CoBorrower>('/co-borrowers', { ...payload, borrowerId });
    },
    onSuccess: () => {
      setEditOpen(false);
      setSubmitError(null);
      void queryClient.invalidateQueries({ queryKey: ['co-borrowers', borrowerId] });
    },
    onError: (error: unknown) => {
      setSubmitError(error instanceof ApiError ? error.message : 'Could not reach the server. Check your connection and try again.');
    },
  });

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Co-Borrower</CardTitle>
        </div>
        <Button size="sm" onClick={openDialog}>
          {existing ? (
            <>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </>
          ) : (
            <>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Co-Borrower
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {query.isLoading ? (
          <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>
        ) : !existing ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No co-borrower on record for this client.</p>
        ) : (
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">{existing.fullName}</p>
            <p className="mb-2.5 text-xs text-muted-foreground">{existing.relationship || 'Relationship not set'}</p>
            <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="text-right font-medium">{existing.phoneNumber ? formatMobileNumber(existing.phoneNumber) : '-'}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-right font-medium">{existing.emailAddress ?? '-'}</dd>
              <dt className="text-muted-foreground">Employer</dt>
              <dd className="text-right font-medium">{existing.employer ?? '-'}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-right font-medium">{formatCoBorrowerAddress(existing)}</dd>
            </dl>
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{existing ? 'Edit Co-Borrower' : 'Add Co-Borrower'}</DialogTitle>
            <DialogDescription>Attaches to this client directly - applies to every one of their loans, not just one.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                First Name<span className="text-destructive"> *</span>
              </Label>
              <Input value={draft.firstName} onChange={(e) => setDraft((prev) => ({ ...prev, firstName: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Last Name<span className="text-destructive"> *</span>
              </Label>
              <Input value={draft.lastName} onChange={(e) => setDraft((prev) => ({ ...prev, lastName: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Middle Name</Label>
              <Input value={draft.middleName} onChange={(e) => setDraft((prev) => ({ ...prev, middleName: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <PhoneInput
                value={draft.phoneNumber}
                onChange={(e) => setDraft((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="09XX XXX XXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={draft.emailAddress} onChange={(e) => setDraft((prev) => ({ ...prev, emailAddress: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <Input value={draft.relationship} onChange={(e) => setDraft((prev) => ({ ...prev, relationship: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Employer</Label>
              <Input value={draft.employer} onChange={(e) => setDraft((prev) => ({ ...prev, employer: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
            <PsgcAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
          </div>
          {submitError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {submitError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!draft.firstName.trim() || !draft.lastName.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : existing ? 'Save Changes' : 'Add Co-Borrower'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** A loan account is "active" for the "one active loan at a time" rule if it hasn't reached any closed state yet. */
const ACTIVE_LOAN_STATUSES: ReadonlySet<LoanAccountStatus> = new Set(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ACTIVE_IN_ARREARS']);

// 2026-07-25 (user request, same pattern as LoanDetailPage's cardOrder): everything below the
// client info header is drag-to-reorder - each staff member's own arrangement, saved per-user in
// localStorage (same key style as the sidebar-collapse preference in AppLayout.tsx), so one
// officer's preferred layout doesn't affect anyone else logged into the same shared machine.
const DEFAULT_CARD_ORDER = ['loanApplications', 'coBorrower', 'riskSummary', 'loanHistory', 'activityTimeline', 'recentActivity'];
const CARD_ORDER_KEY_PREFIX = 'lms.clientProfileCardOrder';
function cardOrderKey(userId: string): string {
  return `${CARD_ORDER_KEY_PREFIX}:${userId}`;
}

function RealClientProfileView({ borrowerId }: { borrowerId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessLoanApplications, currentAccount } = useRole();
  const [editOpen, setEditOpen] = React.useState(false);
  const [createApplicationOpen, setCreateApplicationOpen] = React.useState(false);
  const [createLoanAccountOpen, setCreateLoanAccountOpen] = React.useState(false);
  const [cardOrder, setCardOrder] = React.useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CARD_ORDER;
    try {
      const saved = window.localStorage.getItem(cardOrderKey(currentAccount.id));
      if (!saved) return DEFAULT_CARD_ORDER;
      const parsed = JSON.parse(saved) as string[];
      const isValid = Array.isArray(parsed) && DEFAULT_CARD_ORDER.every((id) => parsed.includes(id)) && parsed.length === DEFAULT_CARD_ORDER.length;
      return isValid ? parsed : DEFAULT_CARD_ORDER;
    } catch {
      return DEFAULT_CARD_ORDER;
    }
  });
  React.useEffect(() => {
    window.localStorage.setItem(cardOrderKey(currentAccount.id), JSON.stringify(cardOrder));
  }, [cardOrder, currentAccount.id]);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCardOrder((order) => {
      const oldIndex = order.indexOf(String(active.id));
      const newIndex = order.indexOf(String(over.id));
      return oldIndex === -1 || newIndex === -1 ? order : arrayMove(order, oldIndex, newIndex);
    });
  };

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
        Real client, migrated from legacy data (CP12) - details, loan history, and Create Loan Account below are live.
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

      {(() => {
        // 2026-07-25: everything from here to Recent Activity is drag-to-reorder (see cardOrder
        // state above) - each section's JSX lives as one entry in this map so it can be rendered
        // in whatever order the current user saved, instead of a fixed sequence.
        const cardsById: Record<string, React.ReactNode> = {};

        cardsById.loanApplications = (
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
        );

        cardsById.coBorrower = <CoBorrowersCard borrowerId={borrowerId} />;

        cardsById.riskSummary = <RiskPaymentSummaryCard borrowerId={borrowerId} />;

        cardsById.loanHistory = (
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
                  {(() => {
                    // Not yet Activated - every balance column is genuinely 0 only because the
                    // amortization schedule hasn't been generated yet, not because there's no
                    // obligation. "—" avoids that reading as "nothing owed"/"fully paid". Uses
                    // loan.balances (the remaining balance), not loan.principalAmount (the
                    // original loan amount) - see the Principal Balance display fix.
                    const notYetActivated = loan.status === 'PENDING_APPROVAL' || loan.status === 'APPROVED';
                    return (
                      <>
                        <TableCell className="text-right">{notYetActivated ? '—' : formatPeso(num(loan.balances.principalBalance))}</TableCell>
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
        );

        // 2026-07-26 (user request): the client-level Attachments card was removed entirely - its
        // documents (plus the merged-in Loan Application ones) already surface on the Loan
        // Account's own Attachments card (LoanDetailPage.tsx), so this was pure duplication with
        // no distinct capability worth keeping. Profile picture upload (above) is unaffected -
        // ApplicantAvatar has its own independent `/attachments?ownerType=BORROWER` query, not tied
        // to this card's rendering.

        cardsById.activityTimeline = (
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-sm">Activity Timeline</CardTitle>
          <CardDescription className="text-xs">Log of all actions taken on this client profile by loan officers</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ProfileActivityTimeline profileType="BORROWER" profileId={borrowerId} showDetailsToggle={false} />
        </CardContent>
      </Card>
        );

        cardsById.recentActivity = <RecentActivityPanel label="Client Profile" entityId={borrowerId} />;

        // 2026-07-26: a staff member's already-saved localStorage cardOrder may still list a
        // since-removed card id (e.g. 'attachments') - filter down to whatever's actually present
        // so it doesn't render an empty draggable slot (same pattern as LoanApplicationDetailPage).
        const visibleCardOrder = cardOrder.filter((id) => cardsById[id] !== undefined);

        return (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
            <SortableContext items={visibleCardOrder} strategy={verticalListSortingStrategy}>
              {visibleCardOrder.map((id) => (
                <SortableSection
                  key={id}
                  id={id}
                  // 2026-07-26 (user request): Loan History's 8-column balance table was cramped
                  // into a half-width column, forcing horizontal scroll - full-width gives it room
                  // to breathe, same reasoning as Activity Timeline/Recent Activity below.
                  fullWidth={id === 'loanHistory' || id === 'activityTimeline' || id === 'recentActivity'}
                >
                  {cardsById[id]}
                </SortableSection>
              ))}
            </SortableContext>
          </DndContext>
        );
      })()}
      </div>

      <RealEditClientDialog open={editOpen} onOpenChange={setEditOpen} borrower={borrower} />

      <Dialog open={createApplicationOpen} onOpenChange={setCreateApplicationOpen}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-y-auto">
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
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Loan Account</DialogTitle>
            <DialogDescription>For {borrower.fullName}. Review before submitting.</DialogDescription>
          </DialogHeader>
          {createLoanAccountOpen && (
            <LoanAccountForm
              lockedBorrower={borrower}
              prefillTermMonths={approvedApplicationAwaitingLoanAccount?.requestedTermMonths}
              sourceApplicationId={approvedApplicationAwaitingLoanAccount?.id}
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
