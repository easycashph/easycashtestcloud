import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { PortalAddressPicker, emptyAddressDraft, type AddressDraft } from '@/components/PortalAddressPicker';
import { PortalProfilePhoto } from '@/components/PortalProfilePhoto';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { PhoneInput } from '@/components/PhoneInput';
import { NumberInput } from '@/components/NumberInput';
import { GroupedDigitsInput } from '@/components/GroupedDigitsInput';
import { computeAge } from '@/lib/computeAge';
import type { PortalProfile, UpdatePortalProfileRequest } from '@/lib/portalApiTypes';

interface DependantRow {
  name: string;
  age: string;
  relationship: string;
}

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
  const { t } = useLanguage();
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
  const [officeAddress, setOfficeAddress] = React.useState('');
  const [monthlyIncome, setMonthlyIncome] = React.useState('');
  const [tinNumber, setTinNumber] = React.useState('');
  const [sssNumber, setSssNumber] = React.useState('');
  const [dependants, setDependants] = React.useState<DependantRow[]>([]);
  const [reference1Name, setReference1Name] = React.useState('');
  const [reference1Mobile, setReference1Mobile] = React.useState('');
  const [reference2Name, setReference2Name] = React.useState('');
  const [reference2Mobile, setReference2Mobile] = React.useState('');
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
        // 2026-07-31 (user request): defaults to "Filipino" when genuinely empty, matching the
        // loan application form's own INITIAL_FORM default - never overwrites a real (possibly
        // different) value already on file.
        setNationality(data.nationality ?? 'Filipino');
        setCivilStatus(data.civilStatus ?? '');
        setHomeOwnership(data.homeOwnership ?? '');
        setMobilePhone1(data.mobilePhone1 ?? '');
        setMobilePhone2(data.mobilePhone2 ?? '');
        setEmail(data.email ?? '');
        setOccupation(data.occupation ?? '');
        setEmployer(data.employer ?? '');
        setOfficeAddress(data.officeAddress ?? '');
        setMonthlyIncome(data.monthlyIncome != null ? String(data.monthlyIncome) : '');
        setTinNumber(data.tinNumber ?? '');
        setSssNumber(data.sssNumber ?? '');
        setDependants(data.dependants.map((d) => ({ name: d.name, age: d.age ?? '', relationship: d.relationship ?? '' })));
        setReference1Name(data.reference1Name ?? '');
        setReference1Mobile(data.reference1Mobile ?? '');
        setReference2Name(data.reference2Name ?? '');
        setReference2Mobile(data.reference2Mobile ?? '');
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
      // 2026-09-14 (bug fix - user report: "the first name, middle name, last name doesn't save,
      // i need to reenter it for it to be saved") - the backend's optional address subfields are
      // `z.string().min(1).optional()`; they must be omitted entirely when blank, not sent as `''`
      // (which fails `.min(1)`). `PortalAddressPicker` always returns every key, so an untouched
      // optional subfield here is `''`, not `undefined`. Without this sanitization (already
      // applied in PortalProfileSetupGate.tsx, just missed here), a partially-filled address made
      // the WHOLE PATCH 400 - silently dropping every other field in the same request, including
      // name, even though those fields were themselves valid.
      const sanitizedAddress = Object.fromEntries(
        Object.entries(addressDraft).map(([key, value]) => [key, value.trim() ? value.trim() : undefined]),
      ) as AddressDraft;

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
        officeAddress: officeAddress.trim() || undefined,
        monthlyIncome: monthlyIncome.trim() ? Number(monthlyIncome) : undefined,
        tinNumber: tinNumber.trim() || undefined,
        sssNumber: sssNumber.trim() || undefined,
        dependants: dependants.some((d) => d.name.trim())
          ? dependants.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), age: d.age.trim() || undefined, relationship: d.relationship.trim() || undefined }))
          : undefined,
        reference1Name: reference1Name.trim() || undefined,
        reference1Mobile: reference1Mobile.trim() || undefined,
        reference2Name: reference2Name.trim() || undefined,
        reference2Mobile: reference2Mobile.trim() || undefined,
        addresses: Object.values(addressDraft).some((v) => v.trim()) ? [sanitizedAddress] : undefined,
      };
      await apiClient.patch<PortalProfile>('/portal/profile', body, true);
      setSaveState('saved');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t.profile.genericSaveError);
      setSaveState('error');
    }
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">{isLinked ? t.profile.introLinked : t.profile.introUnlinked}</p>

      {state === 'loading' && <ProfileFormSkeleton />}

        {state === 'error' && (
          <Alert tone="error" className="mt-8">
            {t.profile.loadError}
          </Alert>
        )}

        {state === 'ready' && (
          <form onSubmit={handleSave} className="mt-8 space-y-5">
            {!isLinked && (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">{t.profile.unlinkedNote}</p>
              </Card>
            )}

            {/* 2026-09-14 (user request: "make profile picture mandatory" / "profile photo should
                be displayed prominently") - same account-level upload the first-login onboarding
                gate uses (size="md" there), just larger here since this is its dedicated home. */}
            <Card className="p-6">
              <h2 className="text-sm font-semibold">{t.portalOnboarding.photoTitle}</h2>
              <div className="mt-4">
                <PortalProfilePhoto size="lg" initials={[firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase()} />
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold">{t.profile.personalInfo.title}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {isLinked ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t.profile.personalInfo.fullName}</Label>
                    <Input value={[firstName, middleName, lastName].filter(Boolean).join(' ')} disabled />
                    <p className="text-xs text-muted-foreground">{t.profile.personalInfo.nameLockedNote}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>{t.profile.personalInfo.firstName}</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.profile.personalInfo.middleName}</Label>
                      <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.profile.personalInfo.lastName}</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.profile.personalInfo.suffix}</Label>
                      <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Jr., Sr., III, …" />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label>{t.profile.personalInfo.gender}</Label>
                  <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">{t.profile.personalInfo.select}</option>
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.personalInfo.civilStatus}</Label>
                  <Select value={civilStatus} onChange={(e) => setCivilStatus(e.target.value)}>
                    <option value="">{t.profile.personalInfo.select}</option>
                    {CIVIL_STATUS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.personalInfo.birthDate}</Label>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                  {computeAge(birthDate) !== null && (
                    <p className="text-xs text-muted-foreground">
                      {t.profile.personalInfo.age}: {computeAge(birthDate)}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.personalInfo.placeOfBirth}</Label>
                  <Input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.personalInfo.nationality}</Label>
                  <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.personalInfo.homeOwnership}</Label>
                  <Select value={homeOwnership} onChange={(e) => setHomeOwnership(e.target.value)}>
                    <option value="">{t.profile.personalInfo.select}</option>
                    {HOME_OWNERSHIP_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.personalInfo.mobileNumber}</Label>
                  <PhoneInput value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} placeholder="09XX XXX XXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.personalInfo.altMobileNumber}</Label>
                  <PhoneInput value={mobilePhone2} onChange={(e) => setMobilePhone2(e.target.value)} placeholder="09XX XXX XXXX" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t.profile.personalInfo.email}</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold">{t.profile.address.title}</h2>
              <div className="mt-4">
                <PortalAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold">{t.profile.employment.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t.profile.employment.note}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t.profile.employment.employer}</Label>
                  <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.employment.occupation}</Label>
                  <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t.profile.employment.officeAddress}</Label>
                  <Input value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.employment.monthlyIncome}</Label>
                  <NumberInput min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.employment.tin}</Label>
                  <GroupedDigitsInput value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.employment.sss}</Label>
                  <GroupedDigitsInput value={sssNumber} onChange={(e) => setSssNumber(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold">{t.profile.dependants.title}</h2>
              <div className="mt-4 space-y-2">
                {dependants.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-40 flex-1 space-y-1.5">
                      <Label>{t.profile.dependants.name}</Label>
                      <Input value={row.name} onChange={(e) => setDependants(dependants.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                    </div>
                    <div className="w-20 space-y-1.5">
                      <Label>{t.profile.dependants.age}</Label>
                      <Input type="number" value={row.age} onChange={(e) => setDependants(dependants.map((r, j) => (j === i ? { ...r, age: e.target.value } : r)))} />
                    </div>
                    <div className="w-36 space-y-1.5">
                      <Label>{t.profile.dependants.relationship}</Label>
                      <Input
                        value={row.relationship}
                        onChange={(e) => setDependants(dependants.map((r, j) => (j === i ? { ...r, relationship: e.target.value } : r)))}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="sm" aria-label={t.profile.dependants.remove} onClick={() => setDependants(dependants.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setDependants([...dependants, { name: '', age: '', relationship: '' }])}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> {t.profile.dependants.add}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold">{t.profile.references.title}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t.profile.references.name1}</Label>
                  <Input value={reference1Name} onChange={(e) => setReference1Name(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.references.contact1}</Label>
                  <PhoneInput value={reference1Mobile} onChange={(e) => setReference1Mobile(e.target.value)} placeholder="09XX XXX XXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.references.name2}</Label>
                  <Input value={reference2Name} onChange={(e) => setReference2Name(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.profile.references.contact2}</Label>
                  <PhoneInput value={reference2Mobile} onChange={(e) => setReference2Mobile(e.target.value)} placeholder="09XX XXX XXXX" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              {saveState === 'error' && <Alert tone="error" className="mb-4">{saveError}</Alert>}
              {saveState === 'saved' && <Alert tone="success" className="mb-4">{t.profile.saved}</Alert>}

              <Button type="submit" disabled={saveState === 'saving'}>
                {saveState === 'saving' ? t.profile.saving : t.profile.save}
              </Button>
            </Card>
          </form>
        )}
    </>
  );
}

/** Full-page route wrapper (direct-link/bookmark entry point) - the everyday in-app flow now opens
 * `ProfileForm` inside a Dialog instead (see PortalDialogHost). */
/** 2026-09-14 (client portal UX pass, user request: "polished, modern fintech dashboard design
 * consistent with the EasyCash brand ... Do NOT use a pop-up/modal for My Profile") - the same
 * navy hero-banner language DashboardPage.tsx introduced, so this dedicated page reads as a real
 * sibling of Dashboard rather than a plain settings form bolted onto the app. */
export function ProfilePage() {
  const { t } = useLanguage();
  return (
    <main className="container max-w-3xl py-8 sm:py-10">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/85 p-6 text-white shadow-lg sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-green/30 blur-3xl" />
        <p className="relative text-xs font-semibold uppercase tracking-wider text-white/70">{t.portalHeader.myProfile}</p>
        <h1 className="relative mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{t.profile.pageTitle}</h1>
      </div>
      <div className="mt-8">
        <ProfileForm />
      </div>
    </main>
  );
}
