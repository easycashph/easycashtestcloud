import { Check, Lock, Moon, Palette, Sun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ACCENT_OPTIONS, useTheme, type Accent } from '@/components/theme-provider';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { logActivity, MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { cn } from '@/lib/utils';

/**
 * LMS Configuration — MIS-only settings for the platform's appearance:
 * theme color (accent presets) and light/dark mode. Preferences are stored
 * locally in this preview build (no backend); a real implementation would
 * persist them per user via the identity module.
 */
export function LmsConfigurationPage() {
  useLogPageView('LMS Configuration');
  const { canManageLmsConfiguration, currentAccount } = useRole();
  const { theme, toggleTheme, accent, setAccent } = useTheme();

  if (!canManageLmsConfiguration) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">LMS Configuration</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Restricted to MIS accounts</p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const applyAccent = (next: Accent) => {
    if (next === accent) return;
    setAccent(next);
    logActivity({
      userName: currentAccount.name,
      action: 'CHANGE_THEME_COLOR',
      entityType: 'LMS Configuration',
      entityId: next,
      at: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">LMS Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Platform appearance settings — MIS only. Stored locally in this preview build; a real implementation would persist
          preferences via the backend.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Palette className="h-4 w-4 text-primary" />
          <div>
            <CardTitle>Theme Color</CardTitle>
            <CardDescription>
              Changes the primary color across the whole LMS — buttons, active section tabs, links, and the primary chart series —
              in both light and dark mode.
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
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border"
                  style={{ background: option.swatch }}
                >
                  {accent === option.value && <Check className="h-5 w-5 text-white" />}
                </span>
                <span className="text-xs font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          {theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          <div>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Light or dark mode — the sidebar and every surface follow the selected theme.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Dark Mode</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Currently: <Badge variant="outline">{theme === 'dark' ? 'Dark' : 'Light'}</Badge>
            </div>
          </div>
          <Switch checked={theme === 'dark'} onCheckedChange={() => toggleTheme()} aria-label="Toggle dark mode" />
        </CardContent>
      </Card>

      <RecentActivityPanel
        entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'LMS Configuration')}
        title="Recent Activity — LMS Configuration"
      />
    </div>
  );
}
