import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, FilePlus2, Lock, Plus, RotateCcw, Search, Sparkles, Trash2, Upload } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { FieldTooltip } from '@/components/FieldTooltip';
import { RoleAbbr } from '@/components/RoleAbbr';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { type AddressDraft, emptyAddressDraft, PsgcAddressPicker } from '@/components/PsgcAddressPicker';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { productTypeLabel, useProductTypeLabels } from '@/lib/productTypeLabels';
import { apiClient, fetchAllPages, uploadFile } from '@/lib/apiClient';
import type { CreateLoanApplicationRequest, LoanApplication } from '@/lib/loanApplicationApiTypes';
import type { ExtractedLoanApplicationFields } from '@/lib/aiExtractionApiTypes';
import type { Borrower, PaginatedResponse } from '@/lib/loanApiTypes';
import {
  ATTACHMENT_ACCEPTED_MIME,
  ATTACHMENT_ACCEPTED_TYPES,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  DOCUMENT_CATEGORY_LABELS,
  type AttachmentDocumentCategory,
} from '@/lib/documentApiTypes';
import { formatDate, formatPeso, toProperCase } from '@/lib/utils';

const AI_EXTRACTION_ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.docx';
const AI_EXTRACTION_ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * The specific documents needed to review an application. Uploaded here become real attachments
 * tagged by category once the application exists (see createMutation's onSuccess), feeding a
 * future risk-assessment feature that reads these by category. `showWhen` is evaluated live
 * against the current loan type / co-borrower selection so only relevant slots are shown.
 */
const DOCUMENT_SLOTS: {
  category: AttachmentDocumentCategory;
  showWhen?: (ctx: { loanCategory: string; hasCoBorrower: boolean }) => boolean;
}[] = [
  { category: 'PROFILE_PICTURE' },
  { category: 'VALID_ID_BORROWER' },
  { category: 'VALID_ID_CO_BORROWER', showWhen: (ctx) => ctx.hasCoBorrower },
  { category: 'PROOF_OF_BILLING' },
  { category: 'EMPLOYEE_ID', showWhen: (ctx) => ctx.loanCategory === 'Salary Loan' },
  { category: 'CORPORATE_PAYSLIP', showWhen: (ctx) => ctx.loanCategory === 'Salary Loan' },
  { category: 'CERTIFICATE_OF_EMPLOYMENT', showWhen: (ctx) => ctx.loanCategory === 'Salary Loan' },
  { category: 'BUSINESS_CLEARANCE', showWhen: (ctx) => ctx.loanCategory === 'Business Loan' },
  { category: 'DTI_SEC_REGISTRATION', showWhen: (ctx) => ctx.loanCategory === 'Business Loan' },
  { category: 'BUSINESS_PERMIT', showWhen: (ctx) => ctx.loanCategory === 'Business Loan' },
  { category: 'INCOME_TAX_RETURN', showWhen: (ctx) => ctx.loanCategory === 'Business Loan' },
  { category: 'BANK_STATEMENT', showWhen: (ctx) => ctx.loanCategory === 'Business Loan' },
  { category: 'SEAMANS_BOOK', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
  { category: 'OVERSEAS_EMPLOYMENT_CERTIFICATE', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
  { category: 'POEA_CONTRACT', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
  { category: 'ALLOTMENT_SLIP', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
  { category: 'PASSPORT_ID', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
  // Optional ("if available") on the Portal's own published checklist - not in
  // getRequiredDocumentCategories() on the backend, matching that.
  { category: 'FLIGHT_DETAILS', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
];

/** Uppercases the free-text parts of an address patch (house/unit number, street) - matches the
 * printed loan application form convention (ECLC-LOFN01). Region/province/city/barangay come
 * from PSGC picker Selects, not free typing, so they're left as-is. */
function upperAddressPatch(patch: Partial<AddressDraft>): Partial<AddressDraft> {
  return {
    ...patch,
    ...(patch.houseUnitNumber !== undefined ? { houseUnitNumber: patch.houseUnitNumber.toUpperCase() } : {}),
    ...(patch.street !== undefined ? { street: patch.street.toUpperCase() } : {}),
  };
}

/** Splits a single extracted full name into the form's separate first/middle/last inputs - a
 * plain heuristic (first token / last token / everything between), not a name-parsing library.
 * Always a suggestion the officer reviews, never submitted as-is without their say. */
function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0]!, middleName: '', lastName: parts[1]! };
  return { firstName: parts[0]!, middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1]! };
}

/** The intake form stores the co-borrower as one combined string, e.g. "Jane Doe (spouse)" - this
 * splits it back into a name and relationship when prefilling a renewal from a prior application. */
function parseCoBorrowerName(coBorrowerName: string): { name: string; relationship: string } {
  const match = coBorrowerName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1]!.trim(), relationship: match[2]!.trim() };
  return { name: coBorrowerName.trim(), relationship: '' };
}

/**
 * Officer-encoded loan application intake - mirrors the company's real paper
 * form "LOAN APPLICATION" (Form No. ECLC-LOFN01, Rev 02), section for section,
 * so a loan officer can encode a walk-in applicant while the public
 * application website does not exist yet. Wired to the real backend
 * (`POST /loan-applications`) - submitting creates a real record, automatically classified
 * PREAPPROVED/PREDECLINED by the backend's LoanApplicationPreQualificationService.
 *
 * Only the fields the LMS currently models are persisted onto the record (see
 * `CreateLoanApplicationRequest`); the remaining paper-form fields are shown for
 * workflow completeness and clearly note that they are not yet stored.
 */

const REFERRAL_OPTIONS = ['Walk-in', 'Website', 'Facebook', 'Internet', 'Flyers/Signages/Streamers', 'Agent/Referral', 'Others'];

/** Paper form §2 lists Seaman / Salary / OFW / Business-Corporate / Car / Real Estate - only the 3 active categories are offered today. */
const LOAN_TYPE_OPTIONS = [
  { category: 'Business Loan' },
  { category: 'Salary Loan' },
  { category: 'Seafarer Loan' },
];

const LOAN_TERM_MONTHS_OPTIONS = Array.from({ length: 24 }, (_, i) => i + 1);

const HOME_OWNERSHIP_OPTIONS = ['Owned', 'Rented', 'Owned by Parents', 'Owned by Relatives'];
// 2026-08-27 (user-reported: civil status/gender showing blank on existing client records):
// matches the canonical uppercase values Borrower.gender/civilStatus are actually stored as (see
// ClientProfilePage.tsx's own fix) - a Title Case value here would show correctly on creation but
// then appear blank the moment that same application/client is opened for editing elsewhere.
const GENDER_OPTIONS = ['FEMALE', 'MALE'];
const CIVIL_STATUS_OPTIONS = ['SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED/SEPARATED'];

interface DependantRow {
  name: string;
  age: string;
  relationship: string;
}

function Field({
  label,
  children,
  hint,
  tooltip,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  tooltip?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5${className ? ` ${className}` : ''}`}>
      <Label className="flex items-center gap-1 text-xs">
        {label}
        {tooltip && <FieldTooltip text={tooltip} />}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A field row inside the AI extraction review dialog - `badgeOn` shows a green "detected" pill
 * when the AI produced a value for this field, or an amber "verify" pill when it didn't (surfaced
 * honestly, never a fabricated confidence score - see ExtractLoanApplicationFieldsUseCase.ts). */
function ReviewField({ label, badgeOn, children }: { label: string; badgeOn: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            badgeOn ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
          }`}
        >
          {badgeOn ? 'detected' : 'verify'}
        </span>
      </div>
      {children}
    </div>
  );
}

function SectionCard({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{number}.</span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DocumentUploadSlot({
  label,
  file,
  error,
  onSelect,
  onRemove,
}: {
  label: string;
  file: File | null;
  error?: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onSelect(selected);
          e.target.value = '';
        }}
      />
      <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
        <div className="min-w-0">
          <p className="font-medium">{label}</p>
          {file ? (
            <p className="truncate text-muted-foreground">{file.name}</p>
          ) : (
            <p className="text-muted-foreground">No file selected</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {file && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onRemove}>
              Remove
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1.5 h-3 w-3" /> {file ? 'Replace' : 'Upload'}
          </Button>
        </div>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function computeAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday = now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function LoanApplicationCreatePage() {
  const navigate = useNavigate();
  return (
    <LoanApplicationEntry
      onCreated={(application, failedDocumentLabels) =>
        navigate(`/applications/${application.id}`, {
          replace: true,
          state: failedDocumentLabels ? { failedDocumentLabels } : undefined,
        })
      }
      onCancel={() => navigate(-1)}
    />
  );
}

/** 2026-08-12 (user request/bug fix) - lets LMS staff correct the full intake field set on an
 * application they encoded, via PATCH /loan-applications/:id/intake. See LoanApplicationForm's
 * `editApplicationId` doc comment for what changes in edit mode. */
export function LoanApplicationEditPage() {
  const navigate = useNavigate();
  const { applicationId } = useParams<{ applicationId: string }>();
  const applicationQuery = useQuery({
    queryKey: ['loan-application', applicationId],
    queryFn: () => apiClient.get<LoanApplication>(`/loan-applications/${applicationId}`),
    enabled: Boolean(applicationId),
  });

  if (applicationQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted-foreground">Loading application…</p>
      </div>
    );
  }

  if (applicationQuery.isError || !applicationQuery.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">Could not load this application.</CardContent>
        </Card>
      </div>
    );
  }

  const application = applicationQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate(`/applications/${application.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <FilePlus2 className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Edit Loan Application</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Correcting {application.applicantName}&apos;s encoded application details. Saving re-runs the pre-approved/pre-declined
          classification against the updated values.
        </p>
      </div>
      <LoanApplicationForm
        prefillFrom={application}
        editApplicationId={application.id}
        showChrome={false}
        onCreated={(updated) => navigate(`/applications/${updated.id}`, { replace: true })}
        onCancel={() => navigate(`/applications/${application.id}`)}
      />
    </div>
  );
}

/** How each field on `LoanApplication` is badged in `LoanApplicationEntry`'s review step:
 * - `same` (green "same as before") - personal-identity fields that essentially never change.
 * - `verify` (amber "verify") - contact/financial/reference details that plausibly went stale.
 * - `starting` (neutral "starting point") - the loan request itself (type/amount/term/purpose).
 *   Not "stale data to double-check" - it's the most likely thing to be deliberately different
 *   this time (a bigger loan, a different product), so it gets its own honest, non-judgmental
 *   label rather than implying it's expected to match the previous request. */
const APPLICATION_FIELD_BADGE_KIND: Record<string, 'same' | 'verify' | 'starting'> = {
  applicantName: 'same',
  birthDate: 'same',
  gender: 'same',
  nationality: 'same',
  address: 'verify',
  employer: 'verify',
  monthlyIncome: 'verify',
  mobilePhone: 'verify',
  reference1: 'verify',
  reference2: 'verify',
  requestedCategory: 'starting',
  requestedAmount: 'starting',
  requestedTermMonths: 'starting',
  loanPurpose: 'starting',
};

/**
 * 2026-09-10 (user-reported bug): selecting an existing client with no Loan Application on file
 * (e.g. a legacy client migrated straight in without ever going through this LMS's own intake
 * flow - no `borrowerId`/`createdBorrowerId` match for `latestApplication` to find) left the form
 * completely blank, silently, because prefill only ever read from a previous application. This
 * builds an equivalent prefill straight from the Client Profile itself, which every existing
 * client has - used as the fallback whenever `latestApplication` isn't found. Loan-specific fields
 * (type/amount/term/purpose), co-borrower, and references have no equivalent on Borrower and are
 * deliberately left unset either way - the officer encodes those fresh for this request. */
function borrowerToApplicationPrefill(borrower: Borrower): Partial<LoanApplication> {
  // addressType casing is inconsistent across records ('PRESENT' from this app's own
  // ClientCreatePage.tsx vs 'Present' from legacy-imported data) - match case-insensitively rather
  // than assuming one convention.
  const presentAddress = borrower.addresses.find((a) => a.addressType?.toUpperCase() === 'PRESENT') ?? borrower.addresses[0];
  const ref1 = borrower.characterReferences[0];
  const ref2 = borrower.characterReferences[1];
  return {
    applicantName: borrower.fullName,
    gender: borrower.gender,
    civilStatus: borrower.civilStatus,
    birthDate: borrower.birthDate,
    placeOfBirth: borrower.placeOfBirth,
    nationality: borrower.nationality,
    homeOwnership: borrower.homeOwnership,
    houseUnitNumber: presentAddress?.houseUnitNumber ?? null,
    street: presentAddress?.street ?? null,
    barangay: presentAddress?.barangay ?? null,
    cityMunicipality: presentAddress?.cityMunicipality ?? null,
    province: presentAddress?.province ?? null,
    zipCode: presentAddress?.zipCode ?? null,
    address: presentAddress
      ? [presentAddress.houseUnitNumber, presentAddress.street, presentAddress.barangay, presentAddress.cityMunicipality, presentAddress.province]
          .filter(Boolean)
          .join(', ')
      : null,
    monthlyIncome: borrower.incomeDetail?.monthlyIncome ?? null,
    employer: borrower.incomeDetail?.employerName ?? null,
    occupation: borrower.incomeDetail?.position ?? null,
    officeAddress: borrower.incomeDetail?.employerAddress ?? null,
    tinNumber: borrower.governmentId?.tinNumber ?? null,
    sssNumber: borrower.governmentId?.sssNumber ?? null,
    mobilePhone: borrower.mobilePhone1,
    email: borrower.email,
    facebookLink: borrower.facebookLink,
    dependants: borrower.dependants,
    reference1Name: ref1 ? `${ref1.firstName} ${ref1.lastName}`.trim() : null,
    reference1Mobile: ref1?.phoneNumber ?? null,
    reference2Name: ref2 ? `${ref2.firstName} ${ref2.lastName}`.trim() : null,
    reference2Mobile: ref2?.phoneNumber ?? null,
  };
}

const BADGE_STYLE: Record<'same' | 'verify' | 'starting', { className: string; label: string }> = {
  same: { className: 'bg-primary/10 text-primary', label: 'same as before' },
  verify: { className: 'bg-warning/10 text-warning', label: 'verify' },
  starting: { className: 'bg-secondary text-muted-foreground', label: 'starting point' },
};

/**
 * Gate in front of `LoanApplicationForm` for the two entry points that don't already know which
 * client is applying (the standalone `/applications/new` page and `LoanApplicationsPage`'s "New
 * Application" dialog) - `ClientProfilePage`'s own "Create Loan Application" flow already knows
 * the client and skips straight to `LoanApplicationForm` with `prefillFrom`/`lockedBorrowerId` set
 * directly, bypassing this gate entirely.
 *
 * 2026-09-06 (user request): lets a walk-in officer search for an existing client instead of
 * re-typing everything from scratch on every renewal - reuses the same `/borrowers?search=`
 * endpoint and result-card pattern as `LoanAccountCreatePage`'s "Find Client" step. Once a client
 * is picked, their most recent application (if any) is offered as a prefill, field-by-field, with
 * an honest badge per field (see `STALE_PRONE_APPLICATION_FIELDS`) rather than silently trusting
 * old data - the officer can accept it as-is, start blank (still linked to the found client), or
 * search for someone else.
 */
export function LoanApplicationEntry({
  showChrome = true,
  onCreated,
  onCancel,
}: {
  showChrome?: boolean;
  onCreated: (application: LoanApplication, failedDocumentLabels?: string[]) => void;
  onCancel: () => void;
}) {
  const [selectedBorrower, setSelectedBorrower] = React.useState<Borrower | null>(null);
  const [clientSearch, setClientSearch] = React.useState('');
  const debouncedClientSearch = useDebouncedValue(clientSearch);
  const [reviewResolved, setReviewResolved] = React.useState<'accepted' | 'blank' | null>(null);
  // Brand-new applicant, not an existing client at all - skips the search/review gate entirely and
  // goes straight to the original blank walk-in intake form (no lockedBorrowerId, no prefill).
  const [skipSearchEntirely, setSkipSearchEntirely] = React.useState(false);

  const clientSearchQuery = useQuery({
    queryKey: ['borrowers', 'search', debouncedClientSearch],
    queryFn: () => apiClient.get<PaginatedResponse<Borrower>>(`/borrowers?search=${encodeURIComponent(debouncedClientSearch)}&limit=10`),
    enabled: !selectedBorrower && debouncedClientSearch.trim().length > 0,
  });
  const clientResults = clientSearchQuery.data?.items ?? [];

  // No borrowerId filter exists on GET /loan-applications yet (same limitation LoanApplicationForm
  // already documents for its own previous-co-borrower lookup) - fetches every application and
  // filters client-side, matching ClientProfilePage's own `myApplications` derivation exactly.
  const applicationsQuery = useQuery({
    queryKey: ['loan-applications', 'all', 'existingClientLookup'],
    queryFn: () => fetchAllPages<LoanApplication>('/loan-applications'),
    enabled: Boolean(selectedBorrower),
  });
  const latestApplication = selectedBorrower
    ? (applicationsQuery.data ?? [])
        .filter((a) => a.createdBorrowerId === selectedBorrower.id || a.borrowerId === selectedBorrower.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : undefined;
  // 2026-09-10 (user-reported bug, "dapat pag select ko lalabas ang mga details niya... pero
  // walang lumabas"): a client with no Loan Application on file (e.g. a legacy client migrated
  // straight in - see borrowerToApplicationPrefill's own doc comment) used to fall through to a
  // silently blank form. The Client Profile itself is always available for an existing client, so
  // it's now the fallback prefill source whenever there's no previous application to offer instead.
  const borrowerPrefill = selectedBorrower ? borrowerToApplicationPrefill(selectedBorrower) : undefined;
  const effectivePrefill = latestApplication ?? borrowerPrefill;

  const reset = () => {
    setSelectedBorrower(null);
    setClientSearch('');
    setReviewResolved(null);
  };

  if (skipSearchEntirely) {
    return <LoanApplicationForm showChrome={showChrome} onCreated={onCreated} onCancel={onCancel} />;
  }

  if (selectedBorrower && reviewResolved) {
    return (
      <LoanApplicationForm
        prefillFrom={reviewResolved === 'accepted' ? effectivePrefill : undefined}
        lockedBorrowerId={selectedBorrower.id}
        showChrome={showChrome}
        onCreated={onCreated}
        onCancel={onCancel}
      />
    );
  }

  if (!selectedBorrower) {
    return (
      <div className={showChrome ? 'mx-auto max-w-3xl space-y-4' : 'space-y-4'}>
        {showChrome && (
          <div>
            <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={onCancel}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <FilePlus2 className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold tracking-tight">Loan Application Form</h2>
            </div>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-primary" /> Is the applicant an existing client?
            </CardTitle>
            <CardDescription>
              Search first before encoding - if they're an existing client, the form fills in from their last application, so you
              won't have to re-type everything. Not a client yet (no record)? Continue with a blank form below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Name, legacy ID, or mobile number..."
                className="pl-8"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>
            {clientSearchQuery.isLoading && <p className="py-4 text-center text-sm text-muted-foreground">Searching…</p>}
            {!clientSearchQuery.isLoading && debouncedClientSearch.trim().length > 0 && clientResults.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No matches for "{debouncedClientSearch}".</p>
            )}
            {clientResults.length > 0 && (
              <div className="max-h-72 space-y-1.5 overflow-y-auto">
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
            <Separator />
            <div className="flex items-center justify-between gap-2 rounded-md border bg-secondary/40 p-2.5">
              <p className="text-xs text-muted-foreground">Not a client yet (no record)?</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSkipSearchEntirely(true)}>
                Continue with a blank form
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // selectedBorrower is set, awaiting applicationsQuery / review decision
  return (
    <div className={showChrome ? 'mx-auto max-w-3xl space-y-4' : 'space-y-4'}>
      {showChrome && (
        <Button variant="ghost" size="sm" className="-ml-2" onClick={reset}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{selectedBorrower.fullName}</CardTitle>
          <CardDescription>
            {applicationsQuery.isLoading
              ? 'Fetching their most recent application…'
              : latestApplication
                ? `Prefilled from their most recent application (${formatDate(latestApplication.createdAt)}, ${latestApplication.requestedCategory}).`
                : 'No previous Loan Application on file for this client (likely a legacy record) - prefilled from their Client Profile instead.'}
          </CardDescription>
        </CardHeader>
        {!applicationsQuery.isLoading && effectivePrefill && (
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {latestApplication
                ? 'Personal details are copied directly - still verify the fields tagged "verify" before submitting, since these may have changed since then. Loan details are only a starting point for this new request, not something to leave unchanged.'
                : 'Personal details are copied directly from the Client Profile - still verify before submitting, since these may have changed since the profile was last updated.'}
            </p>
            {(
              [
                [
                  'Personal & contact details',
                  [
                    ['applicantName', 'Full name', effectivePrefill.applicantName ?? '—'],
                    ['birthDate', 'Date of birth', effectivePrefill.birthDate ? formatDate(effectivePrefill.birthDate) : '—'],
                    ['gender', 'Gender / Civil status', [effectivePrefill.gender, effectivePrefill.civilStatus].filter(Boolean).join(' · ') || '—'],
                    ['nationality', 'Nationality', effectivePrefill.nationality ?? '—'],
                    ['address', 'Present address', effectivePrefill.address ?? '—'],
                    ['employer', 'Employer', effectivePrefill.employer ?? '—'],
                    ['monthlyIncome', 'Monthly income', effectivePrefill.monthlyIncome ? formatPeso(effectivePrefill.monthlyIncome) : '—'],
                    ['mobilePhone', 'Contact number', effectivePrefill.mobilePhone ?? '—'],
                  ],
                ],
                ...(latestApplication
                  ? ([
                      [
                        'Loan details (previous request)',
                        [
                          ['requestedCategory', 'Type of loan', latestApplication.requestedCategory || '—'],
                          ['requestedAmount', 'Requested amount', latestApplication.requestedAmount ? formatPeso(latestApplication.requestedAmount) : '—'],
                          ['requestedTermMonths', 'Term', latestApplication.requestedTermMonths ? `${latestApplication.requestedTermMonths} months` : '—'],
                          ['loanPurpose', 'Loan purpose', latestApplication.loanPurpose ?? '—'],
                        ],
                      ],
                    ] as const)
                  : []),
                ...(effectivePrefill.reference1Name || effectivePrefill.reference2Name
                  ? ([
                      [
                        'References',
                        [
                          ['reference1', 'Reference 1', [effectivePrefill.reference1Name, effectivePrefill.reference1Mobile].filter(Boolean).join(' · ') || '—'],
                          ['reference2', 'Reference 2', [effectivePrefill.reference2Name, effectivePrefill.reference2Mobile].filter(Boolean).join(' · ') || '—'],
                        ],
                      ],
                    ] as const)
                  : []),
              ] as const
            ).map(([section, fields]) => (
              <div key={section} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{section}</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {fields.map(([field, label, value]) => {
                    const badge = latestApplication ? BADGE_STYLE[APPLICATION_FIELD_BADGE_KIND[field] ?? 'verify'] : null;
                    return (
                      <div key={field} className="rounded-md border bg-secondary/30 p-2.5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                          {badge && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.label}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium">{value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        )}
        <CardContent className={applicationsQuery.isLoading || !effectivePrefill ? '' : 'pt-0'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Search someone else
            </Button>
            <div className="flex gap-2">
              {effectivePrefill && (
                <Button type="button" variant="outline" onClick={() => setReviewResolved('blank')}>
                  Start with a blank form
                </Button>
              )}
              <Button type="button" onClick={() => setReviewResolved('accepted')} disabled={applicationsQuery.isLoading}>
                {effectivePrefill ? 'Accept and continue to form' : 'Continue to form'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The actual form - extracted from `LoanApplicationCreatePage` (2026-07-14) so it can be reused
 * inside a "Create Loan Application" dialog on the Client Profile page (a renewal application for
 * an existing client), not just as the standalone `/applications/new` page. `prefillFrom` seeds
 * every field from the client's most recent application (accountType forced to RENEWAL in that
 * case); `showChrome=false` drops the page header/back button/back-navigating Cancel button for
 * use inside a Dialog, where the caller supplies its own header and `onCancel` (e.g. closing the
 * dialog) instead.
 */
export function LoanApplicationForm({
  prefillFrom,
  lockedBorrowerId,
  showChrome = true,
  editApplicationId,
  onCreated,
  onCancel,
}: {
  /** 2026-09-10: relaxed from `LoanApplication` to `Partial<LoanApplication>` - `LoanApplicationEntry`
   * now also passes a prefill built straight from a Client Profile (`borrowerToApplicationPrefill`)
   * when the client has no previous Loan Application on file, which has no loan-specific/co-borrower/
   * account fields to offer. Every field read below already falls back to a blank default via `?.`,
   * so this is a type-only relaxation. */
  prefillFrom?: Partial<LoanApplication>;
  lockedBorrowerId?: string;
  showChrome?: boolean;
  /** 2026-08-12 (user request/bug fix): when set, this is LMS staff correcting an application
   * THEY already encoded (via PATCH /loan-applications/:id/intake) instead of creating a new one.
   * `prefillFrom` must be the same application in this mode - it already seeds every field, this
   * flag just swaps the submit action and hides the document-upload section (documents are
   * managed separately, from the Detail page's own Attachments panel, not re-uploaded here). */
  editApplicationId?: string;
  onCreated: (application: LoanApplication, failedDocumentLabels?: string[]) => void;
  onCancel: () => void;
}) {
  const { canAccessLoanApplications, currentAccount, hasPermission } = useRole();
  // 2026-09-10 (user-reported bug): this card was never gated by `ai_extraction.use` - toggling
  // the permission off in Roles & Permissions had no effect on it. Every other AI Auto-fill
  // trigger below (extractMutation, aiExtractedFile upload) stays reachable only through this card.
  const canUseAiExtraction = hasPermission('ai_extraction.use');
  useLogPageView('Loan Applications', showChrome ? 'create-application-form' : 'create-application-dialog');
  const productTypeLabelsQuery = useProductTypeLabels();

  const prefillCoBorrower = React.useMemo(
    () => (prefillFrom?.coBorrowerName ? parseCoBorrowerName(prefillFrom.coBorrowerName) : null),
    [prefillFrom],
  );
  // Prefer the structured first/middle/last fields (2026-07-25+ intakes); fall back to splitting
  // the legacy combined "name (relationship)" string for older applications that never captured
  // co-borrower names separately.
  const prefillCoBorrowerName = React.useMemo(
    () =>
      prefillFrom?.coBorrowerFirstName || prefillFrom?.coBorrowerLastName
        ? {
            firstName: prefillFrom.coBorrowerFirstName ?? '',
            middleName: prefillFrom.coBorrowerMiddleName ?? '',
            lastName: prefillFrom.coBorrowerLastName ?? '',
          }
        : prefillCoBorrower
          ? splitFullName(prefillCoBorrower.name)
          : null,
    [prefillFrom, prefillCoBorrower],
  );

  // §1 - referral
  const [referralSource, setReferralSource] = React.useState('Walk-in');
  const [referralDetail, setReferralDetail] = React.useState('');
  // §2 - loan information
  const [accountType, setAccountType] = React.useState<'NEW' | 'RENEWAL'>(lockedBorrowerId ? 'RENEWAL' : 'NEW');
  const [loanCategory, setLoanCategory] = React.useState(prefillFrom?.requestedCategory ?? '');
  const [requestedAmount, setRequestedAmount] = React.useState(prefillFrom ? String(prefillFrom.requestedAmount) : '');
  const [requestedTermMonths, setRequestedTermMonths] = React.useState(prefillFrom ? String(prefillFrom.requestedTermMonths) : '');
  const [loanPurpose, setLoanPurpose] = React.useState(prefillFrom?.loanPurpose ?? '');
  // §3 - personal information
  const prefillName = React.useMemo(() => (prefillFrom ? splitFullName(prefillFrom.applicantName ?? '') : null), [prefillFrom]);
  const [firstName, setFirstName] = React.useState(prefillName?.firstName ?? '');
  const [middleName, setMiddleName] = React.useState(prefillName?.middleName ?? '');
  const [lastName, setLastName] = React.useState(prefillName?.lastName ?? '');
  const [nickname, setNickname] = React.useState('');
  const [gender, setGender] = React.useState(prefillFrom?.gender ?? '');
  const [civilStatus, setCivilStatus] = React.useState(prefillFrom?.civilStatus ?? '');
  const [nationality, setNationality] = React.useState(prefillFrom?.nationality ?? 'Filipino');
  const [dateOfBirth, setDateOfBirth] = React.useState(prefillFrom?.birthDate ? prefillFrom.birthDate.slice(0, 10) : '');
  const [placeOfBirth, setPlaceOfBirth] = React.useState(prefillFrom?.placeOfBirth ?? '');
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(
    prefillFrom
      ? {
          houseUnitNumber: prefillFrom.houseUnitNumber ?? '',
          street: prefillFrom.street ?? '',
          barangay: prefillFrom.barangay ?? '',
          cityMunicipality: prefillFrom.cityMunicipality ?? '',
          province: prefillFrom.province ?? '',
          zipCode: prefillFrom.zipCode ?? '',
        }
      : emptyAddressDraft(),
  );
  const [aiSuggestedAddress, setAiSuggestedAddress] = React.useState<string | null>(null);
  const [sameAsPresentAddress, setSameAsPresentAddress] = React.useState(true);
  const [previousAddressDraft, setPreviousAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());
  const [homeOwnership, setHomeOwnership] = React.useState(prefillFrom?.homeOwnership ?? '');
  // 2026-08-27 (user request): present address only, matches the paper form's own scope - same
  // Years/Months split convention as ClientCreatePage.tsx.
  const [presentStayYears, setPresentStayYears] = React.useState('');
  const [presentStayMonths, setPresentStayMonths] = React.useState('');
  const [mobileNo, setMobileNo] = React.useState(prefillFrom?.mobilePhone ?? '');
  const [email, setEmail] = React.useState(prefillFrom?.email ?? '');
  const [facebookLink, setFacebookLink] = React.useState(prefillFrom?.facebookLink ?? '');
  // §4 - employment
  const [employer, setEmployer] = React.useState(prefillFrom?.employer ?? '');
  const [occupation, setOccupation] = React.useState(prefillFrom?.occupation ?? '');
  const [officeAddress, setOfficeAddress] = React.useState(prefillFrom?.officeAddress ?? '');
  const [monthlyIncome, setMonthlyIncome] = React.useState(String(prefillFrom?.monthlyIncome ?? ''));
  const [tin, setTin] = React.useState(prefillFrom?.tinNumber ?? '');
  const [sss, setSss] = React.useState(prefillFrom?.sssNumber ?? '');
  // §5 - dependants
  const [dependants, setDependants] = React.useState<DependantRow[]>(
    prefillFrom?.dependants?.map((d) => ({ name: d.name, age: d.age ?? '', relationship: d.relationship ?? '' })) ?? [],
  );
  // §6 - spouse
  const [spouseName, setSpouseName] = React.useState('');
  const [spouseEmployer, setSpouseEmployer] = React.useState('');
  // §7/§8 - co-borrower
  const [hasCoBorrower, setHasCoBorrower] = React.useState(Boolean(prefillFrom?.coBorrowerName));
  const [coBorrowerFirstName, setCoBorrowerFirstName] = React.useState(prefillCoBorrowerName?.firstName ?? '');
  const [coBorrowerMiddleName, setCoBorrowerMiddleName] = React.useState(prefillCoBorrowerName?.middleName ?? '');
  const [coBorrowerLastName, setCoBorrowerLastName] = React.useState(prefillCoBorrowerName?.lastName ?? '');
  const [coBorrowerRelationship, setCoBorrowerRelationship] = React.useState(prefillCoBorrower?.relationship ?? '');
  const [coBorrowerContactNumber, setCoBorrowerContactNumber] = React.useState(prefillFrom?.coBorrowerContactNumber ?? '');
  const [coBorrowerEmail, setCoBorrowerEmail] = React.useState(prefillFrom?.coBorrowerEmail ?? '');
  const [coBorrowerAddress, setCoBorrowerAddress] = React.useState(prefillFrom?.coBorrowerAddress ?? '');

  // Only offered when this form was opened FROM an existing client (lockedBorrowerId set, the
  // renewal flow) - pulls that client's own past applications to find co-borrowers they've used
  // before, so staff can pick one instead of re-typing the same person's details every renewal.
  // Never shown for the original walk-in intake flow (no borrower/history exists yet). No
  // borrowerId filter exists on GET /loan-applications yet, so this fetches every application and
  // filters client-side - same pattern ClientProfilePage's own "myApplications" already uses.
  const previousApplicationsQuery = useQuery({
    queryKey: ['loan-applications', 'all', 'coBorrowerHistory'],
    queryFn: () => fetchAllPages<LoanApplication>('/loan-applications'),
    enabled: Boolean(lockedBorrowerId),
  });
  const previousCoBorrowers = React.useMemo(() => {
    const seen = new Map<string, { name: string; relationship: string; contactNumber: string; email: string; address: string }>();
    for (const app of previousApplicationsQuery.data ?? []) {
      if (app.borrowerId !== lockedBorrowerId) continue;
      if (!app.coBorrowerName) continue;
      const parsed = parseCoBorrowerName(app.coBorrowerName);
      if (!parsed.name || seen.has(parsed.name)) continue;
      seen.set(parsed.name, {
        name: parsed.name,
        relationship: parsed.relationship,
        contactNumber: app.coBorrowerContactNumber ?? '',
        email: app.coBorrowerEmail ?? '',
        address: app.coBorrowerAddress ?? '',
      });
    }
    return [...seen.values()];
  }, [previousApplicationsQuery.data]);

  const applyPreviousCoBorrower = (name: string) => {
    const match = previousCoBorrowers.find((c) => c.name === name);
    if (!match) return;
    const split = splitFullName(match.name);
    setCoBorrowerFirstName(split.firstName);
    setCoBorrowerMiddleName(split.middleName);
    setCoBorrowerLastName(split.lastName);
    setCoBorrowerRelationship(match.relationship);
    setCoBorrowerContactNumber(match.contactNumber);
    setCoBorrowerEmail(match.email);
    setCoBorrowerAddress(match.address);
  };
  // §9 - character references
  const [reference1, setReference1] = React.useState({
    name: prefillFrom?.reference1Name ?? '',
    mobile: prefillFrom?.reference1Mobile ?? '',
  });
  const [reference2, setReference2] = React.useState({
    name: prefillFrom?.reference2Name ?? '',
    mobile: prefillFrom?.reference2Mobile ?? '',
  });
  const [note, setNote] = React.useState('');
  // Applicant Documents - real files, saved as categorized attachments once the application exists.
  const [documentFiles, setDocumentFiles] = React.useState<Partial<Record<AttachmentDocumentCategory, File>>>({});
  const [documentFileErrors, setDocumentFileErrors] = React.useState<Partial<Record<AttachmentDocumentCategory, string>>>({});
  // Other Supporting Documents - uncategorized, multi-file upload for anything that doesn't fit
  // one of the specific slots above (e.g. additional proof of income, extra IDs).
  const [otherDocumentFiles, setOtherDocumentFiles] = React.useState<File[]>([]);
  const [otherDocumentFileError, setOtherDocumentFileError] = React.useState<string | null>(null);
  const otherDocumentsInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // AI auto-fill - local Ollama (moondream) only, never a cloud service. Ephemeral: the uploaded
  // file is sent for extraction only, never saved here (see aiExtractionRouter.ts's doc comment).
  const aiFileInputRef = React.useRef<HTMLInputElement>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [aiFilledFieldLabels, setAiFilledFieldLabels] = React.useState<string[]>([]);
  const [aiApplied, setAiApplied] = React.useState(false);
  // Retained only after a successful extraction, so it can be auto-saved as a real attachment once
  // the application record (and a real ownerId) exists - see createMutation's onSuccess below.
  const [aiExtractedFile, setAiExtractedFile] = React.useState<File | null>(null);

  // Review step: extraction results land here first, editable, before anything is written into the
  // real form fields - the officer confirms (or corrects) what the AI read before it counts.
  // `null` means the review dialog is closed / nothing pending review.
  interface AiReviewState {
    name: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    employer: string;
    monthlyIncome: string;
    address?: string;
    summary: string;
    warnings: string[];
  }
  const [aiReview, setAiReview] = React.useState<AiReviewState | null>(null);
  const [aiReviewImageUrl, setAiReviewImageUrl] = React.useState<string | null>(null);
  const AI_REVIEW_FIELD_COUNT = 6; // name, DOB, gender, nationality, employer, monthly income

  const extractMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return uploadFile<ExtractedLoanApplicationFields>('/ai-extraction/loan-application-fields', formData);
    },
    onSuccess: (result, file) => {
      setAiExtractedFile(file);
      setAiError(null);
      setAiApplied(false);
      setAiFilledFieldLabels([]);
      setAiReviewImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      });
      setAiReview({
        name: result.applicantName ?? '',
        dateOfBirth: result.dateOfBirth ?? '',
        gender: result.gender && GENDER_OPTIONS.includes(result.gender) ? result.gender : '',
        nationality: result.nationality ?? '',
        employer: result.employer ?? '',
        monthlyIncome: result.monthlyIncome !== undefined ? String(result.monthlyIncome) : '',
        address: result.address,
        summary: result.summary,
        warnings: result.warnings,
      });
    },
    onError: (error) => {
      setAiExtractedFile(null);
      setAiError(error instanceof Error ? error.message : 'Could not process this file.');
      setAiFilledFieldLabels([]);
      setAiReview(null);
    },
  });

  const handleAiFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiError(null);
    setAiExtractedFile(null);
    if (!AI_EXTRACTION_ACCEPTED_MIME.has(file.type)) {
      setAiError('Unsupported file type. Allowed: PDF, JPEG, PNG, DOCX.');
      if (aiFileInputRef.current) aiFileInputRef.current.value = '';
      return;
    }
    extractMutation.mutate(file);
  };

  // Writes the (possibly officer-edited) review values into the real form fields - same "only fill
  // what's currently empty" convention as before, just moved behind an explicit confirm click.
  const applyAiReview = () => {
    if (!aiReview) return;
    const filled: string[] = [];
    if (aiReview.name.trim() && !firstName.trim() && !lastName.trim()) {
      const parsed = splitFullName(aiReview.name.trim());
      setFirstName(parsed.firstName);
      setMiddleName(parsed.middleName);
      setLastName(parsed.lastName);
      filled.push('Name');
    }
    if (aiReview.address && !presentAddress.trim()) {
      // Free-text from the AI can't be mapped into the cascading region/province/city/barangay
      // picker below (no reverse PSGC name lookup - same limitation as `PsgcAddressPicker`'s own
      // doc comment) - surfaced as a suggestion for the officer to select manually instead.
      setAiSuggestedAddress(aiReview.address);
      filled.push('Present address (as a suggestion below - select it manually)');
    }
    if (aiReview.employer.trim() && !employer.trim()) {
      setEmployer(aiReview.employer.trim());
      filled.push('Employer');
    }
    if (aiReview.monthlyIncome.trim() && !monthlyIncome.trim()) {
      setMonthlyIncome(aiReview.monthlyIncome.trim());
      filled.push('Monthly income');
    }
    if (aiReview.dateOfBirth && !dateOfBirth) {
      setDateOfBirth(aiReview.dateOfBirth);
      filled.push('Date of birth');
    }
    if (aiReview.gender && GENDER_OPTIONS.includes(aiReview.gender) && !gender) {
      setGender(aiReview.gender);
      filled.push('Gender');
    }
    if (aiReview.nationality.trim() && !nationality.trim()) {
      setNationality(aiReview.nationality.trim());
      filled.push('Nationality');
    }
    setAiFilledFieldLabels(filled);
    setAiApplied(true);
    setAiReview(null);
  };

  const dismissAiReview = () => {
    setAiReview(null);
    setAiExtractedFile(null);
    if (aiReviewImageUrl) URL.revokeObjectURL(aiReviewImageUrl);
    setAiReviewImageUrl(null);
  };

  React.useEffect(() => () => { if (aiReviewImageUrl) URL.revokeObjectURL(aiReviewImageUrl); }, [aiReviewImageUrl]);

  const handleDocumentFileSelected = (category: AttachmentDocumentCategory, file: File) => {
    if (!ATTACHMENT_ACCEPTED_MIME.has(file.type)) {
      setDocumentFileErrors((prev) => ({ ...prev, [category]: 'Unsupported file type. Allowed: PDF, JPEG, PNG.' }));
      return;
    }
    if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      setDocumentFileErrors((prev) => ({
        ...prev,
        [category]: `File exceeds the ${ATTACHMENT_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`,
      }));
      return;
    }
    setDocumentFileErrors((prev) => ({ ...prev, [category]: undefined }));
    setDocumentFiles((prev) => ({ ...prev, [category]: file }));
  };

  const handleRemoveDocumentFile = (category: AttachmentDocumentCategory) => {
    setDocumentFiles((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
    setDocumentFileErrors((prev) => ({ ...prev, [category]: undefined }));
  };

  const age = computeAge(dateOfBirth);
  const presentAddress = [addressDraft.houseUnitNumber, addressDraft.street, addressDraft.barangay, addressDraft.cityMunicipality, addressDraft.province]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
  const previousAddress = [
    previousAddressDraft.houseUnitNumber,
    previousAddressDraft.street,
    previousAddressDraft.barangay,
    previousAddressDraft.cityMunicipality,
    previousAddressDraft.province,
  ]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
  const applicantName = [firstName, middleName, lastName].map((p) => p.trim()).filter(Boolean).join(' ');
  const amount = Number(requestedAmount);
  const term = Number(requestedTermMonths);

  const missing: string[] = [];
  if (!firstName.trim() || !lastName.trim()) missing.push('Applicant first and last name (§3)');
  if (!dateOfBirth || age === null) missing.push('Date of birth (§3)');
  // 2026-07-30 (user request): hard eligibility gate, mirrors the Portal's own client-facing form
  // and the backend's CreateLoanApplicationUseCase - applicants under 18 or over 59 cannot be
  // submitted at all, from either channel.
  if (age !== null && (age < 18 || age > 59)) missing.push(`Applicant age must be 18-59 to qualify (computed age: ${age}) (§3)`);
  if (!presentAddress.trim()) missing.push('Present address (§3)');
  if (!loanCategory) missing.push('Type of loan (§2)');
  if (!(amount > 0)) missing.push('Desired loan amount (§2)');
  if (!(term > 0)) missing.push('Loan term in months (§2)');
  const canSubmit = missing.length === 0;

  const visibleDocumentSlots = DOCUMENT_SLOTS.filter((slot) => !slot.showWhen || slot.showWhen({ loanCategory, hasCoBorrower }));

  const handleOtherDocumentFilesSelected = (fileList: FileList) => {
    const files = [...fileList];
    for (const file of files) {
      if (!ATTACHMENT_ACCEPTED_MIME.has(file.type)) {
        setOtherDocumentFileError('Unsupported file type. Allowed: PDF, JPEG, PNG.');
        return;
      }
      if (file.size > ATTACHMENT_MAX_FILE_SIZE_BYTES) {
        setOtherDocumentFileError(`File exceeds the ${ATTACHMENT_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`);
        return;
      }
    }
    setOtherDocumentFileError(null);
    setOtherDocumentFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveOtherDocumentFile = (index: number) => {
    setOtherDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 2026-07-21 (user request) - drives the Underwriting card's Document checklist, which was
  // always empty system-wide (0 of 13 real applications) because nothing populated it: derived
  // from the same categorized upload slots below rather than a separate/divergent checklist, so it
  // always matches what was actually attached, not a duplicate manual tick-list.
  const submittedDocumentLabels = [
    ...Object.keys(documentFiles).map((category) => DOCUMENT_CATEGORY_LABELS[category as AttachmentDocumentCategory]),
    ...(otherDocumentFiles.length > 0 ? ['Other Supporting Document'] : []),
  ];

  const createMutation = useMutation({
    mutationFn: () => {
      const intakeFields = {
        applicantName,
        age: age ?? undefined,
        gender: gender || undefined,
        civilStatus: civilStatus || undefined,
        birthDate: dateOfBirth || undefined,
        placeOfBirth: placeOfBirth.trim() || undefined,
        nationality: nationality.trim() || undefined,
        homeOwnership: homeOwnership || undefined,
        presentAddressLengthOfStayMonths:
          presentStayYears.trim() || presentStayMonths.trim()
            ? (Number.parseInt(presentStayYears, 10) || 0) * 12 + (Number.parseInt(presentStayMonths, 10) || 0)
            : undefined,
        address: presentAddress.trim() || undefined,
        houseUnitNumber: addressDraft.houseUnitNumber.trim() || undefined,
        street: addressDraft.street.trim() || undefined,
        barangay: addressDraft.barangay.trim() || undefined,
        cityMunicipality: addressDraft.cityMunicipality.trim() || undefined,
        province: addressDraft.province.trim() || undefined,
        zipCode: addressDraft.zipCode.trim() || undefined,
        previousAddressSameAsPresent: sameAsPresentAddress,
        ...(sameAsPresentAddress
          ? {}
          : {
              previousAddress: previousAddress.trim() || undefined,
              previousHouseUnitNumber: previousAddressDraft.houseUnitNumber.trim() || undefined,
              previousStreet: previousAddressDraft.street.trim() || undefined,
              previousBarangay: previousAddressDraft.barangay.trim() || undefined,
              previousCityMunicipality: previousAddressDraft.cityMunicipality.trim() || undefined,
              previousProvince: previousAddressDraft.province.trim() || undefined,
              previousZipCode: previousAddressDraft.zipCode.trim() || undefined,
            }),
        employer: employer.trim() || undefined,
        occupation: occupation.trim() || undefined,
        officeAddress: officeAddress.trim() || undefined,
        monthlyIncome: Number(monthlyIncome) > 0 ? Number(monthlyIncome) : undefined,
        tinNumber: tin.trim() || undefined,
        sssNumber: sss.trim() || undefined,
        mobilePhone: mobileNo.trim() || undefined,
        email: email.trim() || undefined,
        facebookLink: facebookLink.trim() || undefined,
        dependants: dependants
          .filter((d) => d.name.trim())
          .map((d) => ({ name: d.name.trim(), age: d.age.trim() || undefined, relationship: d.relationship.trim() || undefined })),
        coBorrowerName:
          hasCoBorrower && (coBorrowerFirstName.trim() || coBorrowerLastName.trim())
            ? `${[coBorrowerFirstName.trim(), coBorrowerMiddleName.trim(), coBorrowerLastName.trim()].filter(Boolean).join(' ')}${coBorrowerRelationship.trim() ? ` (${coBorrowerRelationship.trim().toLowerCase()})` : ''}`
            : undefined,
        coBorrowerFirstName: hasCoBorrower && coBorrowerFirstName.trim() ? coBorrowerFirstName.trim() : undefined,
        coBorrowerMiddleName: hasCoBorrower && coBorrowerMiddleName.trim() ? coBorrowerMiddleName.trim() : undefined,
        coBorrowerLastName: hasCoBorrower && coBorrowerLastName.trim() ? coBorrowerLastName.trim() : undefined,
        coBorrowerContactNumber: hasCoBorrower && coBorrowerContactNumber.trim() ? coBorrowerContactNumber.trim() : undefined,
        coBorrowerEmail: hasCoBorrower && coBorrowerEmail.trim() ? coBorrowerEmail.trim() : undefined,
        coBorrowerAddress: hasCoBorrower && coBorrowerAddress.trim() ? coBorrowerAddress.trim() : undefined,
        reference1Name: reference1.name.trim() || undefined,
        reference1Mobile: reference1.mobile.trim() || undefined,
        reference2Name: reference2.name.trim() || undefined,
        reference2Mobile: reference2.mobile.trim() || undefined,
        note: note.trim() || undefined,
        requestedCategory: loanCategory,
        requestedAmount: amount,
        requestedTermMonths: term,
        referralSource: referralDetail.trim() ? `${referralSource} - ${referralDetail.trim()}` : referralSource,
        accountType,
        loanPurpose: loanPurpose.trim() || undefined,
      };

      if (editApplicationId) {
        return apiClient.patch<LoanApplication>(`/loan-applications/${editApplicationId}/intake`, intakeFields);
      }
      return apiClient.post<LoanApplication>('/loan-applications', {
        branchId: currentAccount.branchId,
        borrowerId: lockedBorrowerId,
        ...intakeFields,
        submittedDocuments: submittedDocumentLabels.length > 0 ? submittedDocumentLabels : undefined,
      } satisfies CreateLoanApplicationRequest);
    },
    onSuccess: async (application) => {
      // 2026-08-12: editing an already-encoded application never touches documents - those are
      // managed separately from the Detail page's own Attachments panel - so there's nothing to
      // upload here, unlike the fresh-creation path below.
      if (editApplicationId) {
        onCreated(application);
        return;
      }

      // Best-effort: auto-save the AI Auto-fill upload and every Applicant Document slot as real
      // attachments now that a real ownerId exists. Deliberately not allowed to affect
      // createMutation's own success/error state - the application has already been created and
      // must not be blocked or rolled back by an attachment-save failure (e.g. a .docx extraction
      // file, which passes the broader AI Auto-fill whitelist but not /attachments' pdf/jpeg/png-only
      // whitelist). `Promise.allSettled` so one failed upload doesn't stop the others.
      const pendingUploads: { file: File; category?: AttachmentDocumentCategory; label: string }[] = [];
      if (aiExtractedFile) pendingUploads.push({ file: aiExtractedFile, label: 'AI Auto-fill document' });
      for (const [category, file] of Object.entries(documentFiles) as [AttachmentDocumentCategory, File][]) {
        pendingUploads.push({ file, category, label: DOCUMENT_CATEGORY_LABELS[category] });
      }
      for (const file of otherDocumentFiles) {
        pendingUploads.push({ file, label: file.name });
      }

      if (pendingUploads.length === 0) {
        onCreated(application);
        return;
      }

      const results = await Promise.allSettled(
        pendingUploads.map(({ file, category }) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('ownerType', 'LOAN_APPLICATION');
          formData.append('ownerId', application.id);
          if (category) formData.append('documentCategory', category);
          return uploadFile('/attachments', formData);
        }),
      );
      const failedLabels = pendingUploads.filter((_, i) => results[i]!.status === 'rejected').map((u) => u.label);

      onCreated(application, failedLabels.length > 0 ? failedLabels : undefined);
    },
  });

  const submit = () => createMutation.mutate();

  // Access gate placed after every hook above (React Hooks rules: never return early before a
  // hook call) - was previously above the createMutation useMutation() call, a real
  // rules-of-hooks violation, not just a lint nag.
  if (!canAccessLoanApplications) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Loan Application Form</h2>
        </div>
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

  return (
    <div className={showChrome ? 'mx-auto max-w-3xl space-y-4' : 'space-y-4'}>
      {showChrome && (
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={onCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">Loan Application Form</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            For walk-in applicants - the loan officer fills this out on the applicant&apos;s behalf, following the official paper form
            (Form No. <span className="font-mono">ECLC-LOFN01</span>, Rev 02). Sample data only - do not enter real client information
            in this preview build.
          </p>
        </div>
      )}

      {canUseAiExtraction && (
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> AI Auto-fill (optional)
          </CardTitle>
          <CardDescription>
            Upload the applicant&apos;s ID, payslip, or other supporting document - a local AI model reads it and suggests values for
            the fields below. It only fills fields you haven&apos;t already typed into, and never submits anything on its own - always
            double-check before submitting. PDF/DOCX support requires text-based files (not scanned images).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {aiError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {aiError}
            </div>
          )}
          {extractMutation.isPending && (
            <div className="flex items-center gap-2.5 rounded-md border border-primary/30 bg-background p-3 text-xs">
              <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-primary" />
              <span className="text-muted-foreground">Reading the document and matching fields…</span>
            </div>
          )}
          {aiApplied && !aiError && (
            <div className="space-y-2 rounded-md border border-primary/30 bg-background p-3 text-xs">
              {aiFilledFieldLabels.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-medium text-primary">Applied to the form - please verify:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {aiFilledFieldLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        <CheckCircle2 className="h-3 w-3" /> {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No empty fields were filled (either nothing was confidently readable, or the fields were already filled in).</p>
              )}
              {aiExtractedFile && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-muted-foreground">
                    This document will be saved as an attachment once the application is created.
                  </p>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setAiExtractedFile(null)}>
                    Remove
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={() => aiFileInputRef.current?.click()}
              >
                <RotateCcw className="mr-1.5 h-3 w-3" /> Scan again
              </Button>
            </div>
          )}
          <input
            ref={aiFileInputRef}
            type="file"
            accept={AI_EXTRACTION_ACCEPTED_TYPES}
            className="hidden"
            onChange={handleAiFileSelected}
            disabled={extractMutation.isPending}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={extractMutation.isPending}
            onClick={() => aiFileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-3.5 w-3.5" /> Upload a file
          </Button>
        </CardContent>
      </Card>
      )}

      <Dialog open={!!aiReview} onOpenChange={(open) => !open && dismissAiReview()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Review the detected fields
            </DialogTitle>
            <DialogDescription>Edit anything that&apos;s wrong before applying it to the form - nothing is saved yet.</DialogDescription>
          </DialogHeader>
          {aiReview && (
            <div className="space-y-3">
              {aiReviewImageUrl && (
                <img src={aiReviewImageUrl} alt="Captured document" className="max-h-40 w-full rounded-md border object-contain" />
              )}
              {(() => {
                const detectedCount = [
                  aiReview.name,
                  aiReview.dateOfBirth,
                  aiReview.gender,
                  aiReview.nationality,
                  aiReview.employer,
                  aiReview.monthlyIncome,
                ].filter((v) => v.trim() !== '').length;
                const allDetected = detectedCount === AI_REVIEW_FIELD_COUNT;
                return (
                  <div
                    className={`flex items-center gap-2 rounded-md border p-2.5 text-xs font-medium ${
                      allDetected ? 'border-primary/30 bg-primary/10 text-primary' : 'border-warning/40 bg-warning/10 text-warning'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {detectedCount} of {AI_REVIEW_FIELD_COUNT} fields clearly detected.
                  </div>
                );
              })()}
              <ReviewField label="Name" badgeOn={aiReview.name.trim() !== ''}>
                <Input value={aiReview.name} onChange={(e) => setAiReview({ ...aiReview, name: e.target.value })} />
              </ReviewField>
              <ReviewField label="Date of birth" badgeOn={aiReview.dateOfBirth.trim() !== ''}>
                <Input type="date" value={aiReview.dateOfBirth} onChange={(e) => setAiReview({ ...aiReview, dateOfBirth: e.target.value })} />
              </ReviewField>
              <ReviewField label="Gender" badgeOn={aiReview.gender.trim() !== ''}>
                <Select value={aiReview.gender || undefined} onValueChange={(v) => setAiReview({ ...aiReview, gender: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not detected" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ReviewField>
              <ReviewField label="Nationality" badgeOn={aiReview.nationality.trim() !== ''}>
                <Input value={aiReview.nationality} onChange={(e) => setAiReview({ ...aiReview, nationality: e.target.value })} />
              </ReviewField>
              <ReviewField label="Employer" badgeOn={aiReview.employer.trim() !== ''}>
                <Input value={aiReview.employer} onChange={(e) => setAiReview({ ...aiReview, employer: e.target.value })} />
              </ReviewField>
              <ReviewField label="Monthly income" badgeOn={aiReview.monthlyIncome.trim() !== ''}>
                <NumberInput min="0" value={aiReview.monthlyIncome} onChange={(e) => setAiReview({ ...aiReview, monthlyIncome: e.target.value })} placeholder="0.00" />
              </ReviewField>
              {aiReview.address && (
                <ReviewField label="Present address (suggestion only - select it manually below)" badgeOn>
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{aiReview.address}</p>
                </ReviewField>
              )}
              {aiReview.warnings.map((w) => (
                <div key={w} className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                  <AlertCircle className="h-3 w-3" /> {w}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{aiReview.summary}</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                dismissAiReview();
                aiFileInputRef.current?.click();
              }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Scan again
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={dismissAiReview}>
                Cancel
              </Button>
              <Button type="button" onClick={applyAiReview}>
                Use this data, continue to form
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SectionCard number="1" title="How did you find out about Easycash?">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source" tooltip="How the applicant learned about Easycash - used for referral tracking.">
            <Select value={referralSource} onValueChange={setReferralSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFERRAL_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {(referralSource === 'Agent/Referral' || referralSource === 'Others') && (
            <Field label={referralSource === 'Agent/Referral' ? 'Agent / referrer name' : 'Please specify'} tooltip="Name of the agent, employee, or person who referred this applicant.">
              <Input value={referralDetail} onChange={(e) => setReferralDetail(e.target.value)} />
            </Field>
          )}
        </div>
      </SectionCard>

      <SectionCard number="2" title="Loan Information">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type of account" tooltip="Is this the applicant's first loan with Easycash, or a renewal/existing account?">
            <Select value={accountType} onValueChange={(v) => setAccountType(v as 'NEW' | 'RENEWAL')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="RENEWAL">Renewal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Type of loan *"
            hint="The paper form also lists OFW, Car, and Real Estate - not currently offered products."
          >
            <Select value={loanCategory} onValueChange={setLoanCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select loan type" />
              </SelectTrigger>
              <SelectContent>
                {LOAN_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.category} value={o.category}>
                    {productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, o.category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Desired loan amount (₱) *" tooltip="The peso amount the applicant is requesting to borrow.">
            <NumberInput min="0" value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} />
          </Field>
          <Field label="Preferred loan term (months) *" tooltip="How many months the applicant wants to repay the loan over.">
            <Select value={requestedTermMonths} onValueChange={setRequestedTermMonths}>
              <SelectTrigger>
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {LOAN_TERM_MONTHS_OPTIONS.map((months) => (
                  <SelectItem key={months} value={String(months)}>
                    {months}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-3">
          <Field label="What is the loan purpose?" tooltip="Brief reason the applicant is borrowing (e.g. tuition, medical, business capital).">
            <Textarea rows={2} value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard number="3" title="Personal Information">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="First name *" tooltip="Applicant's legal first name, as shown on a valid ID.">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Middle name" tooltip="Applicant's legal middle name, if any.">
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Last name *" tooltip="Applicant's legal surname, as shown on a valid ID.">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Nickname" tooltip="Optional - what the applicant is commonly called.">
            <Input value={nickname} onChange={(e) => setNickname(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Gender" tooltip="Applicant's gender, as shown on a valid ID.">
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {toProperCase(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Civil status" tooltip="Applicant's current civil status (Single, Married, Widower, Separated).">
            <Select value={civilStatus} onValueChange={setCivilStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {CIVIL_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {toProperCase(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date of birth *" hint={age !== null ? `Age: ${age}` : undefined} tooltip="Used to compute age and check loan eligibility (18-55 years old).">
            <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </Field>
          <Field label="Place of birth" tooltip="City/municipality where the applicant was born.">
            <Input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
          </Field>
          <Field label="Nationality" tooltip="Applicant's citizenship.">
            <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </Field>
          <Field label="Contact Number" tooltip="Applicant's active mobile number for SMS/call follow-ups.">
            <PhoneInput value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} placeholder="917 XXX XXXX" />
          </Field>
          <Field label="Email address" tooltip="Applicant's email, if available - used for document copies or notices.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Facebook Link" tooltip="Applicant's Facebook profile/page URL, if available - for verification/contact purposes.">
            <Input value={facebookLink} onChange={(e) => setFacebookLink(e.target.value)} placeholder="https://facebook.com/username" />
          </Field>
        </div>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Present address *</Label>
            {aiSuggestedAddress && (
              <p className="text-[11px] text-primary">
                AI-suggested (from the uploaded document, verify and select manually): {aiSuggestedAddress}
              </p>
            )}
            <PsgcAddressPicker
              value={addressDraft}
              onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...upperAddressPatch(patch) }))}
            />
          </div>
          <div className="space-y-1.5 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Previous address</Label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={sameAsPresentAddress}
                  onChange={(e) => setSameAsPresentAddress(e.target.checked)}
                />
                Same as present address
              </label>
            </div>
            {!sameAsPresentAddress && (
              <PsgcAddressPicker
                value={previousAddressDraft}
                onChange={(patch) => setPreviousAddressDraft((prev) => ({ ...prev, ...upperAddressPatch(patch) }))}
              />
            )}
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Home ownership" tooltip="Whether the applicant owns, rents, or has another arrangement for their home.">
            <Select value={homeOwnership} onValueChange={setHomeOwnership}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {HOME_OWNERSHIP_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Length of stay (years)" tooltip="How long the applicant has lived at their present address.">
            <Input type="number" min="0" value={presentStayYears} onChange={(e) => setPresentStayYears(e.target.value)} />
          </Field>
          <Field label="Length of stay (months)">
            <Input type="number" min="0" max="11" value={presentStayMonths} onChange={(e) => setPresentStayMonths(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        number="4"
        title="Employment Information"
        description="Skip if the applicant is unemployed, self-employed, or retired (per the paper form)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name of employer" tooltip="Applicant's current employer or business name.">
            <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
          </Field>
          <Field label="Occupation" tooltip="Applicant's job title or role.">
            <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Office address" tooltip="Address of the applicant's workplace.">
              <Input value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} />
            </Field>
          </div>
          <Field label="Monthly income" tooltip="Applicant's gross monthly income - used for the Risk Management pre-qualification assessment.">
            <NumberInput min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="TIN" tooltip="Applicant's Tax Identification Number (BIR), if available.">
            <GroupedDigitsInput value={tin} onChange={(e) => setTin(e.target.value)} />
          </Field>
          <Field label="SSS no." tooltip="Applicant's Social Security System number, if available.">
            <GroupedDigitsInput value={sss} onChange={(e) => setSss(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard number="5" title="Dependants">
        <div className="space-y-2">
          {dependants.map((row, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <Field label="Name" tooltip="Dependant's full name.">
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      setDependants((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value.toUpperCase() } : r)))
                    }
                  />
                </Field>
              </div>
              <div className="w-20">
                <Field label="Age" tooltip="Dependant's age.">
                  <Input
                    type="number"
                    value={row.age}
                    onChange={(e) => setDependants((prev) => prev.map((r, j) => (j === i ? { ...r, age: e.target.value } : r)))}
                  />
                </Field>
              </div>
              <div className="w-36">
                <Field label="Relationship" tooltip="Dependant's relationship to the applicant (e.g. child, parent).">
                  <Input
                    value={row.relationship}
                    onChange={(e) =>
                      setDependants((prev) => prev.map((r, j) => (j === i ? { ...r, relationship: e.target.value } : r)))
                    }
                  />
                </Field>
              </div>
              <Button variant="ghost" size="icon" aria-label="Remove dependant" onClick={() => setDependants((prev) => prev.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setDependants((prev) => [...prev, { name: '', age: '', relationship: '' }])}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add dependant
          </Button>
        </div>
      </SectionCard>

      {civilStatus === 'MARRIED' && (
        <SectionCard
          number="6"
          title="Spouse Personal & Employment Information"
          description="Shown because civil status is Married (the paper form skips this for single/widower/separated)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Spouse full name" tooltip="Full name of the applicant's spouse, if married.">
              <Input value={spouseName} onChange={(e) => setSpouseName(e.target.value)} />
            </Field>
            <Field label="Spouse employer / occupation" tooltip="Where the applicant's spouse works and their role.">
              <Input value={spouseEmployer} onChange={(e) => setSpouseEmployer(e.target.value)} />
            </Field>
          </div>
        </SectionCard>
      )}

      <SectionCard number="7–8" title="Co-Borrower">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={hasCoBorrower}
            onChange={(e) => setHasCoBorrower(e.target.checked)}
          />
          This application has a co-borrower
        </label>
        {hasCoBorrower && (
          <div className="mt-3 space-y-3">
            {/* Existing-client flow only (opened with lockedBorrowerId, e.g. Client Profile's
                "Create Loan Application") - lets staff reuse a co-borrower this same client has
                already used on a past application instead of re-typing their details. Selecting
                one autofills the fields below, which stay freely editable; not selecting anything
                just leaves them blank for a brand-new co-borrower. Never shown on the original
                walk-in intake form - no client/history exists yet to pull from. */}
            {lockedBorrowerId && previousCoBorrowers.length > 0 && (
              <Field label="Use a previous co-borrower" tooltip="Autofills the fields below from a co-borrower this client has used before - still editable after.">
                <Select onValueChange={applyPreviousCoBorrower}>
                  <SelectTrigger>
                    <SelectValue placeholder={previousApplicationsQuery.isLoading ? 'Loading…' : 'Select a previous co-borrower...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {previousCoBorrowers.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                        {c.relationship ? ` (${c.relationship})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Co-borrower first name" tooltip="Co-borrower's legal first name, as shown on a valid ID.">
                <Input value={coBorrowerFirstName} onChange={(e) => setCoBorrowerFirstName(e.target.value.toUpperCase())} />
              </Field>
              <Field label="Co-borrower middle name" tooltip="Co-borrower's legal middle name, if any.">
                <Input value={coBorrowerMiddleName} onChange={(e) => setCoBorrowerMiddleName(e.target.value.toUpperCase())} />
              </Field>
              <Field label="Co-borrower last name" tooltip="Co-borrower's legal surname, as shown on a valid ID.">
                <Input value={coBorrowerLastName} onChange={(e) => setCoBorrowerLastName(e.target.value.toUpperCase())} />
              </Field>
              <Field label="Relationship to applicant" tooltip="How the co-borrower is related to the applicant (e.g. spouse, sibling).">
                <Input placeholder="e.g. Spouse" value={coBorrowerRelationship} onChange={(e) => setCoBorrowerRelationship(e.target.value)} />
              </Field>
              <Field label="Co-borrower contact number" tooltip="Co-borrower's active mobile number.">
                <PhoneInput value={coBorrowerContactNumber} onChange={(e) => setCoBorrowerContactNumber(e.target.value)} placeholder="917 XXX XXXX" />
              </Field>
              <Field label="Co-borrower email address" tooltip="Co-borrower's email, if available.">
                <Input type="email" value={coBorrowerEmail} onChange={(e) => setCoBorrowerEmail(e.target.value)} />
              </Field>
              <Field label="Co-borrower address" tooltip="Co-borrower's home address." className="sm:col-span-2">
                <Input value={coBorrowerAddress} onChange={(e) => setCoBorrowerAddress(e.target.value)} />
              </Field>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard number="9" title="Character References">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="1st reference - full name" tooltip="A character reference the branch can contact - not a co-borrower.">
            <Input value={reference1.name} onChange={(e) => setReference1((r) => ({ ...r, name: e.target.value.toUpperCase() }))} />
          </Field>
          <Field label="1st reference - contact number" tooltip="This reference's mobile number.">
            <PhoneInput value={reference1.mobile} onChange={(e) => setReference1((r) => ({ ...r, mobile: e.target.value }))} placeholder="917 XXX XXXX" />
          </Field>
          <Field label="2nd reference - full name" tooltip="A second character reference, different from the first.">
            <Input value={reference2.name} onChange={(e) => setReference2((r) => ({ ...r, name: e.target.value.toUpperCase() }))} />
          </Field>
          <Field label="2nd reference - contact number" tooltip="This reference's mobile number.">
            <PhoneInput value={reference2.mobile} onChange={(e) => setReference2((r) => ({ ...r, mobile: e.target.value }))} placeholder="917 XXX XXXX" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard number="10" title="Note" description="Anything else worth recording that doesn't have its own field above - carried over to the Client Profile if this application is later approved and converted.">
        <Field label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Optional - extra information for this application/client" />
        </Field>
      </SectionCard>

      {!editApplicationId && (
        <SectionCard
          number="11"
          title="Applicant Documents"
          description="Upload the applicant's actual supporting documents - PDF, JPEG, or PNG, up to 10 MB each. Saved as attachments on this application once it's created; slots shown depend on the selected loan type and whether there's a co-borrower."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleDocumentSlots.map(({ category }) => (
              <DocumentUploadSlot
                key={category}
                label={DOCUMENT_CATEGORY_LABELS[category]}
                file={documentFiles[category] ?? null}
                error={documentFileErrors[category]}
                onSelect={(file) => handleDocumentFileSelected(category, file)}
                onRemove={() => handleRemoveDocumentFile(category)}
              />
            ))}
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <Label>Other Supporting Documents (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Anything that doesn't fit a slot above - select multiple files at once.
            </p>
            <input
              ref={otherDocumentsInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPTED_TYPES}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) handleOtherDocumentFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => otherDocumentsInputRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Select Files
            </Button>
            {otherDocumentFileError && <p className="text-[11px] text-destructive">{otherDocumentFileError}</p>}
            {otherDocumentFiles.length > 0 && (
              <ul className="space-y-1.5">
                {otherDocumentFiles.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <span className="min-w-0 truncate">{file.name}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={() => handleRemoveOtherDocumentFile(i)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          {missing.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-warning">Required before submitting:</p>
              <ul className="mt-1 list-inside list-disc">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {editApplicationId
              ? 'Credit score and properties owned are edited from the application\'s Risk Management Summary, not here. Documents are managed from the Attachments panel.'
              : "Monthly income, credit score, and properties owned are recorded after creation, on the application's Risk Management Summary. Spouse details are captured on the paper form itself and not yet stored by this preview. The applicant signs the Undertaking on the printed form - no signature is captured here."}
          </p>
          {createMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {createMutation.error instanceof Error ? createMutation.error.message : 'Could not save the application.'}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => setConfirmOpen(true)}>
              <FilePlus2 className="mr-2 h-4 w-4" /> {editApplicationId ? 'Save Changes' : 'Confirm'}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editApplicationId ? 'Save these changes?' : 'Create this loan application?'}</DialogTitle>
            <DialogDescription>
              {editApplicationId ? (
                <>
                  {applicantName || 'Applicant'} - {loanCategory || 'no category'} · {amount > 0 ? formatPeso(amount) : '₱0.00'} ·{' '}
                  {term > 0 ? `${term} months` : 'no term'}. Re-runs the pre-approved/pre-declined classification with the updated
                  details.
                </>
              ) : (
                <>
                  {applicantName || 'Applicant'} - {loanCategory || 'no category'} · {amount > 0 ? formatPeso(amount) : '₱0.00'} ·{' '}
                  {term > 0 ? `${term} months` : 'no term'}. The system will automatically classify this application as pre-approved or
                  pre-declined based on age, income, and address once created, encoded by {currentAccount.name}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                submit();
              }}
            >
              {editApplicationId ? 'Save Changes' : 'Create Loan Applicant Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
