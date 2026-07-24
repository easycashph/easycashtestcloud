import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { PortalHeader } from '@/components/PortalHeader';
import { PortalAddressPicker, emptyAddressDraft, type AddressDraft } from '@/components/PortalAddressPicker';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { PortalProfile, UpdatePortalProfileRequest } from '@/lib/portalApiTypes';

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
  const [mobilePhone1, setMobilePhone1] = React.useState('');
  const [mobilePhone2, setMobilePhone2] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = React.useState('');

  const loadProfile = React.useCallback(() => {
    setState('loading');
    apiClient
      .get<PortalProfile>('/portal/profile')
      .then((data) => {
        setProfile(data);
        setMobilePhone1(data.mobilePhone1 ?? '');
        setMobilePhone2(data.mobilePhone2 ?? '');
        setEmail(data.email ?? '');
        setAddressDraft(addressToDraft(data.addresses[0]));
        setState('ready');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'PORTAL_ACCOUNT_NOT_LINKED') {
          setState('not-linked');
        } else {
          setState('error');
        }
      });
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
        mobilePhone1: mobilePhone1.trim() || undefined,
        mobilePhone2: mobilePhone2.trim() || undefined,
        email: email.trim() || undefined,
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
          <Card className="mt-8 p-6">
            <p className="text-sm text-muted-foreground">
              Your account isn't linked to a client profile yet. This happens once Easycash staff review and approve one of
              your loan applications - check back after that.
            </p>
          </Card>
        )}

        {state === 'ready' && profile && (
          <Card className="mt-8 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={[profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ')} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Civil status</Label>
                <Input value={profile.civilStatus ?? ''} disabled />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Name and other details are set by Easycash staff. Contact Easycash if any of this needs correcting.
            </p>

            <form onSubmit={handleSave} className="mt-6 space-y-6 border-t border-border pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
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

              <div className="space-y-3">
                <Label>Present address</Label>
                <PortalAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
              </div>

              {saveState === 'error' && <Alert tone="error">{saveError}</Alert>}
              {saveState === 'saved' && <Alert tone="success">Profile updated.</Alert>}

              <Button type="submit" disabled={saveState === 'saving'}>
                {saveState === 'saving' ? 'Saving…' : 'Save Changes'}
              </Button>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}
