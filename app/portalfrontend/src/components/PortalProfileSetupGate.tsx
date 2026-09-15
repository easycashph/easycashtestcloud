import * as React from 'react';
import { CheckCircle2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { PortalAddressPicker, emptyAddressDraft, type AddressDraft } from '@/components/PortalAddressPicker';
import { PortalProfilePhoto } from '@/components/PortalProfilePhoto';
import { PhoneInput } from '@/components/PhoneInput';
import { apiClient } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { PortalProfile, UpdatePortalProfileRequest } from '@/lib/portalApiTypes';

const GENDER_OPTIONS = ['Female', 'Male'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widower', 'Separated'];
const HOME_OWNERSHIP_OPTIONS = ['Owned', 'Renting', 'Living with family'];

/** The subset of `/portal/profile` fields treated as "must fill before continuing" for the
 * first-login gate below - deliberately NOT a new backend "profileComplete" flag (see this file's
 * own doc comment). A real address needs all three of these present, not just one. Profile photo
 * (2026-09-14 user request: "make profile picture mandatory") is required too - backed by the
 * real `hasProfilePhoto` flag the profile endpoint now returns, not a client-side guess. */
function isProfileComplete(profile: PortalProfile): boolean {
  const hasAddress = Boolean(profile.addresses[0]?.barangay && profile.addresses[0]?.cityMunicipality && profile.addresses[0]?.province);
  return Boolean(profile.gender && profile.civilStatus && profile.birthDate && profile.mobilePhone1 && hasAddress && profile.hasProfilePhoto);
}

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

function GateSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 py-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/**
 * First-login profile completion gate (2026-09-14 redesign, user request: "require them to
 * complete their profile before continuing"). Wraps the authenticated app shell's `<Outlet/>` -
 * when the signed-in account's real `/portal/profile` record is missing the fields below, this
 * renders a full onboarding form in place of the normal page content; once saved, the gate opens.
 *
 * Deliberately does NOT introduce a new `profileComplete` boolean column/flag on the backend -
 * completeness is derived from fields the profile endpoint already returns (CLAUDE.md: "never
 * invent business rules" / never fabricate a field the backend has no real concept of). This also
 * means "remember the setup status" needs no separate persistence: once the required fields are
 * genuinely saved, the very next completeness check already reads as complete, on this device or
 * any other the client logs into.
 *
 * The profile photo is required (2026-09-14 user request: "make profile picture mandatory") via
 * `PortalProfilePhoto`, which uploads to `/portal/profile/photo` - an Attachment owned directly by
 * the PortalAccount, independent of any loan application. This exists specifically because the
 * older `PortalAvatar` path only accepts an upload against a real loan application id, which a
 * first-login client (right after signup, before ever applying) doesn't have yet.
 */
export function PortalProfileSetupGate({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [status, setStatus] = React.useState<'loading' | 'complete' | 'incomplete' | 'error'>('loading');
  const [profile, setProfile] = React.useState<PortalProfile | null>(null);
  const [hasPhoto, setHasPhoto] = React.useState(false);

  const [gender, setGender] = React.useState('');
  const [civilStatus, setCivilStatus] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const [mobilePhone1, setMobilePhone1] = React.useState('');
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());
  const [placeOfBirth, setPlaceOfBirth] = React.useState('');
  const [nationality, setNationality] = React.useState('');
  const [homeOwnership, setHomeOwnership] = React.useState('');
  const [mobilePhone2, setMobilePhone2] = React.useState('');
  const [occupation, setOccupation] = React.useState('');
  const [employer, setEmployer] = React.useState('');
  const [monthlyIncome, setMonthlyIncome] = React.useState('');
  const [showOptional, setShowOptional] = React.useState(false);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [showValidation, setShowValidation] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<PortalProfile>('/portal/profile')
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setHasPhoto(data.hasProfilePhoto);
        setGender(data.gender ?? '');
        setCivilStatus(data.civilStatus ?? '');
        setBirthDate(data.birthDate ?? '');
        setMobilePhone1(data.mobilePhone1 ?? '');
        setAddressDraft(addressToDraft(data.addresses[0]));
        setPlaceOfBirth(data.placeOfBirth ?? '');
        setNationality(data.nationality ?? 'Filipino');
        setHomeOwnership(data.homeOwnership ?? '');
        setMobilePhone2(data.mobilePhone2 ?? '');
        setOccupation(data.occupation ?? '');
        setEmployer(data.employer ?? '');
        setMonthlyIncome(data.monthlyIncome != null ? String(data.monthlyIncome) : '');
        setStatus(isProfileComplete(data) ? 'complete' : 'incomplete');
      })
      // Fails open: a transient network error must never trap a client outside their own
      // dashboard - the gate only ever blocks on a confirmed-incomplete profile, not on "unknown".
      .catch(() => setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') return <GateSkeleton />;
  if (status === 'complete' || status === 'error') return <>{children}</>;

  const missing = {
    photo: !hasPhoto,
    gender: !gender,
    civilStatus: !civilStatus,
    birthDate: !birthDate,
    mobilePhone1: !mobilePhone1,
    address: !(addressDraft.barangay && addressDraft.cityMunicipality && addressDraft.province),
  };
  const hasMissingRequired = Object.values(missing).some(Boolean);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hasMissingRequired) {
      setShowValidation(true);
      return;
    }
    setSaveState('saving');
    try {
      // The backend's optional address subfields are `z.string().min(1).optional()` - they must be
      // omitted entirely when blank, not sent as `''` (which fails `.min(1)`). `PortalAddressPicker`
      // always returns every key, so an untouched optional field here is `''`, not `undefined`.
      const sanitizedAddress = Object.fromEntries(
        Object.entries(addressDraft).map(([key, value]) => [key, value.trim() ? value.trim() : undefined]),
      ) as AddressDraft;

      const body: UpdatePortalProfileRequest = {
        gender,
        civilStatus,
        birthDate,
        mobilePhone1: mobilePhone1.trim(),
        addresses: [sanitizedAddress],
        placeOfBirth: placeOfBirth.trim() || undefined,
        nationality: nationality.trim() || undefined,
        homeOwnership: homeOwnership || undefined,
        mobilePhone2: mobilePhone2.trim() || undefined,
        occupation: occupation.trim() || undefined,
        employer: employer.trim() || undefined,
        monthlyIncome: monthlyIncome.trim() ? Number(monthlyIncome) : undefined,
      };
      const updated = await apiClient.patch<PortalProfile>('/portal/profile', body, true);
      setProfile(updated);
      setStatus(isProfileComplete(updated) ? 'complete' : 'incomplete');
    } catch {
      setSaveState('error');
    }
  };

  const initials = profile ? [profile.firstName?.[0], profile.lastName?.[0]].filter(Boolean).join('').toUpperCase() : '';

  return (
    <div className="mx-auto max-w-2xl py-6 sm:py-10">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-green text-white shadow-md">
          <UserRound className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green-foreground/70">{t.portalOnboarding.eyebrow}</p>
          <h1 className="text-2xl font-bold tracking-tight">{t.portalOnboarding.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.portalOnboarding.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className={`p-6 ${showValidation && missing.photo ? 'ring-1 ring-destructive' : ''}`}>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            {t.portalOnboarding.photoTitle}
            <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
              {t.portalOnboarding.requiredBadge}
            </span>
          </h2>
          <div className="mt-3">
            <PortalProfilePhoto initials={initials} onUploaded={() => setHasPhoto(true)} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold">{t.profile.personalInfo.title}</h2>
          {showValidation && hasMissingRequired && (
            <Alert tone="error" className="mt-4">
              {t.portalOnboarding.validationError}
            </Alert>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {t.profile.personalInfo.gender}
                <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  {t.portalOnboarding.requiredBadge}
                </span>
              </Label>
              <Select value={gender} onChange={(e) => setGender(e.target.value)} className={showValidation && missing.gender ? 'border-destructive' : ''}>
                <option value="">{t.profile.personalInfo.select}</option>
                {GENDER_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {t.profile.personalInfo.civilStatus}
                <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  {t.portalOnboarding.requiredBadge}
                </span>
              </Label>
              <Select
                value={civilStatus}
                onChange={(e) => setCivilStatus(e.target.value)}
                className={showValidation && missing.civilStatus ? 'border-destructive' : ''}
              >
                <option value="">{t.profile.personalInfo.select}</option>
                {CIVIL_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {t.profile.personalInfo.birthDate}
                <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  {t.portalOnboarding.requiredBadge}
                </span>
              </Label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={showValidation && missing.birthDate ? 'border-destructive' : ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                {t.profile.personalInfo.mobileNumber}
                <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                  {t.portalOnboarding.requiredBadge}
                </span>
              </Label>
              <PhoneInput value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} placeholder="09XX XXX XXXX" />
            </div>
          </div>
        </Card>

        <Card className={`p-6 ${showValidation && missing.address ? 'ring-1 ring-destructive' : ''}`}>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            {t.profile.address.title}
            <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
              {t.portalOnboarding.requiredBadge}
            </span>
          </h2>
          <div className="mt-4">
            <PortalAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
          </div>
        </Card>

        <button
          type="button"
          onClick={() => setShowOptional((v) => !v)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t.portalOnboarding.optionalToggle} {showOptional ? '−' : '+'}
        </button>

        {showOptional && (
          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label>{t.profile.personalInfo.altMobileNumber}</Label>
                <PhoneInput value={mobilePhone2} onChange={(e) => setMobilePhone2(e.target.value)} placeholder="09XX XXX XXXX" />
              </div>
              <div className="space-y-1.5">
                <Label>{t.profile.employment.employer}</Label>
                <Input value={employer} onChange={(e) => setEmployer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.profile.employment.occupation}</Label>
                <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.profile.employment.monthlyIncome}</Label>
                <Input type="number" min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </Card>
        )}

        <Card className="flex items-center justify-between p-6">
          <div>
            {saveState === 'error' && <Alert tone="error">{t.portalOnboarding.genericSaveError}</Alert>}
          </div>
          <Button type="submit" disabled={saveState === 'saving'}>
            {saveState === 'saving' ? (
              t.portalOnboarding.saving
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> {t.portalOnboarding.saveAndContinue}
              </>
            )}
          </Button>
        </Card>
      </form>
    </div>
  );
}
