import * as React from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Landmark, Lock, RotateCcw, ShieldCheck, UserPlus, XCircle } from 'lucide-react';
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
import { NumberInput } from '@/components/NumberInput';
import { PhoneInput } from '@/components/PhoneInput';
import { GroupedDigitsInput } from '@/components/GroupedDigitsInput';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { RoleAbbr } from '@/components/RoleAbbr';
import { AttachmentsPanel } from '@/components/AttachmentsPanel';
import { ProfileNotesPanel } from '@/components/ProfileNotesPanel';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { type AddressDraft, PsgcAddressPicker } from '@/components/PsgcAddressPicker';
import { ProfileActivityTimeline } from '@/components/ProfileActivityTimeline';
import { TermTip } from '@/components/TermTip';
import { LoanAccountForm } from '@/pages/LoanAccountCreatePage';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, fetchAllPages } from '@/lib/apiClient';
import { classifyProductType } from '@/lib/productTypeClassification';
import { productTypeLabel, useProductTypeLabels } from '@/lib/productTypeLabels';
import type {
  CreditBureauResult,
  LoanApplication,
  SubmitReviewReportRequest,
  UnderwriterRecommendation,
  UnderwriterRiskGrade,
  UpdateLoanApplicationRequest,
} from '@/lib/loanApplicationApiTypes';
import type { Borrower, LoanProduct } from '@/lib/loanApiTypes';
import type { User } from '@/lib/userApiTypes';
import { STATUS_DISPLAY_LABEL } from '@/lib/loanApplicationStatusLabels';
import { formatDate, formatMobileNumber, formatPeso, toProperCase } from '@/lib/utils';

/** Best-effort split of a free-text full name into first/middle/last for the create-client
 * form's initial prefill - staff can still edit every field before submitting, so an imperfect
 * split (e.g. multi-word surnames) is never silently wrong, just a starting point. */
function splitApplicantName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1] };
}

/** The intake form stores the co-borrower as one combined string, e.g. "Jane Doe (spouse)" - this
 * splits it back into a name and relationship for the Create Client Profile review form. */
function parseCoBorrowerName(coBorrowerName: string): { name: string; relationship: string } {
  const match = coBorrowerName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1].trim(), relationship: match[2].trim() };
  return { name: coBorrowerName.trim(), relationship: '' };
}

/**
 * Prefilled from the APPROVED application's own fields, including gender, civil status, present
 * address, employer, and monthly income (2026-07-14: `POST /borrowers` gained `addresses` and
 * `incomeDetail.monthlyIncome` support specifically so this dialog could stop dropping them).
 * Everything the application captured is editable here before creating the real record. If the
 * application recorded a co-borrower, offers to also create that person's real `CoBorrower` record
 * via `POST /co-borrowers` (ADR-015 leaves the borrower<->co-borrower linking mechanism open, so
 * this only creates the standalone person record, same as that endpoint always has).
 */
function CreateClientProfileDialog({
  open,
  onOpenChange,
  application,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: LoanApplication;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialSplit = React.useMemo(() => splitApplicantName(application.applicantName), [application.applicantName]);
  const [firstName, setFirstName] = React.useState(initialSplit.firstName);
  const [middleName, setMiddleName] = React.useState(initialSplit.middleName);
  const [lastName, setLastName] = React.useState(initialSplit.lastName);
  const [gender, setGender] = React.useState(application.gender ?? '');
  const [civilStatus, setCivilStatus] = React.useState(application.civilStatus ?? '');
  const [birthDate, setBirthDate] = React.useState(application.birthDate ? application.birthDate.slice(0, 10) : '');
  const [placeOfBirth, setPlaceOfBirth] = React.useState(application.placeOfBirth ?? '');
  const [nationality, setNationality] = React.useState(application.nationality ?? '');
  const [homeOwnership, setHomeOwnership] = React.useState(application.homeOwnership ?? '');
  const [mobilePhone1, setMobilePhone1] = React.useState(application.mobilePhone ?? '');
  const [email, setEmail] = React.useState(application.email ?? '');
  const [employer, setEmployer] = React.useState(application.employer ?? '');
  const [occupation, setOccupation] = React.useState(application.occupation ?? '');
  const [officeAddress, setOfficeAddress] = React.useState(application.officeAddress ?? '');
  const [monthlyIncome, setMonthlyIncome] = React.useState(String(application.monthlyIncome ?? ''));
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>({
    houseUnitNumber: application.houseUnitNumber ?? '',
    street: application.street ?? '',
    barangay: application.barangay ?? '',
    cityMunicipality: application.cityMunicipality ?? '',
    province: application.province ?? '',
    zipCode: application.zipCode ?? '',
  });
  const [tinNumber, setTinNumber] = React.useState(application.tinNumber ?? '');
  const [sssNumber, setSssNumber] = React.useState(application.sssNumber ?? '');
  const [dependants, setDependants] = React.useState(application.dependants);
  const [reference1Name, setReference1Name] = React.useState(application.reference1Name ?? '');
  const [reference1Mobile, setReference1Mobile] = React.useState(application.reference1Mobile ?? '');
  const [reference2Name, setReference2Name] = React.useState(application.reference2Name ?? '');
  const [reference2Mobile, setReference2Mobile] = React.useState(application.reference2Mobile ?? '');
  const [note, setNote] = React.useState(application.note ?? '');

  const coBorrowerParsed = React.useMemo(
    () => (application.coBorrowerName ? parseCoBorrowerName(application.coBorrowerName) : null),
    [application.coBorrowerName],
  );
  const coBorrowerSplit = React.useMemo(
    () => (coBorrowerParsed ? splitApplicantName(coBorrowerParsed.name) : null),
    [coBorrowerParsed],
  );
  const [includeCoBorrower, setIncludeCoBorrower] = React.useState(Boolean(application.coBorrowerName));
  const [coBorrowerFirstName, setCoBorrowerFirstName] = React.useState(coBorrowerSplit?.firstName ?? '');
  const [coBorrowerLastName, setCoBorrowerLastName] = React.useState(coBorrowerSplit?.lastName ?? '');
  const [coBorrowerRelationship, setCoBorrowerRelationship] = React.useState(coBorrowerParsed?.relationship ?? '');
  const [coBorrowerEmployer, setCoBorrowerEmployer] = React.useState(application.coBorrowerEmployer ?? '');

  React.useEffect(() => {
    if (!open) return;
    const split = splitApplicantName(application.applicantName);
    setFirstName(split.firstName);
    setMiddleName(split.middleName);
    setLastName(split.lastName);
    setGender(application.gender ?? '');
    setCivilStatus(application.civilStatus ?? '');
    setBirthDate(application.birthDate ? application.birthDate.slice(0, 10) : '');
    setPlaceOfBirth(application.placeOfBirth ?? '');
    setNationality(application.nationality ?? '');
    setHomeOwnership(application.homeOwnership ?? '');
    setMobilePhone1(application.mobilePhone ?? '');
    setEmail(application.email ?? '');
    setEmployer(application.employer ?? '');
    setOccupation(application.occupation ?? '');
    setOfficeAddress(application.officeAddress ?? '');
    setMonthlyIncome(String(application.monthlyIncome ?? ''));
    setAddressDraft({
      houseUnitNumber: application.houseUnitNumber ?? '',
      street: application.street ?? '',
      barangay: application.barangay ?? '',
      cityMunicipality: application.cityMunicipality ?? '',
      province: application.province ?? '',
      zipCode: application.zipCode ?? '',
    });
    setTinNumber(application.tinNumber ?? '');
    setSssNumber(application.sssNumber ?? '');
    setDependants(application.dependants);
    setReference1Name(application.reference1Name ?? '');
    setReference1Mobile(application.reference1Mobile ?? '');
    setReference2Name(application.reference2Name ?? '');
    setReference2Mobile(application.reference2Mobile ?? '');
    setNote(application.note ?? '');

    const parsed = application.coBorrowerName ? parseCoBorrowerName(application.coBorrowerName) : null;
    const coSplit = parsed ? splitApplicantName(parsed.name) : null;
    setIncludeCoBorrower(Boolean(application.coBorrowerName));
    setCoBorrowerFirstName(coSplit?.firstName ?? '');
    setCoBorrowerLastName(coSplit?.lastName ?? '');
    setCoBorrowerRelationship(parsed?.relationship ?? '');
    setCoBorrowerEmployer(application.coBorrowerEmployer ?? '');
  }, [open, application]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const references = [
        reference1Name.trim() ? { firstName: reference1Name.trim(), phoneNumber: reference1Mobile.trim() || undefined } : null,
        reference2Name.trim() ? { firstName: reference2Name.trim(), phoneNumber: reference2Mobile.trim() || undefined } : null,
      ].filter((r): r is { firstName: string; phoneNumber: string | undefined } => r !== null);

      const borrower = await apiClient.post<Borrower>('/borrowers', {
        branchId: application.branchId,
        sourceApplicationId: application.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
        gender: gender || undefined,
        civilStatus: civilStatus || undefined,
        birthDate: birthDate || undefined,
        placeOfBirth: placeOfBirth.trim() || undefined,
        nationality: nationality.trim() || undefined,
        homeOwnership: homeOwnership || undefined,
        mobilePhone1: mobilePhone1.trim() || undefined,
        email: email.trim() || undefined,
        dependants: dependants && dependants.length > 0 ? dependants : undefined,
        note: note.trim() || undefined,
        incomeDetail:
          employer.trim() || occupation.trim() || officeAddress.trim() || Number(monthlyIncome) > 0
            ? {
                employerName: employer.trim() || undefined,
                position: occupation.trim() || undefined,
                employerAddress: officeAddress.trim() || undefined,
                monthlyIncome: Number(monthlyIncome) > 0 ? Number(monthlyIncome) : undefined,
              }
            : undefined,
        governmentId:
          tinNumber.trim() || sssNumber.trim() ? { tinNumber: tinNumber.trim() || undefined, sssNumber: sssNumber.trim() || undefined } : undefined,
        characterReferences: references.length > 0 ? references : undefined,
        addresses: Object.values(addressDraft).some((v) => v.trim()) ? [addressDraft] : undefined,
      });

      // Best-effort: capturing the co-borrower is a separate write from creating the client
      // profile itself - a failure here must never block navigation to the newly-created client.
      if (includeCoBorrower && coBorrowerFirstName.trim() && coBorrowerLastName.trim()) {
        try {
          await apiClient.post('/co-borrowers', {
            firstName: coBorrowerFirstName.trim(),
            lastName: coBorrowerLastName.trim(),
            relationship: coBorrowerRelationship.trim() || undefined,
            employer: coBorrowerEmployer.trim() || undefined,
          });
        } catch {
          // Swallowed - see comment above.
        }
      }

      return borrower;
    },
    onSuccess: (borrower) => {
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] });
      navigate(`/clients/${borrower.id}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Client Profile</DialogTitle>
          <DialogDescription>
            Prefilled from {application.applicantName}'s approved application. Review before creating - this becomes the
            client's real record.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>First Name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Last Name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Middle Name</Label>
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Civil Status</Label>
            <Select value={civilStatus} onValueChange={setCivilStatus}>
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
            <Label>Date of Birth</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Place of Birth</Label>
            <Input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nationality</Label>
            <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Home Ownership</Label>
            <Select value={homeOwnership} onValueChange={setHomeOwnership}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Owned">Owned</SelectItem>
                <SelectItem value="Rented">Rented</SelectItem>
                <SelectItem value="Others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Contact Number</Label>
            <PhoneInput value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} placeholder="09XX XXX XXXX" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Present Address</p>
          <PsgcAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 border-t pt-3">
          <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment</div>
          <div className="space-y-1.5">
            <Label>Employer</Label>
            <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Occupation</Label>
            <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Office Address</Label>
            <Input value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Income</Label>
            <NumberInput min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>TIN</Label>
            <GroupedDigitsInput value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>SSS No.</Label>
            <GroupedDigitsInput value={sssNumber} onChange={(e) => setSssNumber(e.target.value)} />
          </div>
        </div>

        {dependants && dependants.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dependants</p>
            {dependants.map((dep, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Input
                  value={dep.name}
                  onChange={(e) => setDependants((prev) => (prev ?? []).map((d, j) => (j === i ? { ...d, name: e.target.value } : d)))}
                  placeholder="Name"
                />
                <Input
                  value={dep.age ?? ''}
                  onChange={(e) => setDependants((prev) => (prev ?? []).map((d, j) => (j === i ? { ...d, age: e.target.value } : d)))}
                  placeholder="Age"
                />
                <Input
                  value={dep.relationship ?? ''}
                  onChange={(e) =>
                    setDependants((prev) => (prev ?? []).map((d, j) => (j === i ? { ...d, relationship: e.target.value } : d)))
                  }
                  placeholder="Relationship"
                />
              </div>
            ))}
          </div>
        )}

        {(reference1Name || reference2Name) && (
          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
            <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Character References</p>
            <div className="space-y-1.5">
              <Label>1st Reference Name</Label>
              <Input value={reference1Name} onChange={(e) => setReference1Name(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>1st Reference Contact Number</Label>
              <Input value={reference1Mobile} onChange={(e) => setReference1Mobile(e.target.value)} placeholder="09XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>2nd Reference Name</Label>
              <Input value={reference2Name} onChange={(e) => setReference2Name(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>2nd Reference Contact Number</Label>
              <Input value={reference2Mobile} onChange={(e) => setReference2Mobile(e.target.value)} placeholder="09XX XXX XXXX" />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Note</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>

        {coBorrowerParsed && (
          <div className="space-y-3 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={includeCoBorrower} onChange={(e) => setIncludeCoBorrower(e.target.checked)} />
              Also create this application's co-borrower ({coBorrowerParsed.name})
            </label>
            {includeCoBorrower && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Co-Borrower First Name</Label>
                  <Input value={coBorrowerFirstName} onChange={(e) => setCoBorrowerFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Co-Borrower Last Name</Label>
                  <Input value={coBorrowerLastName} onChange={(e) => setCoBorrowerLastName(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Relationship to Applicant</Label>
                  <Input value={coBorrowerRelationship} onChange={(e) => setCoBorrowerRelationship(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Co-Borrower Employer</Label>
                  <Input value={coBorrowerEmployer} onChange={(e) => setCoBorrowerEmployer(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-md border bg-secondary/30 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            From the application (reference only - add via "Edit Client Details" after creating)
          </p>
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-muted-foreground">Age</dt>
            <dd className="text-right">{application.age ?? '-'}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd className="text-right">{toProperCase(application.address) || '-'}</dd>
            <dt className="text-muted-foreground">Employer</dt>
            <dd className="text-right">{application.employer ?? '-'}</dd>
            <dt className="text-muted-foreground">Monthly income</dt>
            <dd className="text-right">{application.monthlyIncome !== null ? formatPeso(application.monthlyIncome) : '-'}</dd>
          </dl>
        </div>

        {createMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {createMutation.error instanceof Error ? createMutation.error.message : 'Could not create the client profile.'}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!firstName.trim() || !lastName.trim() || createMutation.isPending}
          >
            Create Client Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const LOAN_TYPE_OPTIONS = ['Business Loan', 'Salary Loan', 'Seafarer Loan'] as const;
type LoanTypeOption = (typeof LOAN_TYPE_OPTIONS)[number];

/** Mirrors LoanApplicationsPage's STATUS_BADGE_VARIANT - kept local since this file doesn't
 * otherwise import from that page. */
const DETAIL_STATUS_BADGE_VARIANT: Record<LoanApplication['status'], 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PREAPPROVED: 'secondary',
  PREDECLINED: 'warning',
  UNDER_REVIEW: 'secondary',
  PRE_APPROVAL: 'secondary',
  APPROVED: 'success',
  DECLINED: 'destructive',
};

/**
 * 2026-07-16: previously a hand-maintained whitelist confirmed with the business 2026-07-10 - it
 * went stale (new active product classes like SML-Max/SML-Lite/SML-Deluxe etc. never appeared
 * here, and some it did list - e.g. SML-Quick Cash - had drifted out of sync with which products
 * are actually still active). Replaced with a live derivation from the same `/loan-products`
 * catalog + `classifyProductType` grouping the Create Loan Account form already uses, so this can
 * never go stale again. Still still-real-but-legacy products marked "discontinued" (no longer
 * offered to new applicants, but still assignable so existing loans under them stay usable) - kept
 * as a small static hint set rather than re-deriving it (nothing in the product catalog encodes
 * that distinction), so a name only needs to be added here if/when the business discontinues it.
 */
const KNOWN_DISCONTINUED_PRODUCT_NAMES = new Set([
  'SL-Snap-A',
  'SL-Snap-B',
  'SL-Online',
  'SL-Online_New',
  'SL-Lazada',
  'SL-Lazada -New',
  'SL-Lazada-Promo',
  'SML-Kaborrow',
  'SML-PDC',
  'SML-Co-Borrower Allotment',
  'SML-Self Allotment',
]);

function findLoanTypeForProductName(productName: string): LoanTypeOption | null {
  const type = classifyProductType(productName);
  return (LOAN_TYPE_OPTIONS as readonly string[]).includes(type) ? (type as LoanTypeOption) : null;
}

/** One pass/fail row of the decision-scoring breakdown - mirrors the backend's
 * `PreQualificationCheck` shape exactly (label + detail text already composed server-side). */
function DecisionScoringRow({ passed, label, detail }: { passed: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      {passed ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

/**
 * "Create Loan Account" dialog - moved here from the Client Profile page (2026-07-14) so it's
 * gated per-application (visible once this application's client exists, clickable once this
 * specific application is Approved) rather than per-client. Wraps the same full `LoanAccountForm`
 * used by the standalone `/loans/new` page (MIS Nomer's origination-fees/net-proceeds/schedule-
 * preview build) - copied here as dialog content rather than a stripped-down form, so staff get
 * the exact same computations regardless of which entry point they used.
 */
function CreateLoanAccountDialog({
  open,
  onOpenChange,
  borrower,
  requestedTermMonths,
  applicationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrower: Borrower;
  requestedTermMonths?: number;
  applicationId: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Loan Account</DialogTitle>
          <DialogDescription>From {borrower.fullName}&apos;s approved application. Review before submitting.</DialogDescription>
        </DialogHeader>
        {open && (
          <LoanAccountForm
            lockedBorrower={borrower}
            prefillTermMonths={requestedTermMonths}
            sourceApplicationId={applicationId}
            showChrome={false}
            onCreated={(loan) => {
              onOpenChange(false);
              queryClient.invalidateQueries({ queryKey: ['loan-accounts', 'all'] });
              queryClient.invalidateQueries({ queryKey: ['loan-application', 'all'] });
              navigate(`/loans/${loan.id}`);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

const UNDERWRITER_RISK_GRADE_OPTIONS: { value: UnderwriterRiskGrade; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const UNDERWRITER_RECOMMENDATION_OPTIONS: { value: UnderwriterRecommendation; label: string }[] = [
  { value: 'APPROVE', label: 'Approve' },
  { value: 'APPROVE_WITH_CONDITIONS', label: 'Approve with conditions' },
  { value: 'DECLINE', label: 'Decline' },
];

const RISK_GRADE_BADGE_VARIANT: Record<UnderwriterRiskGrade, 'success' | 'warning' | 'destructive'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'destructive',
};

/** General lending-industry rule of thumb (not an Easycash-specific policy, and not a hard
 * pass/fail gate here - purely informational context for the underwriter, same posture as every
 * other advisory figure on this card). */
function dtiBandClass(dtiPercent: number): string {
  if (dtiPercent <= 30) return 'text-success';
  if (dtiPercent <= 40) return 'text-warning';
  return 'text-destructive';
}

/**
 * Underwriting (2026-07-20 rework, user request - "gusto ko mag karoon ng underwriter features",
 * consolidating the old separate "Risk Management Summary" and "Review Report" cards into one).
 * Combines:
 * - The system's PREAPPROVED/PREDECLINED decision-scoring breakdown (age/income/distance, each
 *   pass/fail) plus a Debt-to-Income ratio derived from the same estimated amortization - both
 *   still purely advisory context, never a gate.
 * - The editable inputs that feed pre-qualification (income, credit score, properties owned) -
 *   editable any time by canEditRisk, same as the old RiskManagementSummaryCard.
 * - The CRM/credit-risk team's Review Report (CI notes, Credit Bureau result/score, document
 *   checklist) - editable only while UNDER_REVIEW by canEditReview, same as the old
 *   ReviewReportCard.
 * - New underwriter fields (risk grade, recommendation + conditions, collateral, co-maker
 *   assessment) - same UNDER_REVIEW-only editability as the Review Report, since they're findings
 *   from that same review pass. All advisory: the officer's real Approve/Decline call below is
 *   what actually counts, same disclosure as everything else on this card.
 */
function UnderwritingCard({
  application,
  canEditRisk,
  canEditReview,
  showReview,
}: {
  application: LoanApplication;
  canEditRisk: boolean;
  canEditReview: boolean;
  /** Review Report + Underwriter Assessment only make sense once a manual review has actually
   * started - matches the old ReviewReportCard's own visibility rule (Under Review, Pre Approval,
   * or already decided with a report on file). Decision scoring/DTI and the risk-input fields
   * above them stay visible at every stage, unchanged from the old RiskManagementSummaryCard. */
  showReview: boolean;
}) {
  const queryClient = useQueryClient();
  const [editingRisk, setEditingRisk] = React.useState(false);
  const [monthlyIncome, setMonthlyIncome] = React.useState(String(application.monthlyIncome ?? ''));
  const [creditScore, setCreditScore] = React.useState(String(application.creditScore ?? ''));
  const [propertiesOwned, setPropertiesOwned] = React.useState(application.propertiesOwned.join(', '));

  const resetRiskDraft = () => {
    setMonthlyIncome(String(application.monthlyIncome ?? ''));
    setCreditScore(String(application.creditScore ?? ''));
    setPropertiesOwned(application.propertiesOwned.join(', '));
  };

  const saveRiskMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<LoanApplication>(`/loan-applications/${application.id}`, {
        monthlyIncome: Number(monthlyIncome) > 0 ? Number(monthlyIncome) : undefined,
        creditScore: Number(creditScore) || undefined,
        propertiesOwned: propertiesOwned
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      } satisfies UpdateLoanApplicationRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] });
      setEditingRisk(false);
    },
  });

  const report = application.reviewReport;
  const [ciNotes, setCiNotes] = React.useState(report?.ciNotes ?? '');
  const [creditBureauResult, setCreditBureauResult] = React.useState<CreditBureauResult | ''>(report?.creditBureauResult ?? '');
  const [creditBureauScore, setCreditBureauScore] = React.useState(report?.creditBureauScore ?? '');
  const [checkedDocuments, setCheckedDocuments] = React.useState<string[]>(report?.checkedDocuments ?? []);
  const [underwriterRiskGrade, setUnderwriterRiskGrade] = React.useState<UnderwriterRiskGrade | ''>(report?.underwriterRiskGrade ?? '');
  const [underwriterRecommendation, setUnderwriterRecommendation] = React.useState<UnderwriterRecommendation | ''>(
    report?.underwriterRecommendation ?? '',
  );
  const [recommendationConditions, setRecommendationConditions] = React.useState(report?.recommendationConditions ?? '');
  const [collateralDescription, setCollateralDescription] = React.useState(report?.collateralDescription ?? '');
  const [collateralValue, setCollateralValue] = React.useState(String(report?.collateralValue ?? ''));
  const [coMakerAssessment, setCoMakerAssessment] = React.useState(report?.coMakerAssessment ?? '');

  const toggleDocument = (doc: string, checked: boolean) => {
    setCheckedDocuments((prev) => (checked ? [...prev, doc] : prev.filter((d) => d !== doc)));
  };

  const saveReviewMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<LoanApplication>(`/loan-applications/${application.id}/review-report`, {
        ciNotes: ciNotes.trim() || undefined,
        creditBureauResult: creditBureauResult || undefined,
        creditBureauScore: creditBureauScore.trim() || undefined,
        checkedDocuments,
        underwriterRiskGrade: underwriterRiskGrade || undefined,
        underwriterRecommendation: underwriterRecommendation || undefined,
        recommendationConditions: recommendationConditions.trim() || undefined,
        collateralDescription: collateralDescription.trim() || undefined,
        collateralValue: Number(collateralValue) > 0 ? Number(collateralValue) : undefined,
        coMakerAssessment: coMakerAssessment.trim() || undefined,
      } satisfies SubmitReviewReportRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] }),
  });

  const breakdown = application.preQualificationBreakdown;
  const dtiPercent =
    breakdown && application.monthlyIncome ? (breakdown.estimatedMonthlyAmortization / application.monthlyIncome) * 100 : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Underwriting
        </CardTitle>
        <CardDescription>
          System pre-qualification, credit investigation, and the underwriter's own risk assessment - all advisory. The officer's
          Approve/Decline decision below is what actually counts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown && (
          <div className="rounded-md border p-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision scoring</p>
            <DecisionScoringRow {...breakdown.checks.age} />
            <DecisionScoringRow {...breakdown.checks.income} />
            <DecisionScoringRow {...breakdown.checks.distance} />
            {dtiPercent !== null && (
              <div className="mt-2 border-t pt-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">Debt-to-Income ratio</p>
                  <TermTip
                    term="DTI"
                    definition="Estimated monthly loan amortization as a share of monthly income. A common lending-industry rule of thumb: under ~30% is comfortable, 30-40% warrants a closer look, above 40% is high - not an Easycash policy threshold, informational only."
                  />
                </div>
                <p className={`text-sm font-semibold ${dtiBandClass(dtiPercent)}`}>{dtiPercent.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  Estimated ₱{breakdown.estimatedMonthlyAmortization.toFixed(2)}/month amortization vs. ₱
                  {application.monthlyIncome!.toFixed(2)} monthly income.
                </p>
              </div>
            )}
          </div>
        )}

        <Separator />

        {saveRiskMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {saveRiskMutation.error instanceof Error ? saveRiskMutation.error.message : 'Could not save these values.'}
          </div>
        )}
        {editingRisk ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monthly income (₱)</Label>
              <NumberInput min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Credit score (from CB report)</Label>
              <NumberInput min="0" max="1000" value={creditScore} onChange={(e) => setCreditScore(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Properties owned</Label>
              <Input
                value={propertiesOwned}
                onChange={(e) => setPropertiesOwned(e.target.value)}
                placeholder="Comma-separated"
              />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Monthly income</dt>
            <dd className="text-right font-medium">
              {application.monthlyIncome !== null ? formatPeso(application.monthlyIncome) : '-'}
            </dd>
            <dt className="text-muted-foreground">Credit score</dt>
            <dd className="text-right font-medium">{application.creditScore ?? '-'}</dd>
            <dt className="text-muted-foreground">Properties owned</dt>
            <dd className="text-right font-medium">
              {application.propertiesOwned.length === 0 ? 'None on record' : application.propertiesOwned.join(', ')}
            </dd>
          </dl>
        )}

        {canEditRisk && (
          <div className="flex items-center gap-2">
            {editingRisk ? (
              <>
                <Button size="sm" disabled={saveRiskMutation.isPending} onClick={() => saveRiskMutation.mutate()}>
                  {saveRiskMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetRiskDraft();
                    setEditingRisk(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditingRisk(true)}>
                Edit
              </Button>
            )}
          </div>
        )}

        {showReview && (
          <>
        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review Report</p>
          <p className="text-xs text-muted-foreground">Credit Investigation, Credit Bureau checking, and document verification.</p>
        </div>

        {saveReviewMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {saveReviewMutation.error instanceof Error ? saveReviewMutation.error.message : 'Could not save the underwriting details.'}
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Credit investigation notes</Label>
          {canEditReview ? (
            <Textarea rows={3} value={ciNotes} onChange={(e) => setCiNotes(e.target.value)} placeholder="Findings from the CI visit or call" />
          ) : (
            <p className="text-sm">{ciNotes || 'None on record.'}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Credit bureau result</Label>
            {canEditReview ? (
              <Select value={creditBureauResult} onValueChange={(v) => setCreditBureauResult(v as CreditBureauResult)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_BUREAU_RESULT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">
                {CREDIT_BUREAU_RESULT_OPTIONS.find((o) => o.value === creditBureauResult)?.label ?? 'Not yet checked'}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Credit bureau score (optional)</Label>
            {canEditReview ? (
              <Input value={creditBureauScore} onChange={(e) => setCreditBureauScore(e.target.value)} />
            ) : (
              <p className="text-sm">{creditBureauScore || '-'}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Document checklist</Label>
          {application.submittedDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents were recorded as submitted at intake.</p>
          ) : (
            <ul className="space-y-1.5">
              {application.submittedDocuments.map((doc) => (
                <li key={doc} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={checkedDocuments.includes(doc)}
                    disabled={!canEditReview}
                    onChange={(e) => toggleDocument(doc, e.target.checked)}
                  />
                  {doc}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Underwriter Assessment</p>
          <p className="text-xs text-muted-foreground">
            The underwriter's own findings from this review - advisory, same as the rest of this report.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Risk grade</Label>
            {canEditReview ? (
              <Select value={underwriterRiskGrade} onValueChange={(v) => setUnderwriterRiskGrade(v as UnderwriterRiskGrade)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {UNDERWRITER_RISK_GRADE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : underwriterRiskGrade ? (
              <div>
                <Badge variant={RISK_GRADE_BADGE_VARIANT[underwriterRiskGrade]}>
                  {UNDERWRITER_RISK_GRADE_OPTIONS.find((o) => o.value === underwriterRiskGrade)?.label}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not yet graded.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recommendation</Label>
            {canEditReview ? (
              <Select
                value={underwriterRecommendation}
                onValueChange={(v) => setUnderwriterRecommendation(v as UnderwriterRecommendation)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {UNDERWRITER_RECOMMENDATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">
                {UNDERWRITER_RECOMMENDATION_OPTIONS.find((o) => o.value === underwriterRecommendation)?.label ?? 'Not yet recommended.'}
              </p>
            )}
          </div>
        </div>

        {(underwriterRecommendation === 'APPROVE_WITH_CONDITIONS' || (!canEditReview && recommendationConditions)) && (
          <div className="space-y-1.5">
            <Label className="text-xs">Conditions</Label>
            {canEditReview ? (
              <Textarea
                rows={2}
                value={recommendationConditions}
                onChange={(e) => setRecommendationConditions(e.target.value)}
                placeholder="e.g. Require a co-maker signature, cap loan amount at ₱50,000"
              />
            ) : (
              <p className="text-sm">{recommendationConditions}</p>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Collateral description</Label>
            {canEditReview ? (
              <Input
                value={collateralDescription}
                onChange={(e) => setCollateralDescription(e.target.value)}
                placeholder="e.g. Motorcycle, OR/CR attached"
              />
            ) : (
              <p className="text-sm">{collateralDescription || 'None on record.'}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Collateral value (₱)</Label>
            {canEditReview ? (
              <NumberInput min="0" value={collateralValue} onChange={(e) => setCollateralValue(e.target.value)} />
            ) : (
              <p className="text-sm">{Number(collateralValue) > 0 ? formatPeso(Number(collateralValue)) : '-'}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Co-maker assessment</Label>
          {canEditReview ? (
            <Textarea
              rows={2}
              value={coMakerAssessment}
              onChange={(e) => setCoMakerAssessment(e.target.value)}
              placeholder="Creditworthiness/capacity of the co-maker, if any"
            />
          ) : (
            <p className="text-sm">{coMakerAssessment || 'None on record.'}</p>
          )}
        </div>

        {canEditReview && (
          <Button size="sm" disabled={saveReviewMutation.isPending} onClick={() => saveReviewMutation.mutate()}>
            {saveReviewMutation.isPending ? 'Saving…' : 'Save Underwriting Details'}
          </Button>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const CREDIT_BUREAU_RESULT_OPTIONS: { value: CreditBureauResult; label: string }[] = [
  { value: 'CLEAR', label: 'Clear' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'NO_RECORD_FOUND', label: 'No record found' },
];

/**
 * Wired to the real backend Loan Applications module (`GET/POST /loan-applications/:id/...`).
 * Every application starts system-classified PREAPPROVED/PREDECLINED (backend's
 * `LoanApplicationPreQualificationService`, added 2026-07-11 - advisory only). Approve/decline
 * work from either system verdict, requiring a product version to be assigned first - mirrors the
 * backend's `ProductNotAssignedError` gate. Only MIS can revert a decided application back to a
 * freshly recomputed system verdict (accidental-click safety net), matching
 * `canRevertLoanApplicationDecision`.
 *
 * The Create-Loan-Account bridge has no backend equivalent yet (converting an APPROVED application
 * into a LoanAccount is a deliberately separate concern - see the backend module's own design
 * notes) and is intentionally left out here. Create Client Profile is different: `POST /borrowers`
 * is real, so an APPROVED application can create a real client, prefilled from its own fields (see
 * `CreateClientProfileDialog`).
 */
export function LoanApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by LoanApplicationCreatePage when one or more best-effort attachment auto-saves failed
  // (AI Auto-fill document and/or Applicant Document slots) - the application itself was still
  // created successfully.
  const failedDocumentLabels = (location.state as { failedDocumentLabels?: string[] } | null)?.failedDocumentLabels ?? [];
  const queryClient = useQueryClient();
  const { canAccessLoanApplications, canRevertLoanApplicationDecision, canReviewLoanApplication, canApproveLoanApplication, currentAccount } =
    useRole();
  const [decisionNote, setDecisionNote] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<'APPROVED' | 'DECLINED' | 'REVERT' | 'PRE_APPROVAL' | null>(null);
  const [createClientOpen, setCreateClientOpen] = React.useState(false);
  const [createLoanOpen, setCreateLoanOpen] = React.useState(false);

  useLogPageView('Loan Application Detail', applicationId);

  const applicationQuery = useQuery({
    queryKey: ['loan-application', applicationId],
    queryFn: () => apiClient.get<LoanApplication>(`/loan-applications/${applicationId}`),
    enabled: canAccessLoanApplications && Boolean(applicationId),
    retry: false,
  });
  const application = applicationQuery.data;

  // "Create Loan Account" (moved here from the Client Profile page, 2026-07-14) - only fetched
  // once this application's client actually exists.
  const clientBorrowerQuery = useQuery({
    queryKey: ['borrower', application?.createdBorrowerId],
    queryFn: () => apiClient.get<Borrower>(`/borrowers/${application!.createdBorrowerId}`),
    enabled: canAccessLoanApplications && Boolean(application?.createdBorrowerId),
  });
  const clientLoansQuery = useQuery({
    queryKey: ['loan-accounts', 'all'],
    queryFn: () => fetchAllPages<{ id: string; borrowerId: string; status: string }>('/loan-accounts'),
    enabled: canAccessLoanApplications && Boolean(application?.createdBorrowerId),
  });
  const hasActiveLoan = (clientLoansQuery.data ?? []).some(
    (l) => l.borrowerId === application?.createdBorrowerId && l.status !== 'CLOSED' && l.status !== 'CLOSED_WRITTEN_OFF' && l.status !== 'CLOSED_REJECTED',
  );
  // Once the loan account created from this application has been Activated (disbursed - status
  // past PENDING_APPROVAL/APPROVED), the decision that produced it can no longer be reverted -
  // there's a real, live loan on the books behind it.
  const createdLoanAccount = (clientLoansQuery.data ?? []).find((l) => l.id === application?.createdLoanAccountId);
  const isCreatedLoanAccountActivated = createdLoanAccount
    ? createdLoanAccount.status !== 'PENDING_APPROVAL' && createdLoanAccount.status !== 'APPROVED'
    : false;
  // Created but not yet Activated - the loan account itself shows as "For Disbursement" (see
  // StatusBadge.tsx's LOAN_STATUS_STYLE) in this state, so this application's own status display
  // matches it instead of still saying "Approved".
  const isCreatedLoanAccountAwaitingDisbursement = Boolean(createdLoanAccount) && !isCreatedLoanAccountActivated;

  const productsQuery = useQuery({
    queryKey: ['loan-products', 'all'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
    enabled: canAccessLoanApplications,
  });
  const activeVersionOptions = React.useMemo(
    () =>
      (productsQuery.data ?? []).flatMap((product) =>
        product.versions
          .filter((v) => v.isActive)
          .map((v) => ({ id: v.id, productName: product.name, label: `${product.name} (v${v.versionNumber})` })),
      ),
    [productsQuery.data],
  );
  const productNameByVersionId = React.useMemo(
    () => new Map(activeVersionOptions.map((v) => [v.id, v.productName])),
    [activeVersionOptions],
  );

  const assignedProductName = application?.assignedLoanProductVersionId
    ? (productNameByVersionId.get(application.assignedLoanProductVersionId) ?? null)
    : null;

  // Local UI-only step - narrows which product classes the second dropdown offers. Initialized
  // from whatever the application is currently assigned to, if it falls under one of the 3 curated
  // types; otherwise starts unset so staff picks a type first.
  const [selectedProductType, setSelectedProductType] = React.useState<LoanTypeOption | ''>('');
  const productTypeLabelsQuery = useProductTypeLabels();
  React.useEffect(() => {
    if (assignedProductName) {
      const resolvedType = findLoanTypeForProductName(assignedProductName);
      if (resolvedType) setSelectedProductType(resolvedType);
    }
    // Only re-derive when the application itself (or its assignment) changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id, assignedProductName]);

  const productClassOptions = React.useMemo(() => {
    if (!selectedProductType) return [];
    return activeVersionOptions
      .filter((v) => classifyProductType(v.productName) === selectedProductType)
      .map((v) => ({ name: v.productName, versionId: v.id, discontinued: KNOWN_DISCONTINUED_PRODUCT_NAMES.has(v.productName) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedProductType, activeVersionOptions]);

  // Resolves encodedByUserId/reviewedByUserId (raw LMS account ids) into display names for the
  // "encoded by" / "reviewed by" indicators below - same join pattern used elsewhere (e.g.
  // LoanListPage's borrower/product name join).
  const usersQuery = useQuery({ queryKey: ['users', 'all'], queryFn: () => fetchAllPages<User>('/users') });
  const userNameById = React.useMemo(() => new Map((usersQuery.data ?? []).map((u) => [u.id, u.fullName])), [usersQuery.data]);
  const encodedByName = application?.encodedByUserId ? (userNameById.get(application.encodedByUserId) ?? 'Unknown account') : null;
  const reviewedByName = application?.reviewedByUserId ? (userNameById.get(application.reviewedByUserId) ?? 'Unknown account') : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['loan-application', applicationId] });
    queryClient.invalidateQueries({ queryKey: ['loan-applications', 'all'] });
  };

  const assignProductMutation = useMutation({
    mutationFn: (loanProductVersionId: string) =>
      apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/assign-product`, { loanProductVersionId }),
    onSuccess: invalidate,
  });

  const decideMutation = useMutation({
    mutationFn: (decision: 'APPROVED' | 'DECLINED') =>
      apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/${decision === 'APPROVED' ? 'approve' : 'decline'}`, {
        decisionNote: decisionNote.trim() || undefined,
      }),
    onSuccess: () => {
      setDecisionNote('');
      setConfirmAction(null);
      invalidate();
    },
  });

  const revertMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/revert`),
    onSuccess: () => {
      setConfirmAction(null);
      invalidate();
    },
  });

  const startReviewMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/start-review`),
    onSuccess: invalidate,
  });

  const tagPreApprovalMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/tag-pre-approval`),
    onSuccess: () => {
      setConfirmAction(null);
      invalidate();
    },
  });

  if (!canAccessLoanApplications) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              Restricted to <RoleAbbr role="MIS" />, <RoleAbbr role="Loan Operation Manager" />, and <RoleAbbr role="CRM" /> accounts
            </p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Loading application…</p>
      </div>
    );
  }

  if (applicationQuery.isError || !application) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Application not found: {applicationId}
        </div>
      </div>
    );
  }

  const initials = application.applicantName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isPreApprovalStage = application.status === 'PREAPPROVED' || application.status === 'PREDECLINED';
  const isUnderReview = application.status === 'UNDER_REVIEW';
  const isPreApproval = application.status === 'PRE_APPROVAL';
  const isDecided = application.status === 'APPROVED' || application.status === 'DECLINED';
  const mutationError =
    assignProductMutation.error ||
    decideMutation.error ||
    revertMutation.error ||
    startReviewMutation.error ||
    tagPreApprovalMutation.error;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ApplicantAvatar ownerType="LOAN_APPLICATION" ownerId={application.id} initials={initials} />
            <div>
              <div className="flex items-center gap-3">
                {application.createdBorrowerId ? (
                  <Link
                    to={`/clients/${application.createdBorrowerId}`}
                    className="text-2xl font-semibold tracking-tight text-primary underline-offset-4 hover:underline"
                  >
                    {application.applicantName}
                  </Link>
                ) : (
                  <h2 className="text-2xl font-semibold tracking-tight">{application.applicantName}</h2>
                )}
                <Badge
                  variant={
                    application.status === 'APPROVED' && (isCreatedLoanAccountActivated || isCreatedLoanAccountAwaitingDisbursement)
                      ? 'success'
                      : DETAIL_STATUS_BADGE_VARIANT[application.status]
                  }
                >
                  {application.status === 'APPROVED' && isCreatedLoanAccountActivated
                    ? 'Disbursed'
                    : application.status === 'APPROVED' && isCreatedLoanAccountAwaitingDisbursement
                      ? 'For Disbursement'
                      : STATUS_DISPLAY_LABEL[application.status]}
                </Badge>
                {application.createdLoanAccountId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/loans/${application.createdLoanAccountId}`} className="inline-flex items-center gap-1.5">
                      <Landmark className="h-3.5 w-3.5" />
                      Loan Account Created
                      {application.createdLoanAccountCode && (
                        <span className="font-mono text-xs text-muted-foreground">({application.createdLoanAccountCode})</span>
                      )}
                    </Link>
                  </Button>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {application.requestedCategory} · Submitted {formatDate(application.createdAt)}
                {encodedByName ? ` · Encoded by ${encodedByName}` : ''}
              </p>
              {isPreApprovalStage && (
                <p className="text-xs text-muted-foreground">
                  System pre-qualification -{' '}
                  {application.distanceFromBranchKm !== null
                    ? `${application.distanceFromBranchKm} km from branch`
                    : 'distance from branch could not be verified'}
                  .
                </p>
              )}
            </div>
          </div>
          {canAccessLoanApplications && (
            <div className="flex flex-col items-end gap-2">
              {!application.createdBorrowerId && (
                <Button
                  size="sm"
                  disabled={application.status !== 'APPROVED'}
                  onClick={() => setCreateClientOpen(true)}
                  title={application.status !== 'APPROVED' ? 'Only available once the application is Approved' : undefined}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Create Client Profile
                </Button>
              )}
              {/* Visible only once this application has a real client (createdBorrowerId set) and hasn't
                  already produced a loan account (that's now shown next to the applicant's name/status
                  above) - clickable only once this specific application is Approved, and the client has
                  no other active loan open (2026-07-14, moved from the Client Profile page so it's gated
                  per-application, not per-client). */}
              {application.createdBorrowerId && !application.createdLoanAccountId && (
                <Button
                  size="sm"
                  disabled={application.status !== 'APPROVED' || hasActiveLoan}
                  onClick={() => setCreateLoanOpen(true)}
                  title={
                    application.status !== 'APPROVED'
                      ? 'Only available once the application is Approved'
                      : hasActiveLoan
                        ? 'This client already has an active (or in-arrears) loan account'
                        : undefined
                  }
                >
                  <Landmark className="mr-1.5 h-3.5 w-3.5" /> Create Loan Account
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {mutationError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {mutationError instanceof Error ? mutationError.message : 'Something went wrong.'}
        </div>
      )}

      {failedDocumentLabels.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> The application was created, but the following document(s) could not be
          saved as attachments automatically: {failedDocumentLabels.join(', ')}. Please upload them manually below.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applicant Details</CardTitle>
            <CardDescription>
              {encodedByName
                ? `Walk-in applicant - encoded by ${encodedByName} from the paper form (ECLC-LOFN01)`
                : 'Submitted via the (not yet built) public loan application website'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Age</dt>
              <dd className="text-right font-medium">{application.age ?? '-'}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-right font-medium">{toProperCase(application.address) || '-'}</dd>
              <dt className="text-muted-foreground">Contact Number</dt>
              <dd className="text-right font-medium">{formatMobileNumber(application.mobilePhone)}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-right font-medium">{application.email ?? '-'}</dd>
              <dt className="text-muted-foreground">Employer</dt>
              <dd className="text-right font-medium">{application.employer ?? '-'}</dd>
              <dt className="text-muted-foreground">Co-borrower</dt>
              <dd className="text-right font-medium">{application.coBorrowerName ?? 'None (optional)'}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requested Loan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="text-right font-medium">{application.requestedCategory}</dd>
              <dt className="text-muted-foreground">Requested amount</dt>
              <dd className="text-right font-medium">{formatPeso(application.requestedAmount)}</dd>
              <dt className="text-muted-foreground">Requested term</dt>
              <dd className="text-right font-medium">{application.requestedTermMonths} months</dd>
              {application.accountType && (
                <>
                  <dt className="text-muted-foreground">Type of account</dt>
                  <dd className="text-right font-medium">{application.accountType === 'NEW' ? 'New' : 'Renewal'}</dd>
                </>
              )}
              {application.loanPurpose && (
                <>
                  <dt className="text-muted-foreground">Loan purpose</dt>
                  <dd className="text-right font-medium">{application.loanPurpose}</dd>
                </>
              )}
              {application.referralSource && (
                <>
                  <dt className="text-muted-foreground">Found Easycash via</dt>
                  <dd className="text-right font-medium">{application.referralSource}</dd>
                </>
              )}
            </dl>

            <Separator className="my-4" />

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The client only selects a category when applying - staff assigns the specific product type and class here.
              </p>
              {!isDecided ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Assigned product type</Label>
                    <Select
                      value={selectedProductType}
                      onValueChange={(v) => setSelectedProductType(v as LoanTypeOption)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOAN_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type}>
                            {productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assigned product class</Label>
                    <Select
                      value={application.assignedLoanProductVersionId ?? ''}
                      onValueChange={(v) => assignProductMutation.mutate(v)}
                      disabled={!selectedProductType || assignProductMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedProductType ? 'Select product class' : 'Select a product type first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {productClassOptions.map((c) => (
                          <SelectItem key={c.versionId} value={c.versionId} disabled={c.discontinued}>
                            <span className="flex items-center gap-2">
                              {c.name}
                              {c.discontinued && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                  title="Discontinued - no longer offered to new applicants, not selectable here"
                                >
                                  Discontinued
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned product type</p>
                    <p className="font-medium">
                      {selectedProductType ? productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, selectedProductType) : 'Not assigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned product class</p>
                    <p className="font-mono">{assignedProductName ?? 'Not assigned'}</p>
                  </div>
                  {application.createdLoanAccountId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Loan Account</p>
                      <Link
                        to={`/loans/${application.createdLoanAccountId}`}
                        className="inline-flex items-center gap-1.5 font-mono text-primary hover:underline"
                      >
                        <Landmark className="h-3.5 w-3.5" />
                        {application.createdLoanAccountCode ?? application.createdLoanAccountId}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {isPreApprovalStage && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="decision-note">Decision note (optional)</Label>
                  <Textarea
                    id="decision-note"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="e.g. Verified via phone call, proceeding as recommended..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => startReviewMutation.mutate()} disabled={!canReviewLoanApplication || startReviewMutation.isPending}>
                    {startReviewMutation.isPending ? 'Starting…' : 'Start Review'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('DECLINED')}
                    disabled={!canReviewLoanApplication || decideMutation.isPending}
                  >
                    Decline Application
                  </Button>
                </div>
              </div>
            )}

            {isUnderReview && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setConfirmAction('PRE_APPROVAL')}
                    disabled={!canReviewLoanApplication || tagPreApprovalMutation.isPending}
                  >
                    Tag as Pre Approval
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('DECLINED')}
                    disabled={!canReviewLoanApplication || decideMutation.isPending}
                  >
                    Decline Application
                  </Button>
                </div>
              </div>
            )}

            {isPreApproval && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="decision-note">Decision note (optional)</Label>
                  <Textarea
                    id="decision-note"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="e.g. Verified via phone call, proceeding as recommended..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setConfirmAction('APPROVED')}
                    disabled={!application.assignedLoanProductVersionId || !canApproveLoanApplication || decideMutation.isPending}
                  >
                    Approve Application
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction('DECLINED')}
                    disabled={!canReviewLoanApplication || decideMutation.isPending}
                  >
                    Decline Application
                  </Button>
                </div>
                {!application.assignedLoanProductVersionId && (
                  <p className="text-xs text-muted-foreground">Assign a product version above before approving.</p>
                )}
                {!canApproveLoanApplication && (
                  <p className="text-xs text-muted-foreground">
                    Only <RoleAbbr role="MIS" /> and <RoleAbbr role="Loan Operation Manager" /> can give the final approval.
                  </p>
                )}
              </div>
            )}

            {isDecided && (
              <div className="space-y-3">
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {application.status === 'APPROVED'
                      ? isCreatedLoanAccountActivated
                        ? 'Disbursed'
                        : isCreatedLoanAccountAwaitingDisbursement
                          ? 'For Disbursement'
                          : 'Approved'
                      : 'Declined'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {application.reviewedAt && formatDate(application.reviewedAt)}
                    {reviewedByName ? ` · by ${reviewedByName}` : ''}
                  </p>
                  {application.decisionNote && <p className="mt-2 text-sm text-muted-foreground">{application.decisionNote}</p>}
                </div>
                {canRevertLoanApplicationDecision ? (
                  isCreatedLoanAccountActivated ? (
                    <p className="text-xs text-muted-foreground">
                      This application's loan account has already been Activated - the decision can no longer be reverted.
                    </p>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmAction('REVERT')}
                      disabled={revertMutation.isPending}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to AI Pre-Qualification
                    </Button>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Only MIS can revert a decided application back to AI pre-qualification (accidental-click safety net).
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal &amp; Household Information</CardTitle>
          <CardDescription>Everything else captured on the application form - not shown above to keep the summary cards short.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Gender</dt>
            <dd className="text-right font-medium">{application.gender ?? '-'}</dd>
            <dt className="text-muted-foreground">Civil Status</dt>
            <dd className="text-right font-medium">{application.civilStatus ?? '-'}</dd>
            <dt className="text-muted-foreground">Birth Date</dt>
            <dd className="text-right font-medium">{application.birthDate ? formatDate(application.birthDate) : '-'}</dd>
            <dt className="text-muted-foreground">Place of Birth</dt>
            <dd className="text-right font-medium">{application.placeOfBirth ?? '-'}</dd>
            <dt className="text-muted-foreground">Nationality</dt>
            <dd className="text-right font-medium">{application.nationality ?? '-'}</dd>
            <dt className="text-muted-foreground">Home Ownership</dt>
            <dd className="text-right font-medium">{application.homeOwnership ?? '-'}</dd>
            <dt className="text-muted-foreground">Occupation</dt>
            <dd className="text-right font-medium">{application.occupation ?? '-'}</dd>
            <dt className="text-muted-foreground">Office Address</dt>
            <dd className="text-right font-medium">{application.officeAddress ?? '-'}</dd>
            <dt className="text-muted-foreground">TIN</dt>
            <dd className="text-right font-medium">{application.tinNumber ?? '-'}</dd>
            <dt className="text-muted-foreground">SSS</dt>
            <dd className="text-right font-medium">{application.sssNumber ?? '-'}</dd>
          </dl>

          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dependants ({application.dependants.length})</p>
              {application.dependants.length === 0 ? (
                <p className="text-sm text-muted-foreground">None on record.</p>
              ) : (
                <ul className="space-y-1">
                  {application.dependants.map((d, i) => (
                    <li key={i} className="text-sm">
                      {d.name}
                      {d.age ? ` · ${d.age} yrs old` : ''}
                      {d.relationship ? ` · ${d.relationship}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Character References</p>
              {!application.reference1Name && !application.reference2Name ? (
                <p className="text-sm text-muted-foreground">None on record.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {application.reference1Name && (
                    <li>
                      {application.reference1Name}
                      {application.reference1Mobile ? ` · ${formatMobileNumber(application.reference1Mobile)}` : ''}
                    </li>
                  )}
                  {application.reference2Name && (
                    <li>
                      {application.reference2Name}
                      {application.reference2Mobile ? ` · ${formatMobileNumber(application.reference2Mobile)}` : ''}
                    </li>
                  )}
                </ul>
              )}
            </div>

            {application.note && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Note</p>
                <p className="text-sm">{application.note}</p>
                {encodedByName && <p className="mt-1 text-xs text-muted-foreground">Encoded by {encodedByName}</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <UnderwritingCard
        application={application}
        canEditRisk={canAccessLoanApplications}
        canEditReview={isUnderReview && canReviewLoanApplication}
        showReview={isUnderReview || isPreApproval || (isDecided && Boolean(application.reviewReport))}
      />

      <ProfileNotesPanel ownerType="LOAN_APPLICATION" ownerId={application.id} />

      <AttachmentsPanel ownerType="LOAN_APPLICATION" ownerId={application.id} canUpload={canAccessLoanApplications} />

      <RecentActivityPanel label="Loan Application" entityId={application.id} />

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Confirm{' '}
              {confirmAction === 'REVERT'
                ? 'revert'
                : confirmAction === 'APPROVED'
                  ? 'approval'
                  : confirmAction === 'PRE_APPROVAL'
                    ? 'pre approval'
                    : 'decline'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'REVERT' &&
                `This will revert ${application.applicantName}'s application back to a freshly recomputed AI pre-qualification and clear the previous decision.`}
              {confirmAction === 'PRE_APPROVAL' &&
                `This will tag ${application.applicantName}'s application as Pre Approval and lock the Review Report. It will then be ready for the final Approve/Decline.`}
              {(confirmAction === 'APPROVED' || confirmAction === 'DECLINED') &&
                `Are you sure you want to ${confirmAction === 'APPROVED' ? 'approve' : 'decline'} ${application.applicantName}'s application? This is a safety-net confirmation to prevent an accidental click.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmAction === 'REVERT') revertMutation.mutate();
                else if (confirmAction === 'PRE_APPROVAL') tagPreApprovalMutation.mutate();
                else if (confirmAction === 'APPROVED' || confirmAction === 'DECLINED') decideMutation.mutate(confirmAction);
              }}
            >
              Yes, confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Timeline - ADR-050 */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Log of all actions taken on this application by loan officers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileActivityTimeline
            profileType="LOAN_APPLICATION"
            profileId={application.id}
          />
        </CardContent>
      </Card>

      <CreateClientProfileDialog open={createClientOpen} onOpenChange={setCreateClientOpen} application={application} />
      {clientBorrowerQuery.data && (
        <CreateLoanAccountDialog
          open={createLoanOpen}
          onOpenChange={setCreateLoanOpen}
          borrower={clientBorrowerQuery.data}
          requestedTermMonths={application.requestedTermMonths}
          applicationId={application.id}
        />
      )}
    </div>
  );
}
