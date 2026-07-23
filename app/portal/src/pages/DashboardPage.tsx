import { FileText, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/authContext';

/** Phase 1 (2026-07-23): UI shell only - "Create Loan Application" is disabled until Phase 2 wires
 * it to the backend (submitting an application from the portal, linking it back to this
 * PortalAccount). Everything else here (account info, logout) is fully real. */
export function DashboardPage() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="./logo-easycash.png" alt="Easycash" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-base font-bold tracking-tight">Easycash Portal</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Log Out
          </Button>
        </div>
      </header>

      <main className="container py-10">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back{account ? `, ${account.email}` : ''}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's your Easycash account.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Card className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold">Loan Application</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Apply for a new loan, or check the status of one you already submitted.</p>
            <Button className="mt-4" disabled title="Coming soon">
              Create Loan Application
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">Coming soon.</p>
          </Card>

          <Card className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold">My Profile</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Email: {account?.email}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {account?.borrowerId ? 'Linked to an existing client profile.' : 'Not yet linked to a client profile.'}
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}
