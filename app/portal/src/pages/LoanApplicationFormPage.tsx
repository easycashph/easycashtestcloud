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

const DOCUMENT_SLOTS: { category: PortalDocumentCategory; label: string }[] = [
  { category: 'VALID_ID_BORROWER', label: 'Valid ID' },
  { category: 'PROOF_OF_BILLING', label: 'Proof of Billing' },
  { category: 'CORPORATE_PAYSLIP', label: 'Payslip' },
];

type FormState = Omit<SubmitLoanApplicationRequest, 'requestedAmount' | 'requestedTermMonths'> & {
  requestedAmount: string;
  requestedTermMonths: string;
};

const INITIAL_FORM: FormState = {
  branchId: '',
  applicantName: '',
  birthDate: '',
  gender: '',
  civilStatus: '',
  homeOwnership: '',
  address: '',
  houseUnitNumber: '',
  street: '',
  barangay: '',
  cityMunicipality: '',
  province: '',
  zipCode: '',
  monthlyIncome: undefined,
  employer: '',
  occupation: '',
  officeAddress: '',
  coBorrowerName: '',
  coBorrowerEmployer: '',
  coBorrowerContactNumber: '',
  coBorrowerEmail: '',
  coBorrowerAddress: '',
  mobilePhone: '',
  email: '',
  reference1Name: '',
  reference1Mobile: '',
  reference2Name: '',
  reference2Mobile: '',
  loanPurpose: '',
  requestedCategory: '',
  requestedAmount: '',
  requestedTermMonths: '',
};

/** Client-facing loan application form (Phase 2, 2026-07-23) - a core-fields-only subset of the
 * staff-facing form (see backend's PortalLoanApplicationDtos.ts). Two steps in one page: submit
 * the application, then (optionally) attach supporting documents to the freshly-created record. */
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const requestedAmount = Number(form.requestedAmount);
    const requestedTermMonths = Number(form.requestedTermMonths);
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
        ...form,
        birthDate: form.birthDate || undefined,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
        requestedAmount,
        requestedTermMonths,
      };
      // Every optional field here is a controlled input defaulting to '' - the backend's Zod
      // schema uses .min(1).optional(), which rejects an empty string as "present but invalid"
      // rather than treating it the same as absent, so blank fields must be stripped before send.
      for (const key of Object.keys(body) as (keyof SubmitLoanApplicationRequest)[]) {
        if (body[key] === '') delete body[key];
      }
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
            <h1 className="mt-6 text-lg font-bold tracking-tight">Attach supporting documents (optional)</h1>
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

          <form className="mt-6 space-y-8" onSubmit={handleSubmit}>
            {error && <Alert>{error}</Alert>}

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-primary">Personal Information</h2>
              <div className="space-y-1.5">
                <Label htmlFor="applicantName">Full name *</Label>
                <Input id="applicantName" required value={form.applicantName} onChange={(e) => update('applicantName', e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="birthDate">Birth date</Label>
                  <Input id="birthDate" type="date" value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gender">Gender</Label>
                  <Select id="gender" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="civilStatus">Civil status</Label>
                  <Select id="civilStatus" value={form.civilStatus} onChange={(e) => update('civilStatus', e.target.value)}>
                    <option value="">Select</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="homeOwnership">Home ownership</Label>
                  <Select id="homeOwnership" value={form.homeOwnership} onChange={(e) => update('homeOwnership', e.target.value)}>
                    <option value="">Select</option>
                    <option value="Owned">Owned</option>
                    <option value="Renting">Renting</option>
                    <option value="Living with family">Living with family</option>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Uses your account email if left blank" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mobilePhone">Mobile number</Label>
                  <Input id="mobilePhone" type="tel" value={form.mobilePhone} onChange={(e) => update('mobilePhone', e.target.value)} placeholder="09XX XXX XXXX" />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-primary">Address</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address">Street address</Label>
                  <Input id="address" value={form.address} onChange={(e) => update('address', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="barangay">Barangay</Label>
                  <Input id="barangay" value={form.barangay} onChange={(e) => update('barangay', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cityMunicipality">City / Municipality</Label>
                  <Input id="cityMunicipality" value={form.cityMunicipality} onChange={(e) => update('cityMunicipality', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="province">Province</Label>
                  <Input id="province" value={form.province} onChange={(e) => update('province', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zipCode">ZIP code</Label>
                  <Input id="zipCode" value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-primary">Employment &amp; Income</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="employer">Employer</Label>
                  <Input id="employer" value={form.employer} onChange={(e) => update('employer', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input id="occupation" value={form.occupation} onChange={(e) => update('occupation', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="monthlyIncome">Monthly income (PHP)</Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    min={0}
                    value={form.monthlyIncome ?? ''}
                    onChange={(e) => update('monthlyIncome', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="officeAddress">Office address</Label>
                  <Input id="officeAddress" value={form.officeAddress} onChange={(e) => update('officeAddress', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-primary">Co-Borrower (optional)</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="coBorrowerName">Full name</Label>
                  <Input id="coBorrowerName" value={form.coBorrowerName} onChange={(e) => update('coBorrowerName', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coBorrowerEmployer">Employer</Label>
                  <Input id="coBorrowerEmployer" value={form.coBorrowerEmployer} onChange={(e) => update('coBorrowerEmployer', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coBorrowerContactNumber">Contact number</Label>
                  <Input
                    id="coBorrowerContactNumber"
                    type="tel"
                    value={form.coBorrowerContactNumber}
                    onChange={(e) => update('coBorrowerContactNumber', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="coBorrowerEmail">Email</Label>
                  <Input id="coBorrowerEmail" type="email" value={form.coBorrowerEmail} onChange={(e) => update('coBorrowerEmail', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-primary">Character References</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reference1Name">Reference 1 - name</Label>
                  <Input id="reference1Name" value={form.reference1Name} onChange={(e) => update('reference1Name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reference1Mobile">Reference 1 - mobile</Label>
                  <Input id="reference1Mobile" type="tel" value={form.reference1Mobile} onChange={(e) => update('reference1Mobile', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reference2Name">Reference 2 - name</Label>
                  <Input id="reference2Name" value={form.reference2Name} onChange={(e) => update('reference2Name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reference2Mobile">Reference 2 - mobile</Label>
                  <Input id="reference2Mobile" type="tel" value={form.reference2Mobile} onChange={(e) => update('reference2Mobile', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-primary">Loan Details</h2>
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
                <div className="space-y-1.5">
                  <Label htmlFor="requestedCategory">Loan product *</Label>
                  <Select id="requestedCategory" required value={form.requestedCategory} onChange={(e) => update('requestedCategory', e.target.value)}>
                    <option value="">Select</option>
                    {LOAN_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="requestedAmount">Amount (PHP) *</Label>
                  <Input
                    id="requestedAmount"
                    type="number"
                    min={1}
                    required
                    value={form.requestedAmount}
                    onChange={(e) => update('requestedAmount', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="requestedTermMonths">Term (months) *</Label>
                  <Input
                    id="requestedTermMonths"
                    type="number"
                    min={1}
                    required
                    value={form.requestedTermMonths}
                    onChange={(e) => update('requestedTermMonths', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loanPurpose">Purpose of loan</Label>
                <Textarea id="loanPurpose" rows={3} value={form.loanPurpose} onChange={(e) => update('loanPurpose', e.target.value)} />
              </div>
            </section>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit Application'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
