import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, FilePlus2, Lock, Plus, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient } from '@/lib/apiClient';
import type { CreateLoanApplicationRequest, LoanApplication } from '@/lib/loanApplicationApiTypes';
import { INTAKE_DOCUMENT_OPTIONS } from '@/lib/mockData';
import { formatPeso } from '@/lib/utils';

/**
 * Officer-encoded loan application intake — mirrors the company's real paper
 * form "LOAN APPLICATION" (Form No. ECLC-LOFN01, Rev 02), section for section,
 * so a loan officer can encode a walk-in applicant while the public
 * application website does not exist yet. Wired to the real backend
 * (`POST /loan-applications`) — submitting creates a real PENDING_REVIEW record.
 *
 * Only the fields the LMS currently models are persisted onto the record (see
 * `CreateLoanApplicationRequest`); the remaining paper-form fields are shown for
 * workflow completeness and clearly note that they are not yet stored.
 */

const REFERRAL_OPTIONS = ['Walk-in', 'Website', 'Facebook', 'Internet', 'Flyers/Signages/Streamers', 'Agent/Referral', 'Others'];

/** Paper form §2 lists Seaman / Salary / OFW / Business-Corporate / Car / Real Estate — only the 3 active categories are offered today. */
const LOAN_TYPE_OPTIONS = [
  { paperLabel: 'Salary', category: 'Salary Loan' },
  { paperLabel: 'Seaman', category: 'Seafarer Loan' },
  { paperLabel: 'Business/Corporate', category: 'Business Loan' },
];

const HOME_OWNERSHIP_OPTIONS = ['Owned', 'Rented', 'Others'];
const GENDER_OPTIONS = ['Female', 'Male'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widower', 'Separated'];

interface DependantRow {
  name: string;
  age: string;
  relationship: string;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
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
  const { canAccessLoanApplications, currentAccount } = useRole();
  useLogPageView('Loan Applications', 'create-application-form');

  // §1 — referral
  const [referralSource, setReferralSource] = React.useState('Walk-in');
  const [referralDetail, setReferralDetail] = React.useState('');
  // §2 — loan information
  const [accountType, setAccountType] = React.useState<'NEW' | 'RENEWAL'>('NEW');
  const [loanCategory, setLoanCategory] = React.useState('');
  const [requestedAmount, setRequestedAmount] = React.useState('');
  const [requestedTermMonths, setRequestedTermMonths] = React.useState('');
  const [loanPurpose, setLoanPurpose] = React.useState('');
  // §3 — personal information
  const [firstName, setFirstName] = React.useState('');
  const [middleName, setMiddleName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [civilStatus, setCivilStatus] = React.useState('');
  const [nationality, setNationality] = React.useState('Filipino');
  const [dateOfBirth, setDateOfBirth] = React.useState('');
  const [placeOfBirth, setPlaceOfBirth] = React.useState('');
  const [presentAddress, setPresentAddress] = React.useState('');
  const [homeOwnership, setHomeOwnership] = React.useState('');
  const [mobileNo, setMobileNo] = React.useState('');
  const [email, setEmail] = React.useState('');
  // §4 — employment
  const [employer, setEmployer] = React.useState('');
  const [occupation, setOccupation] = React.useState('');
  const [officeAddress, setOfficeAddress] = React.useState('');
  const [tin, setTin] = React.useState('');
  const [sss, setSss] = React.useState('');
  // §5 — dependants
  const [dependants, setDependants] = React.useState<DependantRow[]>([]);
  // §6 — spouse
  const [spouseName, setSpouseName] = React.useState('');
  const [spouseEmployer, setSpouseEmployer] = React.useState('');
  // §7/§8 — co-borrower
  const [hasCoBorrower, setHasCoBorrower] = React.useState(false);
  const [coBorrowerName, setCoBorrowerName] = React.useState('');
  const [coBorrowerRelationship, setCoBorrowerRelationship] = React.useState('');
  const [coBorrowerEmployer, setCoBorrowerEmployer] = React.useState('');
  // §9 — character references
  const [reference1, setReference1] = React.useState({ name: '', mobile: '' });
  const [reference2, setReference2] = React.useState({ name: '', mobile: '' });
  // LMS verification inputs (not on the paper form)
  const [monthlyIncome, setMonthlyIncome] = React.useState('');
  const [creditScore, setCreditScore] = React.useState('');
  const [propertiesOwned, setPropertiesOwned] = React.useState('');
  // Documents submitted
  const [documents, setDocuments] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const age = computeAge(dateOfBirth);
  const applicantName = [firstName, middleName, lastName].map((p) => p.trim()).filter(Boolean).join(' ');
  const amount = Number(requestedAmount);
  const term = Number(requestedTermMonths);
  const income = Number(monthlyIncome);

  const missing: string[] = [];
  if (!firstName.trim() || !lastName.trim()) missing.push('Applicant first and last name (§3)');
  if (!dateOfBirth || age === null) missing.push('Date of birth (§3)');
  if (!presentAddress.trim()) missing.push('Present address (§3)');
  if (!loanCategory) missing.push('Type of loan (§2)');
  if (!(amount > 0)) missing.push('Desired loan amount (§2)');
  if (!(term > 0)) missing.push('Loan term in months (§2)');
  if (!employer.trim()) missing.push('Name of employer (§4)');
  if (!(income > 0)) missing.push('Monthly income (LMS verification)');
  const canSubmit = missing.length === 0;

  const toggleDocument = (name: string) => {
    setDocuments((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post<LoanApplication>('/loan-applications', {
        branchId: currentAccount.branchId,
        applicantName,
        age: age ?? undefined,
        address: presentAddress.trim() || undefined,
        monthlyIncome: income > 0 ? income : undefined,
        employer: employer.trim() || undefined,
        propertiesOwned: propertiesOwned
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
        creditScore: Number(creditScore) || undefined,
        coBorrowerName:
          hasCoBorrower && coBorrowerName.trim()
            ? `${coBorrowerName.trim()}${coBorrowerRelationship.trim() ? ` (${coBorrowerRelationship.trim().toLowerCase()})` : ''}`
            : undefined,
        requestedCategory: loanCategory,
        requestedAmount: amount,
        requestedTermMonths: term,
        referralSource: referralDetail.trim() ? `${referralSource} — ${referralDetail.trim()}` : referralSource,
        accountType,
        loanPurpose: loanPurpose.trim() || undefined,
        submittedDocuments: [...documents],
      } satisfies CreateLoanApplicationRequest),
    onSuccess: (application) => {
      navigate(`/applications/${application.id}`, { replace: true });
    },
  });

  const submit = () => createMutation.mutate();

  // Access gate placed after every hook above (React Hooks rules: never return early before a
  // hook call) — was previously above the createMutation useMutation() call, a real
  // rules-of-hooks violation, not just a lint nag.
  if (!canAccessLoanApplications) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Create Loan Application</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Restricted to MIS, Loan Operation Manager, and CRM accounts</p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <FilePlus2 className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">Create Loan Application</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          For walk-in applicants — the loan officer fills this out on the applicant&apos;s behalf, following the official paper form
          (Form No. <span className="font-mono">ECLC-LOFN01</span>, Rev 02). Sample data only — do not enter real client information
          in this preview build.
        </p>
      </div>

      <SectionCard number="1" title="How did you find out about Easycash?">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source">
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
            <Field label={referralSource === 'Agent/Referral' ? 'Agent / referrer name' : 'Please specify'}>
              <Input value={referralDetail} onChange={(e) => setReferralDetail(e.target.value)} />
            </Field>
          )}
        </div>
      </SectionCard>

      <SectionCard number="2" title="Loan Information">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type of account">
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
            hint="The paper form also lists OFW, Car, and Real Estate — not currently offered products."
          >
            <Select value={loanCategory} onValueChange={setLoanCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select loan type" />
              </SelectTrigger>
              <SelectContent>
                {LOAN_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.category} value={o.category}>
                    {o.paperLabel} ({o.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Desired loan amount (₱) *">
            <Input type="number" min="0" value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} />
          </Field>
          <Field label="Preferred loan term (months) *">
            <Input type="number" min="1" max="36" value={requestedTermMonths} onChange={(e) => setRequestedTermMonths(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="What is the loan purpose?">
            <Textarea rows={2} value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard number="3" title="Personal Information">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="First name *">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Middle name">
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </Field>
          <Field label="Last name *">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Nickname">
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </Field>
          <Field label="Gender">
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Civil status">
            <Select value={civilStatus} onValueChange={setCivilStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {CIVIL_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date of birth *" hint={age !== null ? `Age: ${age}` : undefined}>
            <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </Field>
          <Field label="Place of birth">
            <Input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
          </Field>
          <Field label="Nationality">
            <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Present address *">
              <Input
                placeholder="House/Unit No., Street, Barangay, City/Municipality"
                value={presentAddress}
                onChange={(e) => setPresentAddress(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Home ownership">
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
          <Field label="Mobile no.">
            <Input value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email address">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        number="4"
        title="Employment Information"
        description="Skip if the applicant is unemployed, self-employed, or retired (per the paper form)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name of employer *">
            <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
          </Field>
          <Field label="Occupation">
            <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Office address">
              <Input value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} />
            </Field>
          </div>
          <Field label="TIN">
            <Input value={tin} onChange={(e) => setTin(e.target.value)} />
          </Field>
          <Field label="SSS no.">
            <Input value={sss} onChange={(e) => setSss(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard number="5" title="Dependants">
        <div className="space-y-2">
          {dependants.map((row, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <Field label="Name">
                  <Input
                    value={row.name}
                    onChange={(e) => setDependants((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  />
                </Field>
              </div>
              <div className="w-20">
                <Field label="Age">
                  <Input
                    type="number"
                    value={row.age}
                    onChange={(e) => setDependants((prev) => prev.map((r, j) => (j === i ? { ...r, age: e.target.value } : r)))}
                  />
                </Field>
              </div>
              <div className="w-36">
                <Field label="Relationship">
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

      {civilStatus === 'Married' && (
        <SectionCard
          number="6"
          title="Spouse Personal & Employment Information"
          description="Shown because civil status is Married (the paper form skips this for single/widower/separated)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Spouse full name">
              <Input value={spouseName} onChange={(e) => setSpouseName(e.target.value)} />
            </Field>
            <Field label="Spouse employer / occupation">
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
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Co-borrower full name">
              <Input value={coBorrowerName} onChange={(e) => setCoBorrowerName(e.target.value)} />
            </Field>
            <Field label="Relationship to applicant">
              <Input placeholder="e.g. Spouse" value={coBorrowerRelationship} onChange={(e) => setCoBorrowerRelationship(e.target.value)} />
            </Field>
            <Field label="Co-borrower employer">
              <Input value={coBorrowerEmployer} onChange={(e) => setCoBorrowerEmployer(e.target.value)} />
            </Field>
          </div>
        )}
      </SectionCard>

      <SectionCard number="9" title="Character References">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="1st reference — full name">
            <Input value={reference1.name} onChange={(e) => setReference1((r) => ({ ...r, name: e.target.value }))} />
          </Field>
          <Field label="1st reference — mobile no.">
            <Input value={reference1.mobile} onChange={(e) => setReference1((r) => ({ ...r, mobile: e.target.value }))} />
          </Field>
          <Field label="2nd reference — full name">
            <Input value={reference2.name} onChange={(e) => setReference2((r) => ({ ...r, name: e.target.value }))} />
          </Field>
          <Field label="2nd reference — mobile no.">
            <Input value={reference2.mobile} onChange={(e) => setReference2((r) => ({ ...r, mobile: e.target.value }))} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        number="LMS"
        title="Verification Inputs"
        description="Not part of the paper form — encoded by the officer from supporting documents (payslip, CB Credit Bureau Report) to feed the LMS qualification factors."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Monthly income (₱) *">
            <Input type="number" min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
          </Field>
          <Field label="Credit score (from CB report)">
            <Input type="number" min="0" max="1000" value={creditScore} onChange={(e) => setCreditScore(e.target.value)} />
          </Field>
          <Field label="Properties owned" hint="Comma-separated, e.g. Residential lot — Antipolo City">
            <Input value={propertiesOwned} onChange={(e) => setPropertiesOwned(e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        number="Docs"
        title="Documents Submitted"
        description="Tick the documents the applicant submitted with the paper form. Preview build: file names/metadata only — no real upload happens."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {INTAKE_DOCUMENT_OPTIONS.map((doc) => (
            <label key={doc} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={documents.has(doc)}
                onChange={() => toggleDocument(doc)}
              />
              {doc}
            </label>
          ))}
        </div>
      </SectionCard>

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
            Preview build: only the fields the LMS models today (name, age, address, employment, income, credit score, properties,
            co-borrower, requested loan, documents) are saved onto the sample application record. Dependants, spouse details, TIN/SSS,
            and character references are captured on the paper form itself and are not yet stored by this preview. The applicant signs
            the Undertaking on the printed form — no signature is captured here.
          </p>
          {createMutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {createMutation.error instanceof Error ? createMutation.error.message : 'Could not create the application.'}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => setConfirmOpen(true)}>
              <FilePlus2 className="mr-2 h-4 w-4" /> Create Loan Application
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create this loan application?</DialogTitle>
            <DialogDescription>
              {applicantName || 'Applicant'} — {loanCategory || 'no category'} · {amount > 0 ? formatPeso(amount) : '₱0.00'} ·{' '}
              {term > 0 ? `${term} months` : 'no term'}. It will enter the queue as{' '}
              <Badge variant="warning" className="align-middle">
                PENDING REVIEW
              </Badge>{' '}
              encoded by {currentAccount.name}.
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
              Confirm — Create Loan Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
