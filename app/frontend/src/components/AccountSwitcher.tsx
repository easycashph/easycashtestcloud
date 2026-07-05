import * as React from 'react';
import { Lock, LogIn, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SWITCHABLE_ACCOUNTS, useRole } from '@/lib/roleContext';

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Mock "Switch Account" panel — for the CEO demo: shows what changes in the
 * UI (Admin-only Add/Edit actions, etc.) when a different staff account is
 * "logged in". The username/password fields are decorative only; picking an
 * account card switches the session immediately, no credential check.
 */
export function AccountSwitcher() {
  const { currentAccount, switchAccount } = useRole();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        className="flex h-auto items-center gap-2 px-2 py-1"
        onClick={() => setOpen(true)}
      >
        <Avatar>
          <AvatarFallback>{initialsOf(currentAccount.name)}</AvatarFallback>
        </Avatar>
        <div className="hidden text-left text-xs leading-tight sm:block">
          <p className="font-medium">{currentAccount.name}</p>
          <p className="text-muted-foreground">{currentAccount.role}</p>
        </div>
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-4 w-4" /> Switch Account
          </DialogTitle>
          <DialogDescription>
            Preview only — pick a demo account below to see how access changes. No real login/authentication runs here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {SWITCHABLE_ACCOUNTS.map((account) => {
            const isCurrent = account.id === currentAccount.id;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => {
                  switchAccount(account.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                  isCurrent ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initialsOf(account.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">{account.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.role === 'MIS' && <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-label="Full super-user access" />}
                  <Badge variant={account.role === 'MIS' ? 'default' : 'outline'}>{account.role}</Badge>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Sign in with username &amp; password (disabled in preview)
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Username</Label>
            <Input disabled placeholder="Not required in preview" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input disabled type="password" placeholder="Not required in preview" />
          </div>
        </div>

        <DialogFooter>
          <p className="text-xs text-muted-foreground">
            MIS is super user (all access, including reverting a decided Loan Application). Loan Operation Manager and CRM can access
            Loan Applications (assign/approve/decline) but cannot revert a decision. Finance, Accounting, and Collection Officer share
            one restricted tier — try switching above to see it live.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
