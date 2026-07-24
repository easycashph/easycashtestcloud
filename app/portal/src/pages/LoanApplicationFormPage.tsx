import * as React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';
import { PortalAddressPicker, emptyAddressDraft, type AddressDraft } from '@/components/PortalAddressPicker';
import type {
  PortalBranch,
  PortalDocumentCategory,
  PortalLoanApplicationDetail,
  PortalLoanApplicationSummary,
  SubmitLoanApplicationRequest,
} from '@/lib/portalApiTypes';

const LOAN_CATEGORIES = LOAN_PRODUCTS.map((p) => p.category);
const GENDER_OPTIONS = ['Female', 'Male'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widower', 'Separated'];
const HOME_OWNERSHIP_OPTIONS = ['Owned', 'Renting', 'Living with family'];
const REFERRAL_OPTIONS = ['Walk-in', 'Website', 'Facebook', 'Internet', 'Flyers/Signages/Streamers', 'Agent/Referral', 'Others'];

const DOCUMENT_LABELS: Record<PortalDocumentCategory, string> = {
  VALID_ID_BORROWER: 'Valid ID',
  VALID_ID_CO_BORROWER: 'Valid ID (Co-Borrower)',
  PROOF_OF_BILLING: 'Proof of Billing',
  EMPLOYEE_ID: 'Employee ID',
  BUSINESS_CLEARANCE: 'Business Clearance',
  CORPORATE_PAYSLIP: 'Payslip',
  SEAMANS_BOOK: "Seaman's Book",
  OVERSEAS_EMPLOYMENT_CERTIFICATE: 'Overseas Employment Certificate',
};

/** Mirrors the staff form's DOCUMENT_SLOTS showWhen logic exactly (LoanApplicationCreatePage.tsx)
 * - only PROFILE_PICTURE is dropped (see backend's portalLoanApplicationSchemas.ts doc comment). */
const DOCUMENT_SLOTS: { category: PortalDocumentCategory; showWhen?: (ctx: { loanCategory: string; hasCoBorrower: boolean }) => boolean }[] = [
  { category: 'VALID_ID_BORROWER' },
  { category: 'VALID_ID_CO_BORROWER', showWhen: (ctx) => ctx.hasCoBorrower },
  { category: 'PROOF_OF_BILLING' },
  { category: 'EMPLOYEE_ID', showWhen: (ctx) => ctx.loanCategory === 'Salary Loan' },
  { category: 'CORPORATE_PAYSLIP', showWhen: (ctx) => ctx.loanCategory === 'Salary Loan' },
  { category: 'BUSINESS_CLEARANCE', showWhen: (ctx) => ctx.loanCategory === 'Business Loan' },
  { category: 'SEAMANS_BOOK', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
  { category: 'OVERSEAS_EMPLOYMENT_CERTIFICATE', showWhen: (ctx) => ctx.loanCategory === 'Seafarer Loan' },
];

/** Numbered section, matching the internal LMS staff-facing form's convention (mirrors the
 * printed loan application form, Form No. ECLC-LOFN01). 2026-07-24 (user request): expanded to
 * the full field set the staff form captures - only AI Auto-fill, "use a previous co-borrower"
 * (a cross-client history lookup - data-leak risk if public), and encodedByUserId (no staff
 * encoder for a self-service submission) are excluded. See PortalLoanApplicationDtos.ts's doc
 * comment on the backend for the same list. */
function SectionCard({ number, title, description, children }: { number: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-sm font-semibold text-primary">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{number}.</span>
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5${className ? ` ${className}` : ''}`}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface DependantRow {
  name: string;
  age: string;
  relationship: string;
}

interface FormState {
  // §1 Referral
  referralSource: string;
  referralDetail: string;
  // §2 Loan Information
  accountType: 'NEW' | 'RENEWAL';
  branchId: string;
  requestedCategory: string;
  requestedAmount: string;
  requestedTermMonths: string;
  loanPurpose: string;
  // §3 Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  civilStatus: string;
  nationality: string;
  birthDate: string;
  placeOfBirth: string;
  presentAddress: AddressDraft;
  sameAsPresentAddress: boolean;
  previousAddress: AddressDraft;
  homeOwnership: string;
  mobilePhone: string;
  email: string;
  // §4 Employment Information
  employer: string;
  occupation: string;
  officeAddress: string;
  monthlyIncome: string;
  tinNumber: string;
  sssNumber: string;
  // §5 Dependants
  dependants: DependantRow[];
  // §6 Spouse (shown only when civilStatus === 'Married')
  spouseName: string;
  spouseEmployer: string;
  // §7 Co-Borrower
  hasCoBorrower: boolean;
  coBorrowerName: string;
  coBorrowerRelationship: string;
  coBorrowerEmployer: string;
  coBorrowerContactNumber: string;
  coBorrowerEmail: string;
  coBorrowerAddress: string;
  // §8 Character References
  reference1Name: string;
  reference1Mobile: string;
  reference2Name: string;
  reference2Mobile: string;
  // §9 Note
  note: string;
}

const INITIAL_FORM: FormState = {
  referralSource: 'Website',
  referralDetail: '',
  accountType: 'NEW',
  branchId: '',
  requestedCategory: '',
  requestedAmount: '',
  requestedTermMonths: '',
  loanPurpose: '',
  firstName: '',
  middleName: '',
  lastName: '',
  gender: '',
  civilStatus: '',
  nationality: 'Filipino',
  birthDate: '',
  placeOfBirth: '',
  presentAddress: emptyAddressDraft(),
  sameAsPresentAddress: true,
  previousAddress: emptyAddressDraft(),
  homeOwnership: '',
  mobilePhone: '',
  email: '',
  employer: '',
  occupation: '',
  officeAddress: '',
  monthlyIncome: '',
  tinNumber: '',
  sssNumber: '',
  dependants: [],
  spouseName: '',
  spouseEmployer: '',
  hasCoBorrower: false,
  coBorrowerName: '',
  coBorrowerRelationship: '',
  coBorrowerEmployer: '',
  coBorrowerContactNumber: '',
  coBorrowerEmail: '',
  coBorrowerAddress: '',
  reference1Name: '',
  reference1Mobile: '',
  reference2Name: '',
  reference2Mobile: '',
  note: '',
};

function addressToRequestFields(address: AddressDraft) {
  return {
    houseUnitNumber: address.houseUnitNumber.trim() || undefined,
    street: address.street.trim() || undefined,
    barangay: address.barangay.trim() || undefined,
    cityMunicipality: address.cityMunicipality.trim() || undefined,
    province: address.province.trim() || undefined,
    zipCode: address.zipCode.trim() || undefined,
  };
}

function addressToText(address: AddressDraft): string {
  return [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

/** Splits a stored combined applicant name back into the form's separate first/middle/last
 * inputs when prefilling an edit - a plain heuristic (first token / last token / everything
 * between), matching the internal LMS's own splitFullName() convention. */
function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0]!, middleName: '', lastName: parts[1]! };
  return { firstName: parts[0]!, middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1]! };
}

/** Reverses the "Name (relationship)" convention handleSubmit's coBorrowerName combines - used to
 * prefill the edit form's separate name/relationship inputs. */
function parseCoBorrowerName(coBorrowerName: string): { name: string; relationship: string } {
  const match = coBorrowerName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1]!.trim(), relationship: match[2]!.trim() };
  return { name: coBorrowerName.trim(), relationship: '' };
}

function detailToFormState(detail: PortalLoanApplicationDetail): FormState {
  const name = splitFullName(detail.applicantName);
  const coBorrower = detail.coBorrowerName ? parseCoBorrowerName(detail.coBorrowerName) : { name: '', relationship: '' };
  const [referralSource, ...referralDetailParts] = (detail.referralSource ?? 'Website').split(' - ');
  return {
    ...INITIAL_FORM,
    referralSource: referralSource || 'Website',
    referralDetail: referralDetailParts.join(' - '),
    accountType: detail.accountType ?? 'NEW',
    branchId: detail.branchId,
    requestedCategory: detail.requestedCategory,
    requestedAmount: String(detail.requestedAmount),
    requestedTermMonths: String(detail.requestedTermMonths),
    loanPurpose: detail.loanPurpose ?? '',
    firstName: name.firstName,
    middleName: name.middleName,
    lastName: name.lastName,
    gender: detail.gender ?? '',
    civilStatus: detail.civilStatus ?? '',
    nationality: detail.nationality ?? 'Filipino',
    birthDate: detail.birthDate ? detail.birthDate.slice(0, 10) : '',
    placeOfBirth: detail.placeOfBirth ?? '',
    presentAddress: {
      houseUnitNumber: detail.houseUnitNumber ?? '',
      street: detail.street ?? '',
      barangay: detail.barangay ?? '',
      cityMunicipality: detail.cityMunicipality ?? '',
      province: detail.province ?? '',
      zipCode: detail.zipCode ?? '',
    },
    sameAsPresentAddress: detail.previousAddressSameAsPresent,
    previousAddress: {
      houseUnitNumber: detail.previousHouseUnitNumber ?? '',
      street: detail.previousStreet ?? '',
      barangay: detail.previousBarangay ?? '',
      cityMunicipality: detail.previousCityMunicipality ?? '',
      province: detail.previousProvince ?? '',
      zipCode: detail.previousZipCode ?? '',
    },
    homeOwnership: detail.homeOwnership ?? '',
    mobilePhone: detail.mobilePhone ?? '',
    email: detail.email ?? '',
    employer: detail.employer ?? '',
    occupation: detail.occupation ?? '',
    officeAddress: detail.officeAddress ?? '',
    monthlyIncome: detail.monthlyIncome ? String(detail.monthlyIncome) : '',
    tinNumber: detail.tinNumber ?? '',
    sssNumber: detail.sssNumber ?? '',
    dependants: (detail.dependants ?? []).map((d) => ({ name: d.name, age: d.age ?? '', relationship: d.relationship ?? '' })),
    hasCoBorrower: Boolean(detail.coBorrowerName),
    coBorrowerName: coBorrower.name,
    coBorrowerRelationship: coBorrower.relationship,
    coBorrowerEmployer: detail.coBorrowerEmployer ?? '',
    coBorrowerContactNumber: detail.coBorrowerContactNumber ?? '',
    coBorrowerEmail: detail.coBorrowerEmail ?? '',
    coBorrowerAddress: detail.coBorrowerAddress ?? '',
    reference1Name: detail.reference1Name ?? '',
    reference1Mobile: detail.reference1Mobile ?? '',
    reference2Name: detail.reference2Name ?? '',
    reference2Mobile: detail.reference2Mobile ?? '',
    note: detail.note ?? '',
  };
}

function computeAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let value = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) value -= 1;
  return value;
}

/** Client-facing loan application form (Phase 2, 2026-07-23; expanded to the full field set
 * 2026-07-24) - the same fields the staff-facing form captures (app/frontend's
 * LoanApplicationCreatePage.tsx), following the same section numbering/grouping/order, minus what
 * genuinely can't apply to public self-service (see SectionCard's own doc comment). Two steps in
 * one page: submit the application, then (optionally) attach supporting documents to the
 * freshly-created record. */
const EDITABLE_STATUSES = new Set(['PREAPPROVED', 'PREDECLINED']);

export function LoanApplicationFormPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(editId);
  const [branches, setBranches] = React.useState<PortalBranch[]>([]);
  // Pre-selects the product when arriving from LoanProductsPage's "Apply Now" (?category=...) -
  // only honored if it's a real, currently-offered category, never trusted blindly from the URL.
  const [form, setForm] = React.useState<FormState>(() => {
    const requestedCategory = searchParams.get('category');
    return requestedCategory && (LOAN_CATEGORIES as string[]).includes(requestedCategory)
      ? { ...INITIAL_FORM, requestedCategory }
      : INITIAL_FORM;
  });
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<PortalLoanApplicationSummary | null>(null);
  const [uploadState, setUploadState] = React.useState<Partial<Record<PortalDocumentCategory, 'idle' | 'uploading' | 'done' | 'error'>>>({});
  // Edit mode only: null while loading, 'not-editable' once loaded but status has moved past
  // PREAPPROVED/PREDECLINED (mirrors the backend's own updateSelfServiceIntake() guard), 'ready'
  // once the fetched record has been mapped into `form`.
  const [editState, setEditState] = React.useState<'loading' | 'not-editable' | 'ready' | 'error'>(isEditMode ? 'loading' : 'ready');
  const [editSaved, setEditSaved] = React.useState(false);

  React.useEffect(() => {
    apiClient
      .get<PortalBranch[]>('/portal/branches')
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  React.useEffect(() => {
    if (!editId) return;
    apiClient
      .get<PortalLoanApplicationDetail>(`/portal/loan-applications/${editId}`)
      .then((detail) => {
        if (!EDITABLE_STATUSES.has(detail.status)) {
          setEditState('not-editable');
          return;
        }
        setForm(detailToFormState(detail));
        setEditState('ready');
      })
      .catch(() => setEditState('error'));
  }, [editId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const age = React.useMemo(() => computeAge(form.birthDate), [form.birthDate]);

  const visibleDocumentSlots = React.useMemo(
    () => DOCUMENT_SLOTS.filter((slot) => !slot.showWhen || slot.showWhen({ loanCategory: form.requestedCategory, hasCoBorrower: form.hasCoBorrower })),
    [form.requestedCategory, form.hasCoBorrower],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const applicantName = [form.firstName, form.middleName, form.lastName].map((p) => p.trim()).filter(Boolean).join(' ');
    const requestedAmount = Number(form.requestedAmount);
    const requestedTermMonths = Number(form.requestedTermMonths);

    if (!applicantName) {
      setError('Enter your first and last name.');
      return;
    }
    if (!form.branchId) {
      setError('Select the branch nearest you.');
      return;
    }
    if (!requestedAmount || requestedAmount <= 0) {
      setError('Enter a valid requested loan amount.');
      return;
    }
    if (!requestedTermMonths || requestedTermMonths <= 0) {
      setError('Enter a valid loan term in months.');
      return;
    }

    setIsSubmitting(true);
    try {
      const body: SubmitLoanApplicationRequest = {
        branchId: form.branchId,
        applicantName,
        age: age ?? undefined,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        civilStatus: form.civilStatus || undefined,
        nationality: form.nationality.trim() || undefined,
        placeOfBirth: form.placeOfBirth.trim() || undefined,
        homeOwnership: form.homeOwnership || undefined,
        address: addressToText(form.presentAddress) || undefined,
        ...addressToRequestFields(form.presentAddress),
        previousAddressSameAsPresent: form.sameAsPresentAddress,
        ...(form.sameAsPresentAddress
          ? {}
          : {
              previousAddress: addressToText(form.previousAddress) || undefined,
              previousHouseUnitNumber: form.previousAddress.houseUnitNumber.trim() || undefined,
              previousStreet: form.previousAddress.street.trim() || undefined,
              previousBarangay: form.previousAddress.barangay.trim() || undefined,
              previousCityMunicipality: form.previousAddress.cityMunicipality.trim() || undefined,
              previousProvince: form.previousAddress.province.trim() || undefined,
              previousZipCode: form.previousAddress.zipCode.trim() || undefined,
            }),
        mobilePhone: form.mobilePhone.trim() || undefined,
        email: form.email.trim() || undefined,
        employer: form.employer.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        officeAddress: form.officeAddress.trim() || undefined,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
        tinNumber: form.tinNumber.trim() || undefined,
        sssNumber: form.sssNumber.trim() || undefined,
        dependants: form.dependants
          .filter((d) => d.name.trim())
          .map((d) => ({ name: d.name.trim(), age: d.age.trim() || undefined, relationship: d.relationship.trim() || undefined })),
        coBorrowerName:
          form.hasCoBorrower && form.coBorrowerName.trim()
            ? `${form.coBorrowerName.trim()}${form.coBorrowerRelationship.trim() ? ` (${form.coBorrowerRelationship.trim().toLowerCase()})` : ''}`
            : undefined,
        coBorrowerEmployer: form.hasCoBorrower && form.coBorrowerEmployer.trim() ? form.coBorrowerEmployer.trim() : undefined,
        coBorrowerContactNumber: form.hasCoBorrower && form.coBorrowerContactNumber.trim() ? form.coBorrowerContactNumber.trim() : undefined,
        coBorrowerEmail: form.hasCoBorrower && form.coBorrowerEmail.trim() ? form.coBorrowerEmail.trim() : undefined,
        coBorrowerAddress: form.hasCoBorrower && form.coBorrowerAddress.trim() ? form.coBorrowerAddress.trim() : undefined,
        reference1Name: form.reference1Name.trim() || undefined,
        reference1Mobile: form.reference1Mobile.trim() || undefined,
        reference2Name: form.reference2Name.trim() || undefined,
        reference2Mobile: form.reference2Mobile.trim() || undefined,
        note: form.note.trim() || undefined,
        referralSource: form.referralDetail.trim() ? `${form.referralSource} - ${form.referralDetail.trim()}` : form.referralSource,
        accountType: form.accountType,
        loanPurpose: form.loanPurpose.trim() || undefined,
        requestedCategory: form.requestedCategory,
        requestedAmount,
        requestedTermMonths,
      };
      if (isEditMode) {
        await apiClient.patch<PortalLoanApplicationDetail>(`/portal/loan-applications/${editId}`, body, true);
        setEditSaved(true);
      } else {
        const result = await apiClient.post<PortalLoanApplicationSummary>('/portal/loan-applications', body, true);
        setSubmitted(result);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${isEditMode ? 'save your changes' : 'submit your application'}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpload = async (category: PortalDocumentCategory, file: File | undefined) => {
    if (!file || !submitted) return;
    setUploadState((prev) => ({ ...prev, [category]: 'uploading' }));
    try {
      await apiClient.postFile(`/portal/loan-applications/${submitted.id}/documents`, file, { documentCategory: category });
      setUploadState((prev) => ({ ...prev, [category]: 'done' }));
    } catch {
      setUploadState((prev) => ({ ...prev, [category]: 'error' }));
    }
  };

  if (isEditMode && editState === 'loading') {
    return (
      <div className="min-h-screen bg-secondary/30 py-10">
        <div className="container max-w-2xl">
          <Card className="p-8 text-center text-sm text-muted-foreground">Loading your application…</Card>
        </div>
      </div>
    );
  }

  if (isEditMode && editState === 'not-editable') {
    return (
      <div className="min-h-screen bg-secondary/30 py-10">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <Alert>This application can no longer be edited - it's already under review or has been decided.</Alert>
            <Button className="mt-6 w-full" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (isEditMode && editState === 'error') {
    return (
      <div className="min-h-screen bg-secondary/30 py-10">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <Alert>Could not load this application. It may not exist, or may belong to a different account.</Alert>
            <Button className="mt-6 w-full" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (isEditMode && editSaved) {
    return (
      <div className="min-h-screen bg-secondary/30 py-10">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <Alert tone="success">Your changes were saved.</Alert>
            <Button className="mt-6 w-full" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-secondary/30 py-10">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <Alert tone="success">Your loan application was submitted. We'll review it and notify you of any updates.</Alert>
            <h1 className="mt-6 text-lg font-bold tracking-tight">10. Applicant Documents (optional)</h1>
            <p className="mt-1 text-sm text-muted-foreground">You can also do this later - our staff may reach out for requirements too.</p>
            <div className="mt-5 space-y-4">
              {visibleDocumentSlots.map((slot) => (
                <div key={slot.category} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">{DOCUMENT_LABELS[slot.category]}</p>
                    <p className="text-xs text-muted-foreground">
                      {uploadState[slot.category] === 'done'
                        ? 'Uploaded'
                        : uploadState[slot.category] === 'uploading'
                          ? 'Uploading…'
                          : uploadState[slot.category] === 'error'
                            ? 'Upload failed - try again'
                            : 'PDF, JPEG, or PNG, up to 10 MB'}
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="w-auto"
                    disabled={uploadState[slot.category] === 'uploading' || uploadState[slot.category] === 'done'}
                    onChange={(e) => handleUpload(slot.category, e.target.files?.[0])}
                  />
                </div>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 py-10">
      <div className="container max-w-2xl">
        <Link to="/dashboard" className="mb-6 flex items-center gap-2.5">
          <img src="./logo-easycash.png" alt="Easycash" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-base font-bold tracking-tight">Easycash Portal</span>
        </Link>
        <Card className="p-8">
          <h1 className="text-xl font-bold tracking-tight">{isEditMode ? 'Edit Loan Application' : 'Loan Application'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fields marked * are required. Everything else can be filled in during review.</p>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            {error && <Alert>{error}</Alert>}

            <SectionCard number="1" title="How did you find out about Easycash?">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Source">
                  <Select value={form.referralSource} onChange={(e) => update('referralSource', e.target.value)}>
                    {REFERRAL_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                {(form.referralSource === 'Agent/Referral' || form.referralSource === 'Others') && (
                  <Field label={form.referralSource === 'Agent/Referral' ? 'Agent / referrer name' : 'Please specify'}>
                    <Input value={form.referralDetail} onChange={(e) => update('referralDetail', e.target.value)} />
                  </Field>
                )}
              </div>
            </SectionCard>

            <SectionCard number="2" title="Loan Information">
              <div className="space-y-1.5">
                <Label htmlFor="branchId">Nearest branch *</Label>
                <Select id="branchId" required value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
                  <option value="">Select a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.address ? ` - ${branch.address}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type of account">
                  <Select value={form.accountType} onChange={(e) => update('accountType', e.target.value as 'NEW' | 'RENEWAL')}>
                    <option value="NEW">New</option>
                    <option value="RENEWAL">Renewal</option>
                  </Select>
                </Field>
                <Field label="Type of loan *">
                  <Select id="requestedCategory" required value={form.requestedCategory} onChange={(e) => update('requestedCategory', e.target.value)}>
                    <option value="">Select</option>
                    {LOAN_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Desired loan amount (₱) *">
                  <Input id="requestedAmount" type="number" min={1} required value={form.requestedAmount} onChange={(e) => update('requestedAmount', e.target.value)} />
                </Field>
                <Field label="Preferred loan term (months) *">
                  <Input id="requestedTermMonths" type="number" min={1} required value={form.requestedTermMonths} onChange={(e) => update('requestedTermMonths', e.target.value)} />
                </Field>
              </div>
              <Field label="What is the loan purpose?">
                <Textarea id="loanPurpose" rows={2} value={form.loanPurpose} onChange={(e) => update('loanPurpose', e.target.value)} />
              </Field>
            </SectionCard>

            <SectionCard number="3" title="Personal Information">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="First name *">
                  <Input id="firstName" required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
                </Field>
                <Field label="Middle name">
                  <Input id="middleName" value={form.middleName} onChange={(e) => update('middleName', e.target.value)} />
                </Field>
                <Field label="Last name *">
                  <Input id="lastName" required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
                </Field>
                <Field label="Gender">
                  <Select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                    <option value="">Select</option>
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Civil status">
                  <Select value={form.civilStatus} onChange={(e) => update('civilStatus', e.target.value)}>
                    <option value="">Select</option>
                    {CIVIL_STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Date of birth *" hint={age !== null ? `Age: ${age}` : undefined}>
                  <Input id="birthDate" type="date" required value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} />
                </Field>
                <Field label="Place of birth">
                  <Input value={form.placeOfBirth} onChange={(e) => update('placeOfBirth', e.target.value)} />
                </Field>
                <Field label="Nationality">
                  <Input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} />
                </Field>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <Label>Present address</Label>
                <PortalAddressPicker value={form.presentAddress} onChange={(patch) => update('presentAddress', { ...form.presentAddress, ...patch })} />
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <Label>Previous address</Label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={form.sameAsPresentAddress}
                      onChange={(e) => update('sameAsPresentAddress', e.target.checked)}
                    />
                    Same as present address
                  </label>
                </div>
                {!form.sameAsPresentAddress && (
                  <PortalAddressPicker value={form.previousAddress} onChange={(patch) => update('previousAddress', { ...form.previousAddress, ...patch })} />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Home ownership">
                  <Select value={form.homeOwnership} onChange={(e) => update('homeOwnership', e.target.value)}>
                    <option value="">Select</option>
                    {HOME_OWNERSHIP_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Contact number">
                  <Input id="mobilePhone" type="tel" value={form.mobilePhone} onChange={(e) => update('mobilePhone', e.target.value)} placeholder="09XX XXX XXXX" />
                </Field>
                <Field label="Email address" className="sm:col-span-2" hint="Uses your account email if left blank.">
                  <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard number="4" title="Employment Information" description="Skip if you're unemployed, self-employed, or retired.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name of employer">
                  <Input id="employer" value={form.employer} onChange={(e) => update('employer', e.target.value)} />
                </Field>
                <Field label="Occupation">
                  <Input id="occupation" value={form.occupation} onChange={(e) => update('occupation', e.target.value)} />
                </Field>
                <Field label="Office address" className="sm:col-span-2">
                  <Input id="officeAddress" value={form.officeAddress} onChange={(e) => update('officeAddress', e.target.value)} />
                </Field>
                <Field label="Monthly income (₱)">
                  <Input id="monthlyIncome" type="number" min={0} value={form.monthlyIncome} onChange={(e) => update('monthlyIncome', e.target.value)} />
                </Field>
                <Field label="TIN">
                  <Input value={form.tinNumber} onChange={(e) => update('tinNumber', e.target.value)} />
                </Field>
                <Field label="SSS no.">
                  <Input value={form.sssNumber} onChange={(e) => update('sssNumber', e.target.value)} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard number="5" title="Dependants">
              <div className="space-y-2">
                {form.dependants.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-40 flex-1 space-y-1.5">
                      <Label>Name</Label>
                      <Input
                        value={row.name}
                        onChange={(e) => update('dependants', form.dependants.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                      />
                    </div>
                    <div className="w-20 space-y-1.5">
                      <Label>Age</Label>
                      <Input
                        type="number"
                        value={row.age}
                        onChange={(e) => update('dependants', form.dependants.map((r, j) => (j === i ? { ...r, age: e.target.value } : r)))}
                      />
                    </div>
                    <div className="w-36 space-y-1.5">
                      <Label>Relationship</Label>
                      <Input
                        value={row.relationship}
                        onChange={(e) => update('dependants', form.dependants.map((r, j) => (j === i ? { ...r, relationship: e.target.value } : r)))}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="sm" aria-label="Remove dependant" onClick={() => update('dependants', form.dependants.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => update('dependants', [...form.dependants, { name: '', age: '', relationship: '' }])}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add dependant
                </Button>
              </div>
            </SectionCard>

            {form.civilStatus === 'Married' && (
              <SectionCard number="6" title="Spouse Personal &amp; Employment Information" description="Shown because civil status is Married.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Spouse full name">
                    <Input value={form.spouseName} onChange={(e) => update('spouseName', e.target.value)} />
                  </Field>
                  <Field label="Spouse employer / occupation">
                    <Input value={form.spouseEmployer} onChange={(e) => update('spouseEmployer', e.target.value)} />
                  </Field>
                </div>
              </SectionCard>
            )}

            <SectionCard number="7" title="Co-Borrower">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={form.hasCoBorrower}
                  onChange={(e) => update('hasCoBorrower', e.target.checked)}
                />
                This application has a co-borrower
              </label>
              {form.hasCoBorrower && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Co-borrower full name">
                    <Input value={form.coBorrowerName} onChange={(e) => update('coBorrowerName', e.target.value)} />
                  </Field>
                  <Field label="Relationship to applicant">
                    <Input placeholder="e.g. Spouse" value={form.coBorrowerRelationship} onChange={(e) => update('coBorrowerRelationship', e.target.value)} />
                  </Field>
                  <Field label="Co-borrower employer">
                    <Input value={form.coBorrowerEmployer} onChange={(e) => update('coBorrowerEmployer', e.target.value)} />
                  </Field>
                  <Field label="Contact number">
                    <Input type="tel" value={form.coBorrowerContactNumber} onChange={(e) => update('coBorrowerContactNumber', e.target.value)} />
                  </Field>
                  <Field label="Email address">
                    <Input type="email" value={form.coBorrowerEmail} onChange={(e) => update('coBorrowerEmail', e.target.value)} />
                  </Field>
                  <Field label="Address" className="sm:col-span-3">
                    <Input value={form.coBorrowerAddress} onChange={(e) => update('coBorrowerAddress', e.target.value)} />
                  </Field>
                </div>
              )}
            </SectionCard>

            <SectionCard number="8" title="Character References">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="1st reference - full name">
                  <Input value={form.reference1Name} onChange={(e) => update('reference1Name', e.target.value)} />
                </Field>
                <Field label="1st reference - contact number">
                  <Input type="tel" value={form.reference1Mobile} onChange={(e) => update('reference1Mobile', e.target.value)} />
                </Field>
                <Field label="2nd reference - full name">
                  <Input value={form.reference2Name} onChange={(e) => update('reference2Name', e.target.value)} />
                </Field>
                <Field label="2nd reference - contact number">
                  <Input type="tel" value={form.reference2Mobile} onChange={(e) => update('reference2Mobile', e.target.value)} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard number="9" title="Note" description="Anything else worth mentioning that doesn't have its own field above.">
              <Textarea rows={3} value={form.note} onChange={(e) => update('note', e.target.value)} placeholder="Optional" />
            </SectionCard>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (isEditMode ? 'Saving…' : 'Submitting…') : isEditMode ? 'Save Changes' : 'Submit Application'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
