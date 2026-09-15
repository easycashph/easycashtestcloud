import * as React from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { usePortalDialogs } from '@/lib/portalDialogContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const SecurityForm = React.lazy(() => import('@/pages/SecurityPage').then((m) => ({ default: m.SecurityForm })));
const LoanApplicationFormPage = React.lazy(() => import('@/pages/LoanApplicationFormPage').then((m) => ({ default: m.LoanApplicationFormPage })));

/** 2026-07-31 (user request): the single place that actually renders the "Security"/"Edit Loan
 * Application" Dialog - mounted once near the app root (see App.tsx) so it can be opened from
 * anywhere via `usePortalDialogs()`, regardless of which page is currently showing underneath.
 *
 * 2026-09-14 (user request: "Do NOT use a pop-up/modal for My Profile") - the `profile` dialog
 * that used to render here is gone; My Profile is the real `/profile` route now. */
export function PortalDialogHost() {
  const { dialog, closeDialog } = usePortalDialogs();
  const { t } = useLanguage();

  return (
    <>
      <Dialog open={dialog?.type === 'security'} onClose={closeDialog} title={t.security.pageTitle}>
        <React.Suspense fallback={<DialogLoading />}>{dialog?.type === 'security' && <SecurityForm />}</React.Suspense>
      </Dialog>
      <Dialog open={dialog?.type === 'application'} onClose={closeDialog} title={t.common.editLoanApplication}>
        <React.Suspense fallback={<DialogLoading />}>
          {dialog?.type === 'application' && <LoanApplicationFormPage embeddedEditId={dialog.id} onEmbeddedClose={closeDialog} />}
        </React.Suspense>
      </Dialog>
    </>
  );
}

function DialogLoading() {
  const { t } = useLanguage();
  return <p className="py-8 text-center text-sm text-muted-foreground">{t.common.loading}</p>;
}
