import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LOAN_PRODUCTS, localizedProductText } from '@/lib/loanProducts';
import type { PortalLoanApplicationSummary } from '@/lib/portalApiTypes';

/** Lets a logged-in client browse loan products before applying - "Apply Now" on a card jumps
 * straight to the application form with that product pre-selected (see LoanApplicationFormPage's
 * `?category=` query param handling). "Apply Now" follows the same one-application-per-account
 * gate as the Dashboard's "Create Loan Application" button (mirrors the backend's
 * CreateLoanApplicationUseCase rule). */
export function LoanProductsPage() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const [applications, setApplications] = React.useState<PortalLoanApplicationSummary[] | null>(null);

  React.useEffect(() => {
    apiClient
      .get<PortalLoanApplicationSummary[]>('/portal/loan-applications')
      .then(setApplications)
      .catch(() => setApplications([]));
  }, []);

  const hasPendingApplication = (applications ?? []).some((application) => application.status !== 'DECLINED');

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t.loanProductsPage.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.loanProductsPage.intro}</p>
      {hasPendingApplication && (
        <p className="mt-2 text-sm text-muted-foreground">{t.loanProductsPage.pendingApplicationNote}</p>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {LOAN_PRODUCTS.map((product) => (
          <Card key={product.category} className="flex flex-col p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <product.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold">{product.displayLabel}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{localizedProductText(product.blurb, locale)}</p>
            <p className="mt-2 text-xs text-muted-foreground">{localizedProductText(product.details, locale)}</p>
            <div className="mt-5 flex items-center gap-3">
              <Button
                disabled={hasPendingApplication}
                title={hasPendingApplication ? t.loanProductsPage.pendingApplicationTitle : undefined}
                onClick={() => navigate(`/apply?category=${encodeURIComponent(product.category)}`)}
              >
                {t.loanProductsPage.applyNow}
              </Button>
              <Link to="/requirements" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                {t.loanProductsPage.seeRequirements}
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
