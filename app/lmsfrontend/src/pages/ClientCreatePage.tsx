import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneInput } from '@/components/PhoneInput';
import { NumberInput } from '@/components/NumberInput';
import { GroupedDigitsInput } from '@/components/GroupedDigitsInput';
import { type AddressDraft, emptyAddressDraft, PsgcAddressPicker } from '@/components/PsgcAddressPicker';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { apiClient, ApiError } from '@/lib/apiClient';
import { computeAge } from '@/lib/computeAge';
import type { Borrower, CreateBorrowerRequest, CreateCoBorrowerRequest, PaginatedResponse } from '@/lib/loanApiTypes';

interface CharacterReferenceField {
  firstName: string;
  lastName: string;
  relationship: string;
  phoneNumber: string;
}

const EMPTY_REFERENCE: CharacterReferenceField = { firstName: '', lastName: '', relationship: '', phoneNumber: '' };

interface CoBorrowerField {
  firstName: string;
  middleName: string;
  lastName: string;
  relationship: string;
  employer: string;
  address: AddressDraft;
}

function emptyCoBorrower(): CoBorrowerField {
  return { firstName: '', middleName: '', lastName: '', relationship: '', employer: '', address: emptyAddressDraft() };
}

/**
 * Standalone client creation (Clients -> Add Client), scoped 2026-07-16 per the legacy Excel LMS
 * (`Client_details`/`CoBorrower_details`/`Reference_details` sheets) as the field-completeness
 * reference. Co-borrower here is a lighter sub-form than the client's own fields (name/relationship
 * /employer/address only, no SSS-TIN/employment expansion) - ADR-015 resolved this as a per-Borrower
 * (client-level) attachment, not per-loan, so it's created via `POST /co-borrowers` with
 * `borrowerId` set once the client itself is saved.
 */
export function ClientCreatePage() {
  useLogPageView('Create Client Account');
  const navigate = useNavigate();
  const { currentAccount, canManageClients } = useRole();

  const [firstName, setFirstName] = React.useState('');
  const [middleName, setMiddleName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [suffix, setSuffix] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const computedAge = computeAge(birthDate);
  const [gender, setGender] = React.useState('');
  const [civilStatus, setCivilStatus] = React.useState('');

  // Duplicate-client warning (ADR-012 was previously deferred; this session resolved the basis as
  // Full Name + Birth Date match, warning-only - staff can still save, since two real people can
  // legitimately share a name). Only fires once all three fields are filled, to avoid false
  // positives on a shared surname alone.
  const debouncedFirstName = useDebouncedValue(firstName);
  const debouncedLastName = useDebouncedValue(lastName);
  const duplicateCheckEnabled = debouncedFirstName.trim().length > 0 && debouncedLastName.trim().length > 0 && birthDate.trim().length > 0;
  const duplicateCheckQuery = useQuery({
    queryKey: ['borrowers', 'duplicate-check', debouncedFirstName, debouncedLastName, birthDate],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Borrower>>(
        `/borrowers?search=${encodeURIComponent(`${debouncedFirstName} ${debouncedLastName}`)}&limit=10`,
      ),
    enabled: duplicateCheckEnabled,
  });
  const possibleDuplicates = (duplicateCheckQuery.data?.items ?? []).filter(
    (b) =>
      b.firstName.trim().toLowerCase() === debouncedFirstName.trim().toLowerCase() &&
      b.lastName.trim().toLowerCase() === debouncedLastName.trim().toLowerCase() &&
      b.birthDate?.slice(0, 10) === birthDate,
  );

  const [mobilePhone1, setMobilePhone1] = React.useState('');
  const [mobilePhone2, setMobilePhone2] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [facebookLink, setFacebookLink] = React.useState('');

  const [presentAddress, setPresentAddress] = React.useState<AddressDraft>(emptyAddressDraft());
  const [presentOwnership, setPresentOwnership] = React.useState('');
  const [presentStayYears, setPresentStayYears] = React.useState('');
  const [presentStayMonths, setPresentStayMonths] = React.useState('');

  const [permanentSameAsPresent, setPermanentSameAsPresent] = React.useState(true);
  const [permanentAddress, setPermanentAddress] = React.useState<AddressDraft>(emptyAddressDraft());

  const [employmentType, setEmploymentType] = React.useState('');
  const [employerName, setEmployerName] = React.useState('');
  const [employerAddress, setEmployerAddress] = React.useState('');
  const [position, setPosition] = React.useState('');
  const [yearsEmployed, setYearsEmployed] = React.useState('');
  const [monthsEmployed, setMonthsEmployed] = React.useState('');
  const [monthlyIncome, setMonthlyIncome] = React.useState('');

  const [sssNumber, setSssNumber] = React.useState('');
  const [tinNumber, setTinNumber] = React.useState('');

  const [references, setReferences] = React.useState<CharacterReferenceField[]>([{ ...EMPTY_REFERENCE }, { ...EMPTY_REFERENCE }]);

  const [includeCoBorrower, setIncludeCoBorrower] = React.useState(false);
  const [coBorrowers, setCoBorrowers] = React.useState<CoBorrowerField[]>([emptyCoBorrower()]);

  const updateCoBorrower = (index: number, patch: Partial<CoBorrowerField>) => {
    setCoBorrowers((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };
  const addCoBorrower = () => setCoBorrowers((prev) => [...prev, emptyCoBorrower()]);
  const removeCoBorrower = (index: number) => setCoBorrowers((prev) => prev.filter((_, i) => i !== index));

  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const updateReference = (index: number, patch: Partial<CharacterReferenceField>) => {
    setReferences((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const addresses: NonNullable<CreateBorrowerRequest['addresses']> = [
        {
          addressType: 'PRESENT',
          houseUnitNumber: presentAddress.houseUnitNumber || undefined,
          street: presentAddress.street || undefined,
          barangay: presentAddress.barangay || undefined,
          cityMunicipality: presentAddress.cityMunicipality || undefined,
          province: presentAddress.province || undefined,
          zipCode: presentAddress.zipCode || undefined,
          ownershipStatus: presentOwnership || undefined,
          lengthOfStayMonths:
            presentStayYears || presentStayMonths
              ? (Number.parseInt(presentStayYears, 10) || 0) * 12 + (Number.parseInt(presentStayMonths, 10) || 0)
              : undefined,
        },
      ];
      if (permanentSameAsPresent) {
        addresses.push({ ...addresses[0], addressType: 'PERMANENT' });
      } else {
        addresses.push({
          addressType: 'PERMANENT',
          houseUnitNumber: permanentAddress.houseUnitNumber || undefined,
          street: permanentAddress.street || undefined,
          barangay: permanentAddress.barangay || undefined,
          cityMunicipality: permanentAddress.cityMunicipality || undefined,
          province: permanentAddress.province || undefined,
          zipCode: permanentAddress.zipCode || undefined,
        });
      }

      const characterReferences = references
        .filter((r) => r.firstName.trim().length > 0)
        .map((r) => ({
          firstName: r.firstName,
          lastName: r.lastName || undefined,
          relationship: r.relationship || undefined,
          phoneNumber: r.phoneNumber || undefined,
        }));

      const body: CreateBorrowerRequest = {
        branchId: currentAccount.branchId,
        firstName,
        lastName,
        middleName: middleName || undefined,
        suffix: suffix || undefined,
        birthDate: birthDate || undefined,
        gender: gender || undefined,
        civilStatus: civilStatus || undefined,
        mobilePhone1: mobilePhone1 || undefined,
        mobilePhone2: mobilePhone2 || undefined,
        email: email || undefined,
        facebookLink: facebookLink || undefined,
        addresses,
        incomeDetail: {
          employmentType: employmentType || undefined,
          employerName: employerName || undefined,
          employerAddress: employerAddress || undefined,
          position: position || undefined,
          yearsEmployed: yearsEmployed ? Number.parseInt(yearsEmployed, 10) : undefined,
          monthsEmployed: monthsEmployed ? Number.parseInt(monthsEmployed, 10) : undefined,
          monthlyIncome: monthlyIncome ? Number.parseFloat(monthlyIncome) : undefined,
        },
        governmentId: {
          sssNumber: sssNumber || undefined,
          tinNumber: tinNumber || undefined,
        },
        characterReferences: characterReferences.length > 0 ? characterReferences : undefined,
      };

      const borrower = await apiClient.post<Borrower>('/borrowers', body);

      if (includeCoBorrower) {
        for (const co of coBorrowers) {
          if (!co.firstName.trim() || !co.lastName.trim()) continue;
          const coBody: CreateCoBorrowerRequest = {
            borrowerId: borrower.id,
            firstName: co.firstName,
            middleName: co.middleName || undefined,
            lastName: co.lastName,
            relationship: co.relationship || undefined,
            addresses: Object.values(co.address).some((v) => v.trim()) ? [co.address] : undefined,
            employer: co.employer || undefined,
          };
          await apiClient.post('/co-borrowers', coBody);
        }
      }

      return borrower;
    },
    onSuccess: (borrower) => {
      navigate(`/clients/${borrower.id}`);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Could not reach the server. Check your connection and try again.');
      }
    },
  });

  const coBorrowerIncomplete =
    includeCoBorrower && coBorrowers.some((c) => c.firstName.trim().length === 0 || c.lastName.trim().length === 0);
  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && !coBorrowerIncomplete;

  // 2026-08-06 (user-reported): the "Add Client" button on List of Clients is already hidden for
  // a role without `borrower.write` - this guard covers direct navigation to `/clients/new` by
  // URL, same "restricted" placeholder shape as every other permission-gated page in this app.
  if (!canManageClients) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Restricted</p>
          <p className="text-sm text-muted-foreground">
            Your role ({currentAccount.role}) does not have permission to create clients.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight">Create Client Account</h2>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {submitError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="First Name" required>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Middle Name">
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </Field>
          <Field label="Last Name" required>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Suffix">
            <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Jr., Sr., III" />
          </Field>
          <Field label="Birth Date" hint={computedAge !== null ? `Age: ${computedAge}` : undefined}>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="Gender">
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Civil Status">
            <Select value={civilStatus} onValueChange={setCivilStatus}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SINGLE">Single</SelectItem>
                <SelectItem value="MARRIED">Married</SelectItem>
                <SelectItem value="WIDOWED">Widowed</SelectItem>
                <SelectItem value="DIVORCED/SEPARATED">Divorced/Separated</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
        {possibleDuplicates.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Possible existing client{possibleDuplicates.length > 1 ? 's' : ''} found</p>
                <p className="text-muted-foreground">
                  Same first name, last name, and birth date as{' '}
                  {possibleDuplicates.map((b, i) => (
                    <React.Fragment key={b.id}>
                      {i > 0 && ', '}
                      <a href={`/clients/${b.id}`} target="_blank" rel="noreferrer" className="underline">
                        {b.fullName}
                      </a>
                    </React.Fragment>
                  ))}
                  . Double-check this isn't the same person before saving — you can still proceed if they're genuinely different.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mobile Number 1">
            <PhoneInput value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} placeholder="917 XXX XXXX" />
          </Field>
          <Field label="Mobile Number 2">
            <PhoneInput value={mobilePhone2} onChange={(e) => setMobilePhone2(e.target.value)} placeholder="917 XXX XXXX" />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Facebook">
            <Input value={facebookLink} onChange={(e) => setFacebookLink(e.target.value)} placeholder="facebook.com/username" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Present Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PsgcAddressPicker value={presentAddress} onChange={(patch) => setPresentAddress((prev) => ({ ...prev, ...patch }))} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Ownership Status">
              <Select value={presentOwnership} onValueChange={setPresentOwnership}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Owned">Owned</SelectItem>
                  <SelectItem value="Rented">Rented</SelectItem>
                  <SelectItem value="Owned by Parents">Owned by Parents</SelectItem>
                  <SelectItem value="Owned by Relatives">Owned by Relatives</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Length of Stay (Years)">
              <Input type="number" min="0" value={presentStayYears} onChange={(e) => setPresentStayYears(e.target.value)} />
            </Field>
            <Field label="Length of Stay (Months)">
              <Input type="number" min="0" max="11" value={presentStayMonths} onChange={(e) => setPresentStayMonths(e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permanent Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={permanentSameAsPresent}
              onChange={(e) => setPermanentSameAsPresent(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Same as present address
          </label>
          {!permanentSameAsPresent && (
            <PsgcAddressPicker value={permanentAddress} onChange={(patch) => setPermanentAddress((prev) => ({ ...prev, ...patch }))} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Employment Type">
            <Select value={employmentType} onValueChange={setEmploymentType}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Regular">Regular</SelectItem>
                <SelectItem value="Contractual">Contractual</SelectItem>
                <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                <SelectItem value="Business Owner">Business Owner</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Employer Name">
            <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
          </Field>
          <Field label="Employer Address">
            <Input value={employerAddress} onChange={(e) => setEmployerAddress(e.target.value)} />
          </Field>
          <Field label="Position">
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </Field>
          <Field label="Years Employed">
            <Input type="number" min="0" value={yearsEmployed} onChange={(e) => setYearsEmployed(e.target.value)} />
          </Field>
          <Field label="Months Employed">
            <Input type="number" min="0" max="11" value={monthsEmployed} onChange={(e) => setMonthsEmployed(e.target.value)} />
          </Field>
          <Field label="Monthly Income">
            <NumberInput min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0.00" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Government IDs</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="SSS Number">
            <GroupedDigitsInput value={sssNumber} onChange={(e) => setSssNumber(e.target.value)} />
          </Field>
          <Field label="TIN">
            <GroupedDigitsInput value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Character References</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {references.map((ref, i) => (
            <div key={i} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={`Reference ${i + 1} - First Name`}>
                <Input value={ref.firstName} onChange={(e) => updateReference(i, { firstName: e.target.value })} />
              </Field>
              <Field label="Last Name">
                <Input value={ref.lastName} onChange={(e) => updateReference(i, { lastName: e.target.value })} />
              </Field>
              <Field label="Relationship">
                <Input value={ref.relationship} onChange={(e) => updateReference(i, { relationship: e.target.value })} />
              </Field>
              <Field label="Phone Number">
                <Input value={ref.phoneNumber} onChange={(e) => updateReference(i, { phoneNumber: e.target.value })} />
              </Field>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Co-Borrower</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeCoBorrower}
              onChange={(e) => setIncludeCoBorrower(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Include a co-borrower
          </label>
          {includeCoBorrower && (
            <div className="space-y-4">
              {coBorrowers.map((co, i) => (
                <div key={i} className="space-y-4 rounded-md border border-border p-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="First Name" required>
                      <Input value={co.firstName} onChange={(e) => updateCoBorrower(i, { firstName: e.target.value })} />
                    </Field>
                    <Field label="Middle Name">
                      <Input value={co.middleName} onChange={(e) => updateCoBorrower(i, { middleName: e.target.value })} />
                    </Field>
                    <Field label="Last Name" required>
                      <Input value={co.lastName} onChange={(e) => updateCoBorrower(i, { lastName: e.target.value })} />
                    </Field>
                    <Field label="Relationship">
                      <Input value={co.relationship} onChange={(e) => updateCoBorrower(i, { relationship: e.target.value })} />
                    </Field>
                    <Field label="Employer">
                      <Input value={co.employer} onChange={(e) => updateCoBorrower(i, { employer: e.target.value })} />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCoBorrower(i)}
                        disabled={coBorrowers.length === 1}
                        title={coBorrowers.length === 1 ? 'At least one co-borrower slot is required while this is checked' : 'Remove this co-borrower'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="border-t pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
                    <PsgcAddressPicker
                      value={co.address}
                      onChange={(patch) => updateCoBorrower(i, { address: { ...co.address, ...patch } })}
                    />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addCoBorrower}>
                <Plus className="mr-1 h-4 w-4" /> Add another co-borrower
              </Button>
            </div>
          )}
          {coBorrowerIncomplete && (
            <p className="text-sm text-destructive">
              Every co-borrower needs a First Name and Last Name — fill them in, remove the incomplete row, or uncheck the box above.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pb-6">
        <Button variant="outline" onClick={() => navigate('/clients')} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
          {createMutation.isPending ? 'Creating…' : 'Create Client Account'}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  /** 2026-07-31 (user request) - e.g. a live computed-age readout next to a birth date field. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
