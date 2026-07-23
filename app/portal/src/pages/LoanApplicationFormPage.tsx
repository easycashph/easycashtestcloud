import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { PortalBranch, PortalDocumentCategory, PortalLoanApplicationSummary, SubmitLoanApplicationRequest } from '@/lib/portalApiTypes';

const LOAN_CATEGORIES = ['Seafarer Loan', 'Personal Loan', 'SME Loan', 'Salary Loan', 'Purchase Financing'];
const GENDER_OPTIONS = ['Female', 'Male'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widower', 'Separated'];
const HOME_OWNERSHIP_OPTIONS = ['Owned', 'Renting', 'Living with family'];

const DOCUMENT_SLOTS: { category: PortalDocumentCategory; label: string }[] = [
  { category: 'VALID_ID_BORROWER', label: 'Valid ID' },
  { category: 'PROOF_OF_BILLING', label: 'Proof of Billing' },
  { category: 'CORPORATE_PAYSLIP', label: 'Payslip' },
];

/** Numbered section, matching the internal LMS staff-facing form's convention (mirrors the
 * printed loan application form, Form No. ECLC-LOFN01) - "kopyahin ang format ng LMS" (user
 * request, 2026-07-23). Section numbers here are a subset (1/2/3/4/5) since the client-facing
 * portal form is a core-fields-only slice of the staff form - see PortalLoanApplicationDtos.ts's
 * doc comment for what's deliberately left out (referral source, dependants, spouse section,
 * TIN/SSS, credit score, AI auto-fill). */
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

interface FormState {
  // §1 Loan Information
  branchId: string;
  requestedCategory: string;
  requestedAmount: string;
  requestedTermMonths: string;
  loanPurpose: string;
  // §2 Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  civilStatus: string;
  birthDate: string;
  homeOwnership: string;
  houseUnitNumber: string;
  street: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  zipCode: string;
  mobilePhone: string;
  email: string;
  // §3 Employment Information
  employer: string;
  occupation: string;
  officeAddress: string;
  monthlyIncome: string;
  // §4 Co-Borrower
  hasCoBorrower: boolean;
  coBorrowerName: string;
  coBorrowerRelationship: string;
  coBorrowerContactNumber: string;
  coBorrowerEmail: string;
  coBorrowerAddress: string;
  // §5 Character References
  reference1Name: string;
  reference1Mobile: string;
  reference2Name: string;
  reference2Mobile: string;
}

const INITIAL_FORM: FormState = {
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
  birthDate: '',
  homeOwnership: '',
  houseUnitNumber: '',
  street: '',
  barangay: '',
  cityMunicipality: '',
  province: '',
  zipCode: '',
  mobilePhone: '',
  email: '',
  employer: '',
  occupation: '',
  officeAddress: '',
  monthlyIncome: '',
  hasCoBorrower: false,
  coBorrowerName: '',
  coBorrowerRelationship: '',
  coBorrowerContactNumber: '',
  coBorrowerEmail: '',
  coBorrowerAddress: '',
  reference1Name: '',
  reference1Mobile: '',
  reference2Name: '',
  reference2Mobile: '',
};

/** Client-facing loan application form (Phase 2, 2026-07-23) - a core-fields-only subset of the
 * staff-facing form (see backend's PortalLoanApplicationDtos.ts), but following the SAME section
 * numbering/grouping/order as the staff form (app/frontend's LoanApplicationCreatePage.tsx),
 * per user request to match the LMS's format. Two steps in one page: submit the application,
 * then (optionally) attach supporting documents to the freshly-created record. */
export function LoanApplicationFormPage() {
  const navigate = useNavigate();
  const [branches, setBranches] = React.useState<PortalBranch[]>([]);
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<PortalLoanApplicationSummary | null>(null);
  const [uploadState, setUploadState] = React.useState<Record<PortalDocumentCategory, 'idle' | 'uploading' | 'done' | 'error'>>({
    VALID_ID_BORROWER: 'idle',
    PROOF_OF_BILLING: 'idle',
    CORPORATE_PAYSLIP: 'idle',
  });

  React.useEffect(() => {
    apiClient
      .get<PortalBranch[]>('/portal/branches')
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const age = React.useMemo(() => {
    if (!form.birthDate) return null;
    const dob = new Date(form.birthDate);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let value = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) value -= 1;
    return value;
  }, [form.birthDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const applicantName = [form.firstName, form.middleName, form.lastName].map((p) => p.trim()).filter(Boolean).join(' ');
    const address = [form.houseUnitNumber, form.street, form.barangay, form.cityMunicipality, form.province]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(', ');
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
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        civilStatus: form.civilStatus || undefined,
        homeOwnership: form.homeOwnership || undefined,
        address: address || undefined,
        houseUnitNumber: form.houseUnitNumber.trim() || undefined,
        street: form.street.trim() || undefined,
        barangay: form.barangay.trim() || undefined,
        cityMunicipality: form.cityMunicipality.trim() || undefined,
        province: form.province.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
        mobilePhone: form.mobilePhone.trim() || undefined,
        email: form.email.trim() || undefined,
        employer: form.employer.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        officeAddress: form.officeAddress.trim() || undefined,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
        coBorrowerName:
          form.hasCoBorrower && form.coBorrowerName.trim()
            ? `${form.coBorrowerName.trim()}${form.coBorrowerRelationship.trim() ? ` (${form.coBorrowerRelationship.trim().toLowerCase()})` : ''}`
            : undefined,
        coBorrowerContactNumber: form.hasCoBorrower && form.coBorrowerContactNumber.trim() ? form.coBorrowerContactNumber.trim() : undefined,
        coBorrowerEmail: form.hasCoBorrower && form.coBorrowerEmail.trim() ? form.coBorrowerEmail.trim() : undefined,
        coBorrowerAddress: form.hasCoBorrower && form.coBorrowerAddress.trim() ? form.coBorrowerAddress.trim() : undefined,
        reference1Name: form.reference1Name.trim() || undefined,
        reference1Mobile: form.reference1Mobile.trim() || undefined,
        reference2Name: form.reference2Name.trim() || undefined,
        reference2Mobile: form.reference2Mobile.trim() || undefined,
        loanPurpose: form.loanPurpose.trim() || undefined,
        requestedCategory: form.requestedCategory,
        requestedAmount,
        requestedTermMonths,
      };
      const result = await apiClient.post<PortalLoanApplicationSummary>('/portal/loan-applications', body, true);
      setSubmitted(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your application. Please try again.');
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-secondary/30 py-10">
        <div className="container max-w-2xl">
          <Card className="p-8">
            <Alert tone="success">Your loan application was submitted. We'll review it and notify you of any updates.</Alert>
            <h1 className="mt-6 text-lg font-bold tracking-tight">6. Applicant Documents (optional)</h1>
            <p className="mt-1 text-sm text-muted-foreground">You can also do this later - our staff may reach out for requirements too.</p>
            <div className="mt-5 space-y-4">
              {DOCUMENT_SLOTS.map((slot) => (
                <div key={slot.category} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">{slot.label}</p>
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
          <h1 className="text-xl font-bold tracking-tight">Loan Application</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fields marked * are required. Everything else can be filled in during review.</p>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            {error && <Alert>{error}</Alert>}

            <SectionCard number="1" title="Loan Information">
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
              <div className="grid gap-4 sm:grid-cols-3">
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

            <SectionCard number="2" title="Personal Information">
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
                  <Select id="gender" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                    <option value="">Select</option>
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Civil status">
                  <Select id="civilStatus" value={form.civilStatus} onChange={(e) => update('civilStatus', e.target.value)}>
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
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <Label>Present address</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="House/Unit number" className="sm:col-span-2">
                    <Input id="houseUnitNumber" value={form.houseUnitNumber} onChange={(e) => update('houseUnitNumber', e.target.value)} />
                  </Field>
                  <Field label="Street" className="sm:col-span-2">
                    <Input id="street" value={form.street} onChange={(e) => update('street', e.target.value)} />
                  </Field>
                  <Field label="Barangay">
                    <Input id="barangay" value={form.barangay} onChange={(e) => update('barangay', e.target.value)} />
                  </Field>
                  <Field label="City / Municipality">
                    <Input id="cityMunicipality" value={form.cityMunicipality} onChange={(e) => update('cityMunicipality', e.target.value)} />
                  </Field>
                  <Field label="Province">
                    <Input id="province" value={form.province} onChange={(e) => update('province', e.target.value)} />
                  </Field>
                  <Field label="ZIP code">
                    <Input id="zipCode" value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Home ownership">
                  <Select id="homeOwnership" value={form.homeOwnership} onChange={(e) => update('homeOwnership', e.target.value)}>
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

            <SectionCard number="3" title="Employment Information" description="Skip if you're unemployed, self-employed, or retired.">
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
              </div>
            </SectionCard>

            <SectionCard number="4" title="Co-Borrower">
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
                    <Input id="coBorrowerName" value={form.coBorrowerName} onChange={(e) => update('coBorrowerName', e.target.value)} />
                  </Field>
                  <Field label="Relationship to applicant">
                    <Input id="coBorrowerRelationship" placeholder="e.g. Spouse" value={form.coBorrowerRelationship} onChange={(e) => update('coBorrowerRelationship', e.target.value)} />
                  </Field>
                  <Field label="Contact number">
                    <Input id="coBorrowerContactNumber" type="tel" value={form.coBorrowerContactNumber} onChange={(e) => update('coBorrowerContactNumber', e.target.value)} />
                  </Field>
                  <Field label="Email address">
                    <Input id="coBorrowerEmail" type="email" value={form.coBorrowerEmail} onChange={(e) => update('coBorrowerEmail', e.target.value)} />
                  </Field>
                  <Field label="Address" className="sm:col-span-2">
                    <Input id="coBorrowerAddress" value={form.coBorrowerAddress} onChange={(e) => update('coBorrowerAddress', e.target.value)} />
                  </Field>
                </div>
              )}
            </SectionCard>

            <SectionCard number="5" title="Character References">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="1st reference - full name">
                  <Input id="reference1Name" value={form.reference1Name} onChange={(e) => update('reference1Name', e.target.value)} />
                </Field>
                <Field label="1st reference - contact number">
                  <Input id="reference1Mobile" type="tel" value={form.reference1Mobile} onChange={(e) => update('reference1Mobile', e.target.value)} />
                </Field>
                <Field label="2nd reference - full name">
                  <Input id="reference2Name" value={form.reference2Name} onChange={(e) => update('reference2Name', e.target.value)} />
                </Field>
                <Field label="2nd reference - contact number">
                  <Input id="reference2Mobile" type="tel" value={form.reference2Mobile} onChange={(e) => update('reference2Mobile', e.target.value)} />
                </Field>
              </div>
            </SectionCard>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit Application'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
