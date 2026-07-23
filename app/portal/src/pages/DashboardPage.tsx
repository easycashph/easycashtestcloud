import * as React from 'react';
import { FileText, ShoppingBag, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PortalHeader } from '@/components/PortalHeader';
import { useAuth } from '@/lib/authContext';
import { apiClient } from '@/lib/apiClient';
import type { PortalLoanApplicationSummary } from '@/lib/portalApiTypes';

const STATUS_LABELS: Record<PortalLoanApplicationSummary['status'], string> = {
  PREAPPROVED: 'Pre-approved',
  PREDECLINED: 'Pre-declined',
  UNDER_REVIEW: 'Under review',
  PRE_APPROVAL: 'Pre-approval',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
};

const STATUS_TONE: Record<PortalLoanApplicationSummary['status'], string> = {
  PREAPPROVED: 'bg-primary/10 text-primary',
  PREDECLINED: 'bg-muted text-muted-foreground',
  UNDER_REVIEW: 'bg-amber-100 text-amber-900',
  PRE_APPROVAL: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-success/10 text-success',
  DECLINED: 'bg-destructive/10 text-destructive',
};

/** Phase 2 (2026-07-23): "Create Loan Application" now routes to the real form, and this page
 * shows the client's own submitted applications and their current status. */
export function DashboardPage() {
  const { account } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = React.useState<PortalLoanApplicationSummary[] | null>(null);

  React.useEffect(() => {
    apiClient
      .get<PortalLoanApplicationSummary[]>('/portal/loan-applications')
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />

      <main className="container py-10">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back{account ? `, ${account.email}` : ''}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's your Easycash account.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <Card className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold">Loan Products</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Browse our loan products and find the one that fits your needs.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/products')}>
              Browse Products
            </Button>
          </Card>

          <Card className="p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold">Loan Application</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Apply for a new loan, or check the status of one you already submitted.</p>
            <Button className="mt-4" onClick={() => navigate('/apply')}>
              Create Loan Application
            </Button>
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

        <Card className="mt-5 p-6">
          <h2 className="text-base font-semibold">My Applications</h2>
          {applications === null ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
          ) : applications.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">You haven't submitted a loan application yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {applications.map((application) => (
                <div key={application.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {application.requestedCategory} - ₱{application.requestedAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(application.createdAt).toLocaleDateString()} - {application.requestedTermMonths} months
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[application.status]}`}>
                    {STATUS_LABELS[application.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
