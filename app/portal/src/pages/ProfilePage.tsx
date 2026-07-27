import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { PortalHeader } from '@/components/PortalHeader';
import { PortalAddressPicker, emptyAddressDraft, type AddressDraft } from '@/components/PortalAddressPicker';
import { PortalAvatar } from '@/components/PortalAvatar';
import { apiClient, ApiError } from '@/lib/apiClient';
import type {
  PortalLoanApplicationDetail,
  PortalLoanApplicationSummary,
  PortalProfile,
  SubmitLoanApplicationRequest,
  UpdatePortalProfileRequest,
} from '@/lib/portalApiTypes';

const GENDER_OPTIONS = ['Female', 'Male'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widower', 'Separated'];
const HOME_OWNERSHIP_OPTIONS = ['Owned', 'Renting', 'Living with family'];

interface ApplicantProfileDraft {
  applicantName: string;
  age: string;
  gender: string;
  civilStatus: string;
  birthDate: string;
  placeOfBirth: string;
  nationality: string;
  homeOwnership: string;
  mobilePhone: string;
  email: string;
  monthlyIncome: string;
  employer: string;
  occupation: string;
  officeAddress: string;
  tinNumber: string;
  sssNumber: string;
}

function detailToApplicantDraft(detail: PortalLoanApplicationDetail): ApplicantProfileDraft {
  return {
    applicantName: detail.applicantName ?? '',
    age: detail.age != null ? String(detail.age) : '',
    gender: detail.gender ?? '',
    civilStatus: detail.civilStatus ?? '',
    birthDate: detail.birthDate ?? '',
    placeOfBirth: detail.placeOfBirth ?? '',
    nationality: detail.nationality ?? '',
    homeOwnership: detail.homeOwnership ?? '',
    mobilePhone: detail.mobilePhone ?? '',
    email: detail.email ?? '',
    monthlyIncome: detail.monthlyIncome != null ? String(detail.monthlyIncome) : '',
    employer: detail.employer ?? '',
    occupation: detail.occupation ?? '',
    officeAddress: detail.officeAddress ?? '',
    tinNumber: detail.tinNumber ?? '',
    sssNumber: detail.sssNumber ?? '',
  };
}

function detailToApplicantAddressDraft(detail: PortalLoanApplicationDetail): AddressDraft {
  return {
    houseUnitNumber: detail.houseUnitNumber ?? '',
    street: detail.street ?? '',
    barangay: detail.barangay ?? '',
    cityMunicipality: detail.cityMunicipality ?? '',
    province: detail.province ?? '',
    zipCode: detail.zipCode ?? '',
  };
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

/**
 * Phase D (2026-07-24 user request): a linked portal client can view their whole profile as the
 * LMS has it, and edit the confirmed self-service subset (mobile numbers, email, present address)
 * directly against the real Borrower record - see backend's GetPortalProfileUseCase/
 * UpdatePortalProfileUseCase. Not linked yet (no MIS staff has run "Create Client Profile" on an
 * approved application) shows an explanatory empty state instead of a form.
 */
export function ProfilePage() {
  const [state, setState] = React.useState<'loading' | 'not-linked' | 'ready' | 'error'>('loading');
  const [profile, setProfile] = React.useState<PortalProfile | null>(null);
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
  const [latestApplicationId, setLatestApplicationId] = React.useState<string | null>(null);
  const [latestApplicationEditable, setLatestApplicationEditable] = React.useState(false);
  const [applicantDraft, setApplicantDraft] = React.useState<ApplicantProfileDraft | null>(null);
  const [applicantAddressDraft, setApplicantAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());
  const [applicationState, setApplicationState] = React.useState<'loading' | 'none' | 'ready' | 'error'>('loading');
  const [applicantSaveState, setApplicantSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [applicantSaveError, setApplicantSaveError] = React.useState('');

  const loadLatestApplication = React.useCallback(() => {
    setApplicationState('loading');
    apiClient
      .get<PortalLoanApplicationSummary[]>('/portal/loan-applications')
      .then((applications) => {
        if (applications.length === 0) {
          setApplicationState('none');
          return;
        }
        const latest = applications.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b));
        return apiClient.get<PortalLoanApplicationDetail>(`/portal/loan-applications/${latest.id}`).then((detail) => {
          setLatestApplicationId(detail.id);
          setLatestApplicationEditable(detail.status === 'PREAPPROVED' || detail.status === 'PREDECLINED');
          setApplicantDraft(detailToApplicantDraft(detail));
          setApplicantAddressDraft(detailToApplicantAddressDraft(detail));
          setApplicationState('ready');
        });
      })
      .catch(() => setApplicationState('error'));
  }, []);

  const loadProfile = React.useCallback(() => {
    setState('loading');
    apiClient
      .get<PortalProfile>('/portal/profile')
      .then((data) => {
        setProfile(data);
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
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'PORTAL_ACCOUNT_NOT_LINKED') {
          setState('not-linked');
          loadLatestApplication();
        } else {
          setState('error');
        }
      });
  }, [loadLatestApplication]);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const updateApplicantField = <K extends keyof ApplicantProfileDraft>(field: K, value: ApplicantProfileDraft[K]) => {
    setApplicantDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSaveApplicantProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!applicantDraft || !latestApplicationId) return;
    setApplicantSaveState('saving');
    setApplicantSaveError('');
    try {
      const body: Partial<SubmitLoanApplicationRequest> = {
        applicantName: applicantDraft.applicantName.trim() || undefined,
        age: applicantDraft.age.trim() ? Number(applicantDraft.age) : undefined,
        gender: applicantDraft.gender || undefined,
        civilStatus: applicantDraft.civilStatus || undefined,
        birthDate: applicantDraft.birthDate.trim() || undefined,
        placeOfBirth: applicantDraft.placeOfBirth.trim() || undefined,
        nationality: applicantDraft.nationality.trim() || undefined,
        homeOwnership: applicantDraft.homeOwnership || undefined,
        mobilePhone: applicantDraft.mobilePhone.trim() || undefined,
        email: applicantDraft.email.trim() || undefined,
        monthlyIncome: applicantDraft.monthlyIncome.trim() ? Number(applicantDraft.monthlyIncome) : undefined,
        employer: applicantDraft.employer.trim() || undefined,
        occupation: applicantDraft.occupation.trim() || undefined,
        officeAddress: applicantDraft.officeAddress.trim() || undefined,
        tinNumber: applicantDraft.tinNumber.trim() || undefined,
        sssNumber: applicantDraft.sssNumber.trim() || undefined,
        houseUnitNumber: applicantAddressDraft.houseUnitNumber.trim() || undefined,
        street: applicantAddressDraft.street.trim() || undefined,
        barangay: applicantAddressDraft.barangay.trim() || undefined,
        cityMunicipality: applicantAddressDraft.cityMunicipality.trim() || undefined,
        province: applicantAddressDraft.province.trim() || undefined,
        zipCode: applicantAddressDraft.zipCode.trim() || undefined,
      };
      await apiClient.patch(`/portal/loan-applications/${latestApplicationId}`, body, true);
      setApplicantSaveState('saved');
    } catch (err) {
      setApplicantSaveError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setApplicantSaveState('error');
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveState('saving');
    setSaveError('');
    try {
      const body: UpdatePortalProfileRequest = {
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
      const updated = await apiClient.patch<PortalProfile>('/portal/profile', body, true);
      setProfile(updated);
      setSaveState('saved');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSaveState('error');
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />

      <main className="container max-w-3xl py-10">
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is the same client record Easycash staff sees - you can update your contact info here.
        </p>

        {state === 'loading' && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

        {state === 'error' && (
          <Alert tone="error" className="mt-8">
            Couldn't load your profile. Please try again later.
          </Alert>
        )}

        {state === 'not-linked' && (
          <div className="mt-8 space-y-5">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                You're not yet an official Easycash client - that happens once a loan officer creates your loan account in the
                LMS after reviewing your application. You can still keep your personal, address, and employment details
                up to date below.
              </p>
            </Card>

            {applicationState === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
            {applicationState === 'error' && (
              <Alert tone="error">Couldn't load your application details. Please try again later.</Alert>
            )}
            {applicationState === 'none' && (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">You haven't submitted a loan application yet.</p>
              </Card>
            )}
            {applicationState === 'ready' && applicantDraft && !latestApplicationEditable && (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">
                  Your application has moved past the initial review stage, so these details are locked. Contact Easycash if
                  something needs correcting.
                </p>
              </Card>
            )}

            {applicationState === 'ready' && applicantDraft && latestApplicationEditable && (
              <form onSubmit={handleSaveApplicantProfile} className="space-y-5">
                <Card className="p-6">
                  <h2 className="text-sm font-semibold">Personal Information</h2>
                  {latestApplicationId && (
                    <div className="mt-4">
                      <PortalAvatar
                        loanApplicationId={latestApplicationId}
                        initials={applicantDraft.applicantName.trim().charAt(0).toUpperCase() || '?'}
                      />
                    </div>
                  )}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Full name</Label>
                      <Input
                        value={applicantDraft.applicantName}
                        onChange={(e) => updateApplicantField('applicantName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Age</Label>
                      <Input type="number" value={applicantDraft.age} onChange={(e) => updateApplicantField('age', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Gender</Label>
                      <Select value={applicantDraft.gender} onChange={(e) => updateApplicantField('gender', e.target.value)}>
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
                      <Select value={applicantDraft.civilStatus} onChange={(e) => updateApplicantField('civilStatus', e.target.value)}>
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
                      <Input
                        type="date"
                        value={applicantDraft.birthDate}
                        onChange={(e) => updateApplicantField('birthDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Place of birth</Label>
                      <Input
                        value={applicantDraft.placeOfBirth}
                        onChange={(e) => updateApplicantField('placeOfBirth', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nationality</Label>
                      <Input
                        value={applicantDraft.nationality}
                        onChange={(e) => updateApplicantField('nationality', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Home ownership</Label>
                      <Select
                        value={applicantDraft.homeOwnership}
                        onChange={(e) => updateApplicantField('homeOwnership', e.target.value)}
                      >
                        <option value="">Select</option>
                        {HOME_OWNERSHIP_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Mobile phone</Label>
                      <Input
                        value={applicantDraft.mobilePhone}
                        onChange={(e) => updateApplicantField('mobilePhone', e.target.value)}
                        placeholder="09XXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={applicantDraft.email}
                        onChange={(e) => updateApplicantField('email', e.target.value)}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-sm font-semibold">Address</h2>
                  <div className="mt-4">
                    <PortalAddressPicker
                      value={applicantAddressDraft}
                      onChange={(patch) => setApplicantAddressDraft((prev) => ({ ...prev, ...patch }))}
                    />
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-sm font-semibold">Employment</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Monthly income</Label>
                      <Input
                        type="number"
                        value={applicantDraft.monthlyIncome}
                        onChange={(e) => updateApplicantField('monthlyIncome', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Employer</Label>
                      <Input value={applicantDraft.employer} onChange={(e) => updateApplicantField('employer', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Occupation</Label>
                      <Input
                        value={applicantDraft.occupation}
                        onChange={(e) => updateApplicantField('occupation', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Office address</Label>
                      <Input
                        value={applicantDraft.officeAddress}
                        onChange={(e) => updateApplicantField('officeAddress', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>TIN number</Label>
                      <Input value={applicantDraft.tinNumber} onChange={(e) => updateApplicantField('tinNumber', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SSS number</Label>
                      <Input value={applicantDraft.sssNumber} onChange={(e) => updateApplicantField('sssNumber', e.target.value)} />
                    </div>
                  </div>

                  {applicantSaveState === 'error' && <Alert tone="error" className="mt-4">{applicantSaveError}</Alert>}
                  {applicantSaveState === 'saved' && <Alert tone="success" className="mt-4">Profile updated.</Alert>}

                  <Button type="submit" className="mt-4" disabled={applicantSaveState === 'saving'}>
                    {applicantSaveState === 'saving' ? 'Saving…' : 'Save Changes'}
                  </Button>
                </Card>
              </form>
            )}
          </div>
        )}

        {state === 'ready' && profile && (
          <form onSubmit={handleSave} className="mt-8 space-y-5">
            <Card className="p-6">
              <h2 className="text-sm font-semibold">Personal Information</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Full name</Label>
                  <Input value={[profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ')} disabled />
                  <p className="text-xs text-muted-foreground">Name is set by Easycash staff. Contact Easycash if this needs correcting.</p>
                </div>
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
                  <Input value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} placeholder="09XXXXXXXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Alternate mobile number</Label>
                  <Input value={mobilePhone2} onChange={(e) => setMobilePhone2(e.target.value)} placeholder="09XXXXXXXXX" />
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
                  <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
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
      </main>
    </div>
  );
}
