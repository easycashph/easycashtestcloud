import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { PortalHeader } from '@/components/PortalHeader';
import { LoanApplicationDetailView } from '@/components/LoanApplicationDetailView';
import { PortalLoanAccountsSection } from '@/components/PortalLoanAccountsSection';
import { PortalNextPaymentDueCard } from '@/components/PortalNextPaymentDueCard';
import { PortalSignDocumentsCard } from '@/components/PortalSignDocumentsCard';
import { PortalOfficialBankAccountCard } from '@/components/PortalOfficialBankAccountCard';
import { PortalPaymentProofCard } from '@/components/PortalPaymentProofCard';
import { PortalRecentPaymentsSection } from '@/components/PortalRecentPaymentsSection';
import { PortalLoanOfficerCard } from '@/components/PortalLoanOfficerCard';
import { PortalTwoFactorNudgeCard } from '@/components/PortalTwoFactorNudgeCard';
import { useAuth } from '@/lib/authContext';
import { usePortalDialogs } from '@/lib/portalDialogContext';
import { apiClient } from '@/lib/apiClient';
import { DISBURSEMENT_METHOD } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { PortalLoanApplicationDetail, PortalLoanApplicationSummary, PortalLoanApplicationTimelineEntry } from '@/lib/portalApiTypes';
import { getLoanProductDisplayLabel } from '@/lib/loanProducts';

const STATUS_TONE: Record<PortalLoanApplicationSummary['status'], string> = {
  INCOMPLETE: 'bg-amber-100 text-amber-900',
  PREAPPROVED: 'bg-primary/10 text-primary',
  PREDECLINED: 'bg-muted text-muted-foreground',
  UNDER_REVIEW: 'bg-amber-100 text-amber-900',
  PRE_APPROVAL: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-success/10 text-success',
  DECLINED: 'bg-destructive/10 text-destructive',
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/** Mirrors the backend's one-application-per-portal-account rule (CreateLoanApplicationUseCase,
 * 2026-07-24) - only editable while no human/system decision has moved it past the initial
 * system-computed verdict. */
const EDITABLE_STATUSES = new Set<PortalLoanApplicationSummary['status']>(['PREAPPROVED', 'PREDECLINED']);

/** Mirrors the shape of one rendered application row (title bar, subtitle bar, status pill) so the
 * loading state reads as "your applications are coming" rather than an unexplained blank pause. */
function ApplicationsListSkeleton() {
  return (
    <div className="mt-4 divide-y divide-border">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ApplicationDetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/** 2026-07-31 (user request, "top reputable lending site" checklist) - a real status timeline,
 * built only from actual recorded events (see backend's
 * GetPortalLoanApplicationStatusTimelineUseCase). Renders nothing while still loading (`null`) so
 * it never flashes an empty state before the fetch resolves. */
function StatusTimeline({ entries }: { entries: PortalLoanApplicationTimelineEntry[] | null }) {
  const { t } = useLanguage();
  if (!entries || entries.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">{t.dashboard.statusTimeline}</h3>
      <ol className="mt-3 space-y-3">
        {entries.map((entry, index) => (
          <li key={`${entry.label}-${entry.occurredAt}`} className="flex items-start gap-3">
            <div className="mt-1 flex flex-col items-center">
              <span className={`h-2.5 w-2.5 rounded-full ${index === entries.length - 1 ? 'bg-primary' : 'bg-primary/40'}`} />
              {index < entries.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-border" />}
            </div>
            <div className="pb-1">
              <p className="text-sm font-medium">{entry.label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.occurredAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Phase 2 (2026-07-23): "Create Loan Application" now routes to the real form, and this page
 * shows the client's own submitted applications and their current status. */
export function DashboardPage() {
  const { account } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { openApplicationDialog } = usePortalDialogs();
  const [applications, setApplications] = React.useState<PortalLoanApplicationSummary[] | null>(null);
  const [viewingApplicationId, setViewingApplicationId] = React.useState<string | null>(null);
  const [viewingDetail, setViewingDetail] = React.useState<PortalLoanApplicationDetail | null>(null);
  const [viewingTimeline, setViewingTimeline] = React.useState<PortalLoanApplicationTimelineEntry[] | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient
      .get<PortalLoanApplicationSummary[]>('/portal/loan-applications')
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  const hasPendingApplication = (applications ?? []).some((application) => application.status !== 'DECLINED');

  const openApplicationDetail = (applicationId: string) => {
    setViewingApplicationId(applicationId);
    setViewingDetail(null);
    setViewingTimeline(null);
    setDetailError(null);
    setIsLoadingDetail(true);
    apiClient
      .get<PortalLoanApplicationDetail>(`/portal/loan-applications/${applicationId}`)
      .then(setViewingDetail)
      .catch(() => setDetailError(t.dashboard.detailLoadError))
      .finally(() => setIsLoadingDetail(false));
    apiClient
      .get<PortalLoanApplicationTimelineEntry[]>(`/portal/loan-applications/${applicationId}/status-timeline`)
      .then(setViewingTimeline)
      .catch(() => setViewingTimeline([]));
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />

      <main className="container py-10">
        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <h1 className="text-2xl font-bold tracking-tight">
            {t.dashboard.welcomeBack}
            {account ? `, ${account.email}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
        </motion.div>

        {/* 2026-08-14 (user request): compact 2-per-row grid for the short "fact" cards - each
            manages its own conditional rendering (returns null when it has nothing to show), and
            CSS grid simply reflows around whichever ones are actually present. The two list/table
            widgets below (My Loans, Recent Payments) stay full-width - they hold multi-column rows
            and per-row action buttons that would cramp badly at half width. */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <PortalSignDocumentsCard />
          <PortalTwoFactorNudgeCard />
          <PortalNextPaymentDueCard />
          <PortalOfficialBankAccountCard />
          <PortalPaymentProofCard />
          <PortalLoanOfficerCard />

          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <Card className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold">{t.dashboard.loanApplicationCardTitle}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {hasPendingApplication ? t.dashboard.loanApplicationPending : t.dashboard.loanApplicationCta}
              </p>
              <Button
                className="mt-4"
                onClick={() => navigate('/apply')}
                disabled={hasPendingApplication}
                title={hasPendingApplication ? t.dashboard.pendingApplicationTitle : undefined}
              >
                {t.dashboard.createApplication}
              </Button>
              {/* 2026-08-14 (user request, anti-scam) - same disclosure as the public landing page:
                  a client should know approved loans are only ever released via DISBURSEMENT_METHOD. */}
              <p className="mt-3 text-xs text-muted-foreground">{t.dashboard.disbursementNote.replace('{method}', DISBURSEMENT_METHOD)}</p>
            </Card>
          </motion.div>
        </div>

        <div className="mt-5 space-y-5">
          <PortalLoanAccountsSection />
          <PortalRecentPaymentsSection />
        </div>

        <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <Card className="mt-5 p-6">
          <h2 className="text-base font-semibold">{t.dashboard.myApplications}</h2>
          {applications === null ? (
            <ApplicationsListSkeleton />
          ) : applications.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t.dashboard.noApplicationsYet}</p>
          ) : (
            <motion.div initial="hidden" animate="show" variants={stagger} className="mt-4 divide-y divide-border">
              {applications.map((application) => (
                <motion.div
                  key={application.id}
                  variants={fadeUp}
                  role="button"
                  tabIndex={0}
                  onClick={() => openApplicationDetail(application.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openApplicationDetail(application.id);
                    }
                  }}
                  className="flex w-full cursor-pointer flex-col gap-3 py-3 text-left transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {getLoanProductDisplayLabel(application.requestedCategory)} - ₱{application.requestedAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.dashboard.submitted} {new Date(application.createdAt).toLocaleDateString()} - {application.requestedTermMonths}{' '}
                      {t.dashboard.months}
                    </p>
                    <p className="mt-1.5 max-w-md text-xs text-muted-foreground">{t.dashboard.statusNextSteps[application.status]}</p>
                    {!application.documentsComplete && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
                        {t.dashboard.documentsNeeded}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {EDITABLE_STATUSES.has(application.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openApplicationDialog(application.id);
                        }}
                      >
                        {t.dashboard.edit}
                      </Button>
                    )}
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[application.status]}`}>
                      {t.dashboard.statusLabels[application.status]}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </Card>
        </motion.div>
      </main>

      <Dialog open={viewingApplicationId !== null} onClose={() => setViewingApplicationId(null)} title="Loan Application">
        {isLoadingDetail && <ApplicationDetailSkeleton />}
        {detailError && <p className="text-sm text-destructive">{detailError}</p>}
        {viewingDetail && (
          <div className="space-y-5">
            <StatusTimeline entries={viewingTimeline} />
            <LoanApplicationDetailView detail={viewingDetail} />
          </div>
        )}
      </Dialog>
    </div>
  );
}
