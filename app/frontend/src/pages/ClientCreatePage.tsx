import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { Borrower, CreateBorrowerRequest, CreateCoBorrowerRequest } from '@/lib/loanApiTypes';

interface CharacterReferenceField {
  firstName: string;
  lastName: string;
  relationship: string;
  phoneNumber: string;
}

const EMPTY_REFERENCE: CharacterReferenceField = { firstName: '', lastName: '', relationship: '', phoneNumber: '' };

/**
 * Standalone client creation (Clients -> Add Client), scoped 2026-07-16 per the legacy Excel LMS
 * (`Client_details`/`CoBorrower_details`/`Reference_details` sheets) as the field-completeness
 * reference. Co-borrower here is deliberately a LIGHT sub-form (name/relationship/employer only,
 * no address/SSS-TIN/employment expansion) - ADR-015 resolved this as a per-Borrower (client-level)
 * attachment, not per-loan, so it's created via `POST /co-borrowers` with `borrowerId` set once the
 * client itself is saved.
 */
export function ClientCreatePage() {
  useLogPageView('Create Client Account');
  const navigate = useNavigate();
  const { currentAccount } = useRole();

  const [firstName, setFirstName] = React.useState('');
  const [middleName, setMiddleName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [suffix, setSuffix] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [civilStatus, setCivilStatus] = React.useState('');

  const [mobilePhone1, setMobilePhone1] = React.useState('');
  const [mobilePhone2, setMobilePhone2] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [facebookLink, setFacebookLink] = React.useState('');

  const [presentHouseUnit, setPresentHouseUnit] = React.useState('');
  const [presentStreet, setPresentStreet] = React.useState('');
  const [presentBarangay, setPresentBarangay] = React.useState('');
  const [presentCity, setPresentCity] = React.useState('');
  const [presentProvince, setPresentProvince] = React.useState('');
  const [presentOwnership, setPresentOwnership] = React.useState('');
  const [presentStayYears, setPresentStayYears] = React.useState('');
  const [presentStayMonths, setPresentStayMonths] = React.useState('');

  const [permanentSameAsPresent, setPermanentSameAsPresent] = React.useState(true);
  const [permanentHouseUnit, setPermanentHouseUnit] = React.useState('');
  const [permanentStreet, setPermanentStreet] = React.useState('');
  const [permanentBarangay, setPermanentBarangay] = React.useState('');
  const [permanentCity, setPermanentCity] = React.useState('');
  const [permanentProvince, setPermanentProvince] = React.useState('');

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
  const [coFirstName, setCoFirstName] = React.useState('');
  const [coLastName, setCoLastName] = React.useState('');
  const [coRelationship, setCoRelationship] = React.useState('');
  const [coEmployer, setCoEmployer] = React.useState('');

  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const updateReference = (index: number, patch: Partial<CharacterReferenceField>) => {
    setReferences((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const addresses: NonNullable<CreateBorrowerRequest['addresses']> = [
        {
          addressType: 'PRESENT',
          houseUnitNumber: presentHouseUnit || undefined,
          street: presentStreet || undefined,
          barangay: presentBarangay || undefined,
          cityMunicipality: presentCity || undefined,
          province: presentProvince || undefined,
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
          houseUnitNumber: permanentHouseUnit || undefined,
          street: permanentStreet || undefined,
          barangay: permanentBarangay || undefined,
          cityMunicipality: permanentCity || undefined,
          province: permanentProvince || undefined,
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

      if (includeCoBorrower && coFirstName.trim() && coLastName.trim()) {
        const coBody: CreateCoBorrowerRequest = {
          borrowerId: borrower.id,
          firstName: coFirstName,
          lastName: coLastName,
          relationship: coRelationship || undefined,
          employer: coEmployer || undefined,
        };
        await apiClient.post('/co-borrowers', coBody);
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

  const coBorrowerIncomplete = includeCoBorrower && (coFirstName.trim().length === 0 || coLastName.trim().length === 0);
  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && !coBorrowerIncomplete;

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
          <Field label="Birth Date">
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="Gender">
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Civil Status">
            <Select value={civilStatus} onValueChange={setCivilStatus}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Single">Single</SelectItem>
                <SelectItem value="Married">Married</SelectItem>
                <SelectItem value="Widowed">Widowed</SelectItem>
                <SelectItem value="Separated">Separated</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mobile Number 1">
            <Input value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} />
          </Field>
          <Field label="Mobile Number 2">
            <Input value={mobilePhone2} onChange={(e) => setMobilePhone2(e.target.value)} />
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
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="House/Unit #">
            <Input value={presentHouseUnit} onChange={(e) => setPresentHouseUnit(e.target.value)} />
          </Field>
          <Field label="Street">
            <Input value={presentStreet} onChange={(e) => setPresentStreet(e.target.value)} />
          </Field>
          <Field label="Barangay">
            <Input value={presentBarangay} onChange={(e) => setPresentBarangay(e.target.value)} />
          </Field>
          <Field label="City/Municipality">
            <Input value={presentCity} onChange={(e) => setPresentCity(e.target.value)} />
          </Field>
          <Field label="Province">
            <Input value={presentProvince} onChange={(e) => setPresentProvince(e.target.value)} />
          </Field>
          <Field label="Ownership Status">
            <Select value={presentOwnership} onValueChange={setPresentOwnership}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Owned">Owned</SelectItem>
                <SelectItem value="Renting">Renting</SelectItem>
                <SelectItem value="Living with Family">Living with Family</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Length of Stay (Years)">
            <Input type="number" min="0" value={presentStayYears} onChange={(e) => setPresentStayYears(e.target.value)} />
          </Field>
          <Field label="Length of Stay (Months)">
            <Input type="number" min="0" max="11" value={presentStayMonths} onChange={(e) => setPresentStayMonths(e.target.value)} />
          </Field>
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
          <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${permanentSameAsPresent ? 'opacity-50' : ''}`}>
            <Field label="House/Unit #">
              <Input disabled={permanentSameAsPresent} value={permanentHouseUnit} onChange={(e) => setPermanentHouseUnit(e.target.value)} />
            </Field>
            <Field label="Street">
              <Input disabled={permanentSameAsPresent} value={permanentStreet} onChange={(e) => setPermanentStreet(e.target.value)} />
            </Field>
            <Field label="Barangay">
              <Input disabled={permanentSameAsPresent} value={permanentBarangay} onChange={(e) => setPermanentBarangay(e.target.value)} />
            </Field>
            <Field label="City/Municipality">
              <Input disabled={permanentSameAsPresent} value={permanentCity} onChange={(e) => setPermanentCity(e.target.value)} />
            </Field>
            <Field label="Province">
              <Input disabled={permanentSameAsPresent} value={permanentProvince} onChange={(e) => setPermanentProvince(e.target.value)} />
            </Field>
          </div>
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
            <Input type="number" min="0" step="0.01" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Government IDs</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="SSS Number">
            <Input value={sssNumber} onChange={(e) => setSssNumber(e.target.value)} />
          </Field>
          <Field label="TIN">
            <Input value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} />
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="First Name" required>
                <Input value={coFirstName} onChange={(e) => setCoFirstName(e.target.value)} />
              </Field>
              <Field label="Last Name" required>
                <Input value={coLastName} onChange={(e) => setCoLastName(e.target.value)} />
              </Field>
              <Field label="Relationship">
                <Input value={coRelationship} onChange={(e) => setCoRelationship(e.target.value)} />
              </Field>
              <Field label="Employer">
                <Input value={coEmployer} onChange={(e) => setCoEmployer(e.target.value)} />
              </Field>
            </div>
          )}
          {coBorrowerIncomplete && (
            <p className="text-sm text-destructive">
              First Name and Last Name are required to include a co-borrower — uncheck the box above if you don't want to add one.
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
