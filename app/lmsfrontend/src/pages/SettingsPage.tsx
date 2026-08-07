import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Bell, Check, DoorOpen, Eye, EyeOff, Globe, History, KeyRound, LayoutGrid, Laptop, LogOut, Move, Moon, Palette, RotateCcw, ShieldCheck, ShieldQuestion, Sun, Type, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { PhoneInput } from '@/components/PhoneInput';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComingSoonButton } from '@/components/ComingSoonButton';
import { computeAge } from '@/lib/computeAge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { type AddressDraft, emptyAddressDraft, PsgcAddressPicker } from '@/components/PsgcAddressPicker';
import { ACCENT_OPTIONS, FONT_SIZE_OPTIONS, THEME_STYLE_OPTIONS, useTheme, type Accent, type ThemeStyle } from '@/components/theme-provider';
import { DASHBOARD_CARD_LABELS, useDashboardLayout, type DashboardCardId } from '@/components/dashboard-layout-provider';
import { LANDING_PAGE_OPTIONS, readLandingPage, writeLandingPage } from '@/lib/landingPagePreference';
import { NOTIFICATION_TYPE_OPTIONS, readMutedTypes, writeMutedTypes } from '@/lib/notificationPreference';
import type { NotificationType } from '@/lib/notificationApiTypes';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useLanguage } from '@/lib/languageContext';
import type { Language } from '@/lib/translations';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { AuthenticatedUserView, LoginActivityView, SessionView } from '@/lib/authTypes';
import type { UpdateOwnProfileRequest } from '@/lib/userApiTypes';
import { cn, describeUserAgent, formatDateTime } from '@/lib/utils';

/** Cross-referenced against `app/backend/src/modules/identity/domain/PasswordPolicy.ts`'s real
 * `MIN_LENGTH` so the two don't silently drift. */
const PASSWORD_MIN_LENGTH = 12;

type SettingsTab = 'profile' | 'security' | 'appearance' | 'notifications' | 'language';

/**
 * Frontend↔Backend Wiring Pilot, Stage 0c, self-service Profile/Password wired to real endpoints
 * 2026-07-12 (`PATCH /users/me`, `POST /users/me/change-password`). All four tabs are personal,
 * per-user preferences/details - none are MIS-restricted. Theme Color and Appearance remain
 * `localStorage`-only by design (see `theme-provider.tsx`) - genuinely local device preferences,
 * not account data.
 */
export function SettingsPage() {
  useLogPageView('Settings');
  const [tab, setTab] = React.useState<SettingsTab>('profile');
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h2>
        <p className="text-sm text-muted-foreground">Your personal account details, security, and appearance preferences.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="profile">{t('settings.tab.profile')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.tab.security')}</TabsTrigger>
          <TabsTrigger value="appearance">{t('settings.tab.appearance')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings.tab.notifications')}</TabsTrigger>
          <TabsTrigger value="language">{t('settings.tab.language')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'profile' && <UserProfileTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'language' && <LanguageTab />}

      <RecentActivityPanel label="Settings" />
    </div>
  );
}

function LanguageTab() {
  const { language, setLanguage, t } = useLanguage();

  const handleChange = (next: Language) => {
    setLanguage(next);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Globe className="h-4 w-4 text-primary" />
        <div>
          <CardTitle>{t('settings.language.title')}</CardTitle>
          <CardDescription>{t('settings.language.description')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Select value={language} onValueChange={(v) => handleChange(v as Language)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t('settings.language.english')}</SelectItem>
            <SelectItem value="fil">{t('settings.language.filipino')}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

/** User.address is still a single free-text string on the wire (no structured region/province/
 * city/barangay columns like Borrower's - that would need its own backend migration). Composes the
 * cascading picker's parts into one formatted line for that existing field, PH-address-line style. */
function composeAddressLine(draft: AddressDraft): string {
  const line1 = [draft.houseUnitNumber, draft.street].filter(Boolean).join(' ');
  return [line1, draft.barangay ? `Brgy. ${draft.barangay}` : '', draft.cityMunicipality, draft.province, draft.zipCode]
    .filter(Boolean)
    .join(', ');
}

function UserProfileTab() {
  const { currentAccount, refreshCurrentUser } = useRole();
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiClient.get<AuthenticatedUserView>('/auth/me'),
  });
  const me = meQuery.data;

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactNumber, setContactNumber] = React.useState('');
  // Starts blank rather than reverse-parsed from the existing free-text address (there's nothing
  // reliable to split it back into region/province/city/barangay from) - saving leaves the existing
  // address untouched unless the officer actively picks a new one below (see saveMutation).
  const [addressDraft, setAddressDraft] = React.useState<AddressDraft>(emptyAddressDraft());
  const [birthday, setBirthday] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!me) return;
    setFirstName(me.firstName);
    setLastName(me.lastName);
    setContactNumber(me.contactNumber ?? '');
    setBirthday(me.birthday ? me.birthday.slice(0, 10) : '');
  }, [me]);

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

  const saveMutation = useMutation({
    mutationFn: () => {
      const composedAddress = composeAddressLine(addressDraft);
      const body: UpdateOwnProfileRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactNumber: contactNumber.trim() || null,
        address: composedAddress || me?.address || null,
        birthday: birthday || null,
      };
      return apiClient.patch<AuthenticatedUserView>('/users/me', body);
    },
    onSuccess: async () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      await refreshCurrentUser();
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <UserRound className="h-4 w-4 text-primary" />
        <div>
          <CardTitle>User Profile</CardTitle>
          <CardDescription>Your personal details, saved to your real account.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {meQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form className="grid max-w-xl gap-4" onSubmit={handleSave}>
            <div className="space-y-1.5">
              <Label>Profile Picture</Label>
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarFallback>{initials || <UserRound className="h-6 w-6" />}</AvatarFallback>
                </Avatar>
                <ComingSoonButton type="button" variant="outline" size="sm">
                  Upload photo
                </ComingSoonButton>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-first-name">First Name</Label>
              <Input id="profile-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-last-name">Last Name</Label>
              <Input id="profile-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" type="email" value={me?.email ?? ''} disabled />
              <p className="text-xs text-muted-foreground">Set by MIS, not self-editable.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-contact">Contact Number</Label>
              <PhoneInput id="profile-contact" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="09XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              {me?.address && <p className="text-xs text-muted-foreground">Currently saved: {me.address}</p>}
              <PsgcAddressPicker value={addressDraft} onChange={(patch) => setAddressDraft((prev) => ({ ...prev, ...patch }))} />
              <p className="text-xs text-muted-foreground">Leave blank to keep the address above unchanged.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-birthday">Birthday</Label>
              <Input id="profile-birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
              {computeAge(birthday) !== null && <p className="text-xs text-muted-foreground">Age: {computeAge(birthday)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <p className="text-sm text-muted-foreground">{currentAccount.role} - assigned by MIS, not self-editable.</p>
            </div>
            {saveMutation.isError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {saveMutation.error instanceof Error ? saveMutation.error.message : 'Could not save changes.'}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saveMutation.isPending}>
                Save Changes
              </Button>
              {saved && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  const { currentAccount } = useRole();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [message, setMessage] = React.useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const changePasswordMutation = useMutation({
    mutationFn: () => apiClient.post('/users/me/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      setMessage({ tone: 'success', text: 'Password changed.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        setMessage({ tone: 'error', text: 'Current password is incorrect.' });
      } else {
        setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not change password.' });
      }
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setMessage({ tone: 'error', text: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setMessage(null);
    changePasswordMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <KeyRound className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>Username</CardTitle>
            <CardDescription>Your sign-in identifier - set by MIS, not self-editable.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{currentAccount.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Requires your current password. Minimum {PASSWORD_MIN_LENGTH} characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid max-w-md gap-4" onSubmit={handleChangePassword}>
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current Password</Label>
              <PasswordInput id="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <PasswordInput id="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <PasswordInput id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {message && (
              <p className={cn('text-xs', message.tone === 'error' ? 'text-destructive' : 'text-success')}>{message.text}</p>
            )}
            <Button type="submit" className="w-fit" disabled={changePasswordMutation.isPending}>
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <TwoFactorAuthCard />
      <SessionsCard />
      <LoginActivityCard />
    </div>
  );
}

/**
 * Settings > Security > Two-Factor Authentication (2026-07-22 user request). Two states:
 *  - Disabled (default - CLAUDE.md/security posture: an opt-in, never silently turned on): pick a
 *    channel, send a code, confirm it - only on a CORRECT confirmation does the backend actually
 *    flip `twoFactorEnabled` (ConfirmTwoFactorSetupUseCase), so a wrong number/inbox can never
 *    leave the account in a broken "2FA on, code never arrives" state.
 *  - Enabled: shows which channel, with a Disable control that only needs the current password
 *    (no OTP) - the account's own "get me unstuck" escape hatch if the enabled channel ever stops
 *    being reachable.
 */
function TwoFactorAuthCard() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiClient.get<AuthenticatedUserView>('/auth/me'),
  });

  const [channel, setChannel] = React.useState<'EMAIL' | 'SMS'>('EMAIL');
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [disablePassword, setDisablePassword] = React.useState('');
  const [showDisableForm, setShowDisableForm] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const refetchMe = () => queryClient.invalidateQueries({ queryKey: ['auth-me'] });

  const requestSetupMutation = useMutation({
    mutationFn: () => apiClient.post<{ challengeId: string }>('/users/me/two-factor/setup', { channel }),
    onSuccess: (result) => {
      setChallengeId(result.challengeId);
      setMessage({ tone: 'success', text: `Code sent via ${channel === 'EMAIL' ? 'email' : 'SMS'}.` });
    },
    onError: (error: unknown) => setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not send a code.' }),
  });

  const confirmSetupMutation = useMutation({
    mutationFn: () => apiClient.post('/users/me/two-factor/confirm', { challengeId, code: code.trim() }),
    onSuccess: () => {
      setChallengeId(null);
      setCode('');
      setMessage({ tone: 'success', text: 'Two-factor authentication is now enabled.' });
      refetchMe();
    },
    onError: (error: unknown) => setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not confirm that code.' }),
  });

  const disableMutation = useMutation({
    mutationFn: () => apiClient.post('/users/me/two-factor/disable', { currentPassword: disablePassword }),
    onSuccess: () => {
      setShowDisableForm(false);
      setDisablePassword('');
      setMessage({ tone: 'success', text: 'Two-factor authentication is now disabled.' });
      refetchMe();
    },
    onError: (error: unknown) =>
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not disable two-factor authentication.' }),
  });

  const me = meQuery.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <ShieldQuestion className="h-4 w-4 text-primary" />
        <div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Require a one-time code, sent by email or SMS, on top of your password when signing in.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {meQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : me?.twoFactorEnabled ? (
          <>
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-muted-foreground">
                  Codes are sent via {me.twoFactorChannel === 'EMAIL' ? 'email' : 'SMS'} on every sign-in.
                </p>
              </div>
              <Switch checked={true} onCheckedChange={() => setShowDisableForm(true)} aria-label="Turn off two-factor authentication" />
            </div>

            {showDisableForm ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="disable-2fa-password">Current Password</Label>
                  <PasswordInput
                    id="disable-2fa-password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={!disablePassword || disableMutation.isPending}
                    onClick={() => disableMutation.mutate()}
                  >
                    {disableMutation.isPending ? 'Disabling…' : 'Disable 2FA'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDisableForm(false);
                      setDisablePassword('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowDisableForm(true)}>
                Disable
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="text-sm font-medium">Disabled</p>
                <p className="text-xs text-muted-foreground">Your account only requires a password to sign in.</p>
              </div>
              <Switch
                checked={false}
                disabled={requestSetupMutation.isPending}
                onCheckedChange={() => requestSetupMutation.mutate()}
                aria-label="Turn on two-factor authentication"
              />
            </div>

            {!challengeId ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label>Send code via</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as 'EMAIL' | 'SMS')}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="SMS">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" size="sm" disabled={requestSetupMutation.isPending} onClick={() => requestSetupMutation.mutate()}>
                  {requestSetupMutation.isPending ? 'Sending…' : 'Send Code'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-2fa-code">Verification Code</Label>
                  <Input id="confirm-2fa-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!code || confirmSetupMutation.isPending}
                    onClick={() => confirmSetupMutation.mutate()}
                  >
                    {confirmSetupMutation.isPending ? 'Confirming…' : 'Confirm & Enable'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setChallengeId(null);
                      setCode('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {message && (
          <p className={cn('text-xs', message.tone === 'error' ? 'text-destructive' : 'text-success')}>{message.text}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Settings > Security > Active Sessions (2026-07-21 user request) - every device currently logged
 * into this account, backed by the non-revoked, non-expired `RefreshToken` rows for this user
 * (`GET /auth/sessions`). "This device" (the row matching the access token's own `sid` claim) has
 * no Revoke button - ending your own current session here would leave a dead refresh cookie behind
 * (the button that actually does that safely is the normal Log Out in the account menu, which also
 * clears the cookie). Revoking any other row signs that device out the next time it tries to
 * refresh its access token - not instantly, since access tokens are stateless JWTs valid until
 * they naturally expire.
 */
function SessionsCard() {
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [revokingAll, setRevokingAll] = React.useState(false);

  const sessionsQuery = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => apiClient.get<{ items: SessionView[] }>('/auth/sessions'),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => apiClient.delete(`/auth/sessions/${sessionId}`),
    onMutate: (sessionId) => setRevokingId(sessionId),
    onSettled: () => {
      setRevokingId(null);
      queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    },
  });

  const sessions = sessionsQuery.data?.items ?? [];
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  const revokeAllOthers = async () => {
    setRevokingAll(true);
    try {
      await Promise.all(otherSessions.map((s) => apiClient.delete(`/auth/sessions/${s.id}`)));
    } finally {
      setRevokingAll(false);
      queryClient.invalidateQueries({ queryKey: ['auth-sessions'] });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex flex-row items-center gap-2">
          <Laptop className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Devices currently signed in to your account.</CardDescription>
          </div>
        </div>
        {otherSessions.length > 0 && (
          <Button type="button" variant="outline" size="sm" disabled={revokingAll} onClick={revokeAllOthers}>
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> {revokingAll ? 'Signing out…' : 'Sign out all other devices'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{describeUserAgent(session.userAgent)}</span>
                    {session.isCurrent && <Badge variant="outline">This device</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {session.ipAddress ?? 'Unknown IP'} · Signed in {formatDateTime(session.createdAt)}
                  </p>
                </div>
                {!session.isCurrent && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={revokeMutation.isPending && revokingId === session.id}
                    onClick={() => revokeMutation.mutate(session.id)}
                  >
                    {revokeMutation.isPending && revokingId === session.id ? 'Signing out…' : 'Sign out'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Settings > Security > Recent Sign-in Activity (2026-07-21 user request) - the last 20
 * LOGIN_SUCCESS/LOGIN_FAILED events for this account, self-scoped server-side
 * (`GET /audit-logs/my-login-activity` - never a userId param the caller could tamper with). A
 * run of LOGIN_FAILED entries the user doesn't recognize is the "someone's guessing my password"
 * signal this card exists to surface.
 */
function LoginActivityCard() {
  const activityQuery = useQuery({
    queryKey: ['auth-login-activity'],
    queryFn: () => apiClient.get<{ items: LoginActivityView[] }>('/audit-logs/my-login-activity?limit=20'),
  });

  const events = activityQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <History className="h-4 w-4 text-primary" />
        <div>
          <CardTitle>Recent Sign-in Activity</CardTitle>
          <CardDescription>Your last 20 sign-in attempts, successful or not.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {activityQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-in activity on record.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  {event.action === 'LOGIN_SUCCESS' ? (
                    <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{event.action === 'LOGIN_SUCCESS' ? 'Signed in' : 'Failed sign-in attempt'}</p>
                    <p className="text-xs text-muted-foreground">
                      {describeUserAgent(event.userAgent)} · {event.ipAddress ?? 'Unknown IP'}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AppearanceTab() {
  const {
    theme,
    toggleTheme,
    accent,
    setAccent,
    customColor,
    setCustomColor,
    fontSize,
    setFontSize,
    dragReorderEnabled,
    setDragReorderEnabled,
    themeStyle,
    setThemeStyle,
  } = useTheme();
  const { currentAccount } = useRole();
  const [landingPage, setLandingPageState] = React.useState(() => readLandingPage(currentAccount.id));

  const applyLandingPage = (value: (typeof LANDING_PAGE_OPTIONS)[number]['value']) => {
    setLandingPageState(value);
    writeLandingPage(currentAccount.id, value);
  };

  const handleToggle = () => {
    toggleTheme();
  };

  const applyAccent = (next: Accent) => {
    if (next === accent) return;
    setAccent(next);
  };

  const applyThemeStyle = (next: ThemeStyle) => {
    if (next === themeStyle) return;
    setThemeStyle(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          {theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          <div>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Light or dark mode - your personal preference, remembered for your account only.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Dark Mode</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Currently: <Badge variant="outline">{theme === 'dark' ? 'Dark' : 'Light'}</Badge>
            </div>
          </div>
          <Switch checked={theme === 'dark'} onCheckedChange={handleToggle} aria-label="Toggle dark mode" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>Theme Style</CardTitle>
            <CardDescription>
              How cards, the sidebar, and dashboard surfaces look. Premium follows your Dark Mode setting above, same as Classic.
              Applies only to your account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {THEME_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => applyThemeStyle(option.value)}
                className={cn(
                  'rounded-md border p-3 text-left transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring',
                  themeStyle === option.value && 'border-primary ring-1 ring-primary',
                )}
                aria-pressed={themeStyle === option.value}
              >
                <div className="flex h-[70px] overflow-hidden rounded-md border">
                  {option.value === 'premium' ? (
                    <>
                      <div className="w-[22%]" style={{ background: '#14213d' }} />
                      <div className="flex flex-1 flex-col gap-1 p-1.5" style={{ background: '#f3f1ea' }}>
                        <div className="h-2 w-3/5 rounded-sm" style={{ background: '#c9a24b' }} />
                        <div className="flex flex-1 gap-1">
                          <div className="flex-1 rounded-sm border" style={{ background: '#fdfbf5', borderColor: '#e9e2cd' }} />
                          <div className="flex-1 rounded-sm border" style={{ background: '#fdfbf5', borderColor: '#e9e2cd' }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-[22%]" style={{ background: '#1a2138' }} />
                      <div className="flex flex-1 flex-col gap-1 p-1.5" style={{ background: '#f4f3ef' }}>
                        <div className="h-2 w-3/5 rounded-sm" style={{ background: '#dcdad2' }} />
                        <div className="flex flex-1 gap-1">
                          <div className="flex-1 rounded-sm bg-white" />
                          <div className="flex-1 rounded-sm bg-white" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-medium">{option.label}</span>
                  {themeStyle === option.value && <Check className="h-4 w-4 text-primary" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Palette className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>Theme Color</CardTitle>
            <CardDescription>
              Your personal accent color - buttons, active section tabs, links, and the primary chart series, in both light and dark
              mode. Applies only to your account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ACCENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => applyAccent(option.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring',
                  accent === option.value && 'border-primary ring-1 ring-primary',
                )}
                aria-pressed={accent === option.value}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ background: option.swatch }}>
                  {accent === option.value && <Check className="h-5 w-5 text-white" />}
                </span>
                <span className="text-xs font-medium">{option.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => applyAccent('custom')}
              className={cn(
                'flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring',
                accent === 'custom' && 'border-primary ring-1 ring-primary',
              )}
              aria-pressed={accent === 'custom'}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ background: customColor }}>
                {accent === 'custom' && <Check className="h-5 w-5 text-white" />}
              </span>
              <span className="text-xs font-medium">Custom</span>
            </button>
          </div>
          {accent === 'custom' && (
            <div className="mt-4 flex items-center gap-3 rounded-md border p-3">
              <input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-9 w-9 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="Pick a custom accent color"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">Pick your color</p>
                <p className="truncate text-xs text-muted-foreground">{customColor}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Type className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>Text Size</CardTitle>
            <CardDescription>
              Scales text and spacing across the whole app - useful if the default is too small or too large for you. Applies only to
              your account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {FONT_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFontSize(option.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-md border p-3 text-center transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring',
                  fontSize === option.value && 'border-primary ring-1 ring-primary',
                )}
                aria-pressed={fontSize === option.value}
              >
                <span
                  className="font-semibold"
                  style={{ fontSize: option.value === 'small' ? '0.875rem' : option.value === 'large' ? '1.375rem' : '1.125rem' }}
                >
                  Aa
                </span>
                <span className="text-xs font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <DoorOpen className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>Landing Page</CardTitle>
            <CardDescription>Where you land right after signing in. Applies only to your account.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {LANDING_PAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => applyLandingPage(option.value)}
                className={cn(
                  'rounded-md border p-3 text-center text-sm font-medium transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring',
                  landingPage === option.value && 'border-primary ring-1 ring-primary',
                )}
                aria-pressed={landingPage === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Move className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>Card Reordering</CardTitle>
            <CardDescription>
              Drag cards by their handle to rearrange sections on the Dashboard, Client Profile, Loan Application, and Loan Account
              pages. Turn off if you prefer a fixed layout. Applies only to your account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="text-sm font-medium">Drag and Drop</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Currently: <Badge variant="outline">{dragReorderEnabled ? 'On' : 'Off'}</Badge>
              </div>
            </div>
            <Switch checked={dragReorderEnabled} onCheckedChange={setDragReorderEnabled} aria-label="Toggle drag and drop card reordering" />
          </div>
          <p className="text-xs text-muted-foreground">
            Turning this off keeps each page's current card order and hides the drag handles - it doesn't reset your saved order. Turn
            it back on anytime to resume rearranging.
          </p>
        </CardContent>
      </Card>

      <DashboardLayoutCard />
    </div>
  );
}

/** Settings > Appearance > Dashboard Layout (2026-07-17 user request) - lets each officer hide and
 * set the density of the 4 stat cards at the top of the Dashboard.
 *
 * 2026-07-23: reordering moved to drag-and-drop directly on the cards themselves (Dashboard's
 * `DraggableStatCard`) - the up/down-arrow buttons that used to live here are gone, since dragging
 * the card in place is the more direct interaction. `moveCard` stays on the provider (still used by
 * `resetLayout`'s consumers indirectly through `cards`/`reorderCards`), only this settings UI
 * dropped the buttons. */
function DashboardLayoutCard() {
  const { cards, density, toggleCardVisibility, setDensity, resetLayout } = useDashboardLayout();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <div>
          <CardTitle>Dashboard Layout</CardTitle>
          <CardDescription>
            Show/hide the stat cards at the top of your Dashboard and pick a density. Drag a card by its handle on the Dashboard itself to
            reorder. Your personal preference only.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Compact Density</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Currently: <Badge variant="outline">{density === 'compact' ? 'Compact' : 'Comfortable'}</Badge>
            </div>
          </div>
          <Switch
            checked={density === 'compact'}
            onCheckedChange={(checked) => setDensity(checked ? 'compact' : 'comfortable')}
            aria-label="Toggle compact density"
          />
        </div>

        <div className="divide-y rounded-md border">
          {cards.map((card) => (
            <div key={card.id} className={cn('flex items-center justify-between gap-3 p-3', !card.visible && 'opacity-50')}>
              <span className="text-sm font-medium">{DASHBOARD_CARD_LABELS[card.id as DashboardCardId]}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => toggleCardVisibility(card.id)}
                  aria-label={card.visible ? `Hide ${DASHBOARD_CARD_LABELS[card.id as DashboardCardId]}` : `Show ${DASHBOARD_CARD_LABELS[card.id as DashboardCardId]}`}
                >
                  {card.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={resetLayout}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to Default
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Settings > Notifications (2026-07-17 user request) - per-type mute toggles for the Topbar bell
 * (`NotificationBell.tsx`). Muting only hides a type from this device/account's badge/dropdown -
 * the notifications still exist server-side (`GET /notifications`), so unmuting later shows the
 * backlog again. Personal, per-user, localStorage-only, same as every other Appearance preference.
 */
function NotificationsTab() {
  const { currentAccount } = useRole();
  const [mutedTypes, setMutedTypes] = React.useState<NotificationType[]>(() => readMutedTypes(currentAccount.id));

  const toggleType = (type: NotificationType) => {
    setMutedTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      writeMutedTypes(currentAccount.id, next);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Bell className="h-4 w-4 text-primary" />
        <div>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose which notifications show up in your bell icon. Muted types are still recorded - turning one back on shows its
            backlog again. Applies only to your account.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="divide-y rounded-md border">
        {NOTIFICATION_TYPE_OPTIONS.map((option) => (
          <div key={option.value} className="flex items-center justify-between gap-3 p-3">
            <span className="text-sm font-medium">{option.label}</span>
            <Switch
              checked={!mutedTypes.includes(option.value)}
              onCheckedChange={() => toggleType(option.value)}
              aria-label={`Toggle ${option.label}`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

