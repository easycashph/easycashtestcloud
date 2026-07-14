import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Globe, KeyRound, Moon, Palette, Sun, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComingSoonButton } from '@/components/ComingSoonButton';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ACCENT_OPTIONS, useTheme, type Accent } from '@/components/theme-provider';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useLanguage } from '@/lib/languageContext';
import type { Language } from '@/lib/translations';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { AuthenticatedUserView } from '@/lib/authTypes';
import type { UpdateOwnProfileRequest } from '@/lib/userApiTypes';
import { cn } from '@/lib/utils';

/** Cross-referenced against `app/backend/src/modules/identity/domain/PasswordPolicy.ts`'s real
 * `MIN_LENGTH` so the two don't silently drift. */
const PASSWORD_MIN_LENGTH = 12;

type SettingsTab = 'profile' | 'security' | 'appearance' | 'language';

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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="profile">{t('settings.tab.profile')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.tab.security')}</TabsTrigger>
          <TabsTrigger value="appearance">{t('settings.tab.appearance')}</TabsTrigger>
          <TabsTrigger value="language">{t('settings.tab.language')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'profile' && <UserProfileTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'appearance' && <AppearanceTab />}
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
  const [address, setAddress] = React.useState('');
  const [birthday, setBirthday] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!me) return;
    setFirstName(me.firstName);
    setLastName(me.lastName);
    setContactNumber(me.contactNumber ?? '');
    setAddress(me.address ?? '');
    setBirthday(me.birthday ? me.birthday.slice(0, 10) : '');
  }, [me]);

  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

  const saveMutation = useMutation({
    mutationFn: () => {
      const body: UpdateOwnProfileRequest = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        contactNumber: contactNumber.trim() || null,
        address: address.trim() || null,
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
          <form className="grid max-w-md gap-4" onSubmit={handleSave}>
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
              <Input id="profile-contact" type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="09XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-address">Address</Label>
              <Input id="profile-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-birthday">Birthday</Label>
              <Input id="profile-birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
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
              <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
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
    </div>
  );
}

function AppearanceTab() {
  const { theme, toggleTheme, accent, setAccent } = useTheme();

  const handleToggle = () => {
    toggleTheme();
  };

  const applyAccent = (next: Accent) => {
    if (next === accent) return;
    setAccent(next);
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
