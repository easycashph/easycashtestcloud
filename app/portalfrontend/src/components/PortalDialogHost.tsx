import * as React from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { usePortalDialogs } from '@/lib/portalDialogContext';

const ProfileForm = React.lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfileForm })));
const SecurityForm = React.lazy(() => import('@/pages/SecurityPage').then((m) => ({ default: m.SecurityForm })));
const LoanApplicationFormPage = React.lazy(() => import('@/pages/LoanApplicationFormPage').then((m) => ({ default: m.LoanApplicationFormPage })));

/** 2026-07-31 (user request): the single place that actually renders the "My Profile"/"Security"/
 * "Edit Loan Application" Dialog - mounted once near the app root (see App.tsx) so it can be
 * opened from anywhere (header nav, Dashboard's per-application Edit button) via
 * `usePortalDialogs()`, regardless of which page is currently showing underneath. */
export function PortalDialogHost() {
  const { dialog, closeDialog } = usePortalDialogs();

  return (
    <>
      <Dialog open={dialog?.type === 'profile'} onClose={closeDialog} title="My Profile">
        <React.Suspense fallback={<DialogLoading />}>{dialog?.type === 'profile' && <ProfileForm />}</React.Suspense>
      </Dialog>
      <Dialog open={dialog?.type === 'security'} onClose={closeDialog} title="Security">
        <React.Suspense fallback={<DialogLoading />}>{dialog?.type === 'security' && <SecurityForm />}</React.Suspense>
      </Dialog>
      <Dialog open={dialog?.type === 'application'} onClose={closeDialog} title="Edit Loan Application">
        <React.Suspense fallback={<DialogLoading />}>
          {dialog?.type === 'application' && <LoanApplicationFormPage embeddedEditId={dialog.id} onEmbeddedClose={closeDialog} />}
        </React.Suspense>
      </Dialog>
    </>
  );
}

function DialogLoading() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
}
