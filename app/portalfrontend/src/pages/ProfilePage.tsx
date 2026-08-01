import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { PortalHeader } from '@/components/PortalHeader';
import { PortalAddressPicker, emptyAddressDraft, type AddressDraft } from '@/components/PortalAddressPicker';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import { PhoneInput } from '@/components/PhoneInput';
import { NumberInput } from '@/components/NumberInput';
import { computeAge } from '@/lib/computeAge';
import type { PortalProfile, UpdatePortalProfileRequest } from '@/lib/portalApiTypes';

const GENDER_OPTIONS = ['Female', 'Male'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widower', 'Separated'];
const HOME_OWNERSHIP_OPTIONS = ['Owned', 'Renting', 'Living with family'];

function addressToDraft(address: PortalProfile['addresses'][number] | undefined): AddressDraft {
  if (!address) return emptyAddressDraft();
  return {
    houseUnitNumber: address.houseUnitNumber ?? '',
    street: address.street ?? '',
    barangay: address.barangay ?? '',
    cityMunicipality: address.cityMunicipality ?? '',
    province: address.province ?? '',
    zipCode: address.zipCode ?? '',
  };
}

/** Mirrors the shape of the real profile form below - two cards, each with a heading bar and a
 * grid of label/field pairs - so the loading state reads as "your profile is coming" rather than
 * an unexplained blank pause. Deliberately approximate rather than pixel-matching every real card:
 * the point is to signal "a form is loading here", not to be indistinguishable from the final
 * content. */
function ProfileFormSkeleton() {
  return (
    <div className="mt-8 space-y-5">
      {[0, 1].map((card) => (
        <Card key={card} className="p-6">
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((field) => (
              <div key={field} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * Phase D (2026-07-24 user request): a linked portal client can view their whole profile as the
 * LMS has it, and edit the confirmed self-service subset (mobile numbers, email, present address)
 * directly against the real Borrower record - see backend's GetPortalProfileUseCase/
 * UpdatePortalProfileUseCase.
 *
 * 2026-07-30 (user request): an account that ISN'T linked yet (no application submitted, or one
 * still pending) now gets the same form instead of an empty/locked state - backed by
 * PortalAccount's own pre-application profile columns. The only field-level difference is name
 * (firstName/middleName/lastName/suffix): editable pre-linkage since there's no staff-owned
 * Borrower record yet to defer to, locked afterward exactly as before.
 */
/** The reusable form content, with no page chrome of its own - used both by the full-page
 * `ProfilePage` route (direct-link/bookmark entry point) and by `PortalDialogHost` when opened as
 * a dialog (2026-07-31 user request) from the header nav or Dashboard. */
export function ProfileForm() {
  const { account } = useAuth();
  const isLinked = Boolean(account?.borrowerId);

  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [firstName, setFirstName] = React.useState('');
  const [middleName, setMiddleName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [suffix, setSuffix] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const [placeOfBirth, setPlaceOfBirth] = React.useState('');
  const [nationality, setNationality] = React.useState('');
  const [civilStatus, setCivilStatus] = React.useState('');
  const [homeOwnership, setHomeOwnership] = React.useState('');
  const [mobilePhone1, setMobilePhone1] = React.useState('');
  const [mobilePhone2, setMobilePhone2] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [occupation, setOccupation] = React.useState('');
  const [employer, setEmployer] = React.useState('');
  const [monthlyIncome, setMonthlyIncome] = React.useState('');
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = React.useState('');

  const loadProfile = React.useCallback(() => {
    setState('loading');
    apiClient
      .get<PortalProfile>('/portal/profile')
      .then((data) => {
        setFirstName(data.firstName ?? '');
        setMiddleName(data.middleName ?? '');
        setLastName(data.lastName ?? '');
        setSuffix(data.suffix ?? '');
        setGender(data.gender ?? '');
        setBirthDate(data.birthDate ?? '');
        setPlaceOfBirth(data.placeOfBirth ?? '');
        setNationality(data.nationality ?? '');
        setCivilStatus(data.civilStatus ?? '');
        setHomeOwnership(data.homeOwnership ?? '');
        setMobilePhone1(data.mobilePhone1 ?? '');
        setMobilePhone2(data.mobilePhone2 ?? '');
        setEmail(data.email ?? '');
        setOccupation(data.occupation ?? '');
        setEmployer(data.employer ?? '');
        setMonthlyIncome(data.monthlyIncome != null ? String(data.monthlyIncome) : '');
        setAddressDraft(addressToDraft(data.addresses[0]));
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveState('saving');
    setSaveError('');
    try {
      const body: UpdatePortalProfileRequest = {
        firstName: !isLinked ? firstName.trim() || undefined : undefined,
        middleName: !isLinked ? middleName.trim() || undefined : undefined,
        lastName: !isLinked ? lastName.trim() || undefined : undefined,
        suffix: !isLinked ? suffix.trim() || undefined : undefined,
        gender: gender || undefined,
        birthDate: birthDate.trim() || undefined,
        placeOfBirth: placeOfBirth.trim() || undefined,
        nationality: nationality.trim() || undefined,
        civilStatus: civilStatus || undefined,
        homeOwnership: homeOwnership || undefined,
        mobilePhone1: mobilePhone1.trim() || undefined,
        mobilePhone2: mobilePhone2.trim() || undefined,
        email: email.trim() || undefined,
        occupation: occupation.trim() || undefined,
        employer: employer.trim() || undefined,
        monthlyIncome: monthlyIncome.trim() ? Number(monthlyIncome) : undefined,
        addresses: Object.values(addressDraft).some((v) => v.trim()) ? [addressDraft] : undefined,
      };
      await apiClient.patch<PortalProfile>('/portal/profile', body, true);
      setSaveState('saved');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSaveState('error');
    }
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {isLinked
          ? 'This is the same client record Easycash staff sees - you can update your contact info here.'
          : "Personalize your profile now, or fill it in later when you apply for a loan."}
      </p>

      {state === 'loading' && <ProfileFormSkeleton />}

        {state === 'error' && (
          <Alert tone="error" className="mt-8">
            Couldn't load your profile. Please try again later.
          </Alert>
        )}

        {state === 'ready' && (
          <form onSubmit={handleSave} className="mt-8 space-y-5">
            {!isLinked && (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">
                  You're not yet an official Easycash client - that happens once a loan officer creates your loan account in
                  the LMS after reviewing an approved application. Everything below is saved to your account and will carry
                  over once that happens.
                </p>
              </Card>
            )}

            <Card className="p-6">
              <h2 className="text-sm font-semibold">Personal Information</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {isLinked ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Full name</Label>
                    <Input value={[firstName, middleName, lastName].filter(Boolean).join(' ')} disabled />
                    <p className="text-xs text-muted-foreground">Name is set by Easycash staff. Contact Easycash if this needs correcting.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>First name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Middle name</Label>
                      <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Suffix</Label>
                      <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Jr., Sr., III, …" />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select</option>
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Civil status</Label>
                  <Select value={civilStatus} onChange={(e) => setCivilStatus(e.target.value)}>
                    <option value="">Select</option>
                    {CIVIL_STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Birth date</Label>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                  {computeAge(birthDate) !== null && <p className="text-xs text-muted-foreground">Age: {computeAge(birthDate)}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Place of birth</Label>
                  <Input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nationality</Label>
                  <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Home ownership</Label>
                  <Select value={homeOwnership} onChange={(e) => setHomeOwnership(e.target.value)}>
                    <option value="">Select</option>
                    {HOME_OWNERSHIP_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Mobile number</Label>
                  <PhoneInput value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} placeholder="09XX XXX XXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Alternate mobile number</Label>
                  <PhoneInput value={mobilePhone2} onChange={(e) => setMobilePhone2(e.target.value)} placeholder="09XX XXX XXXX" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold">Address</h2>
              <div className="mt-4">
                <PortalAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold">Employment</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Monthly income</Label>
                  <NumberInput min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Employer</Label>
                  <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Occupation</Label>
                  <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
                </div>
              </div>

              {saveState === 'error' && <Alert tone="error" className="mt-4">{saveError}</Alert>}
              {saveState === 'saved' && <Alert tone="success" className="mt-4">Profile updated.</Alert>}

              <Button type="submit" className="mt-4" disabled={saveState === 'saving'}>
                {saveState === 'saving' ? 'Saving…' : 'Save Changes'}
              </Button>
            </Card>
          </form>
        )}
    </>
  );
}

/** Full-page route wrapper (direct-link/bookmark entry point) - the everyday in-app flow now opens
 * `ProfileForm` inside a Dialog instead (see PortalDialogHost). */
export function ProfilePage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />
      <main className="container max-w-3xl py-10">
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <div className="mt-8">
          <ProfileForm />
        </div>
      </main>
    </div>
  );
}
