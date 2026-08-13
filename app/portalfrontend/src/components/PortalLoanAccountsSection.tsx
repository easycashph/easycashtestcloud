import * as React from 'react';
import { Landmark, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient, downloadFile } from '@/lib/apiClient';
import { previewLoanSchedule, type SchedulePreviewResult } from '@/lib/loanSchedulePreview';
import type { PortalInstallmentEntry, PortalLoanAccountSummary, PortalStatementOfAccountEntry } from '@/lib/portalApiTypes';

function peso(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value;
}

const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Not yet due',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  LATE: 'Overdue',
};

const INSTALLMENT_STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-secondary text-secondary-foreground',
  PARTIALLY_PAID: 'bg-warning/15 text-warning',
  PAID: 'bg-success/15 text-success',
  LATE: 'bg-destructive/15 text-destructive',
};

/** 2026-08-06 (user request) - mirrors app/lmsfrontend's own LoanAccountStatus labels/tones (see
 * its StatusBadge component) so "Active"/"Closed" reads the same way to a client here as it does
 * to staff internally. Every value of the backend's LoanAccountStatus enum is covered so an
 * unrecognized future status still renders as its raw string rather than disappearing silently. */
const LOAN_ACCOUNT_STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  ACTIVE_IN_ARREARS: 'Active (Past Due)',
  CLOSED: 'Closed',
  CLOSED_WRITTEN_OFF: 'Closed (Written Off)',
  CLOSED_REJECTED: 'Closed (Rejected)',
  CLOSED_RESTRUCTURED: 'Closed (Restructured)',
  CLOSED_ADJUSTED: 'Closed (Adjusted)',
};

const LOAN_ACCOUNT_STATUS_TONE: Record<string, string> = {
  PENDING_APPROVAL: 'bg-secondary text-secondary-foreground',
  APPROVED: 'bg-secondary text-secondary-foreground',
  ACTIVE: 'bg-success/15 text-success',
  ACTIVE_IN_ARREARS: 'bg-destructive/15 text-destructive',
  CLOSED: 'bg-secondary text-secondary-foreground',
  CLOSED_WRITTEN_OFF: 'bg-secondary text-secondary-foreground',
  CLOSED_REJECTED: 'bg-secondary text-secondary-foreground',
  CLOSED_RESTRUCTURED: 'bg-secondary text-secondary-foreground',
  CLOSED_ADJUSTED: 'bg-secondary text-secondary-foreground',
};

function LoanAccountStatusBadge({ status }: { status: string }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${LOAN_ACCOUNT_STATUS_TONE[status] ?? 'bg-secondary text-secondary-foreground'}`}>
      {LOAN_ACCOUNT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** "Total Outstanding Balance" summary (2026-08-06 user request) - sum of `outstandingBalance`
 * across every currently-open (ACTIVE/ACTIVE_IN_ARREARS) loan account, so a client with more than
 * one loan sees their overall exposure at a glance instead of adding up each card themselves.
 * Closed loans are excluded on purpose - their balance should already be zero, but this makes that
 * assumption explicit rather than silently relying on it. */
const OPEN_LOAN_ACCOUNT_STATUSES = new Set(['ACTIVE', 'ACTIVE_IN_ARREARS']);

/** 2026-08-14 (user request) - before Activation/Disbursement there is no real balance or
 * generated schedule yet (the real AmortizationScheduleGenerator only runs at Activate time, same
 * as the LMS's own `notYetActivated` convention on LoanDetailPage) - so Statement of Account and
 * Payoff Amount, which both read post-disbursement balances, are disabled until then. */
const NOT_YET_DISBURSED_STATUSES = new Set(['PENDING_APPROVAL', 'APPROVED']);

function totalOutstanding(loanAccounts: PortalLoanAccountSummary[]): number {
  return loanAccounts
    .filter((loanAccount) => OPEN_LOAN_ACCOUNT_STATUSES.has(loanAccount.status))
    .reduce((sum, loanAccount) => sum + Number(loanAccount.outstandingBalance), 0);
}

/** 2026-08-14 (user request) - mirrors the LMS's own `showSchedulePreview`/`previewLoanSchedule`
 * convention on LoanDetailPage: before Activation there are no persisted RepaymentInstallment
 * rows, so a not-yet-disbursed loan gets a clearly-labeled, client-side computed preview instead
 * of "No installment schedule found for this loan." (which reads like a data error, not the
 * expected pre-disbursement state). */
function InstallmentScheduleDialog({ loanAccount, onClose }: { loanAccount: PortalLoanAccountSummary | null; onClose: () => void }) {
  const [installments, setInstallments] = React.useState<PortalInstallmentEntry[] | null>(null);

  React.useEffect(() => {
    if (!loanAccount) return;
    setInstallments(null);
    apiClient
      .get<PortalInstallmentEntry[]>(`/portal/loan-accounts/${loanAccount.id}/installments`)
      .then(setInstallments)
      .catch(() => setInstallments([]));
  }, [loanAccount]);

  const showPreview = loanAccount !== null && installments !== null && installments.length === 0 && NOT_YET_DISBURSED_STATUSES.has(loanAccount.status);
  const preview: SchedulePreviewResult | null = showPreview
    ? previewLoanSchedule(
        Number.parseFloat(loanAccount!.principalAmount) || 0,
        Number.parseFloat(loanAccount!.contractualInterestRate ?? '0') || 0,
        loanAccount!.installmentCount,
        new Date(loanAccount!.firstRepaymentDate),
      )
    : null;

  const title = loanAccount ? `${showPreview ? 'Repayment Schedule Preview' : 'Payment Schedule'} - ${loanAccount.loanCode}` : 'Payment Schedule';

  return (
    <Dialog open={loanAccount !== null} onClose={onClose} title={title}>
      {installments === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : showPreview ? (
        preview ? (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              Preview only - this loan hasn&apos;t been disbursed yet, so this schedule hasn&apos;t been generated. It&apos;s computed
              from the current Principal, Interest Rate, and Term, and may still change before disbursement.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Due Date</th>
                    <th className="py-2 pr-3 font-medium">Principal</th>
                    <th className="py-2 pr-3 font-medium">Interest</th>
                    <th className="py-2 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.schedule.map((entry) => (
                    <tr key={entry.installmentNumber} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">{entry.installmentNumber}</td>
                      <td className="py-2 pr-3">{entry.dueDate.toLocaleDateString()}</td>
                      <td className="py-2 pr-3">{peso(entry.principalPortion.toString())}</td>
                      <td className="py-2 pr-3">{peso(entry.interestPortion.toString())}</td>
                      <td className="py-2">{peso(entry.payment.toString())}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">A schedule preview isn&apos;t available for this loan yet.</p>
        )
      ) : installments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No installment schedule found for this loan.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">Due Date</th>
                  <th className="py-2 pr-3 font-medium">Amount Due</th>
                  <th className="py-2 pr-3 font-medium">Paid</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((installment) => (
                  <tr key={installment.installmentNumber} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3">{installment.installmentNumber}</td>
                    <td className="py-2 pr-3">{new Date(installment.dueDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3">{peso(installment.totalDue)}</td>
                    <td className="py-2 pr-3">{peso(installment.totalPaid)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${INSTALLMENT_STATUS_TONE[installment.status] ?? 'bg-secondary'}`}>
                        {INSTALLMENT_STATUS_LABELS[installment.status] ?? installment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Browser-native print (Ctrl/Cmd+P -> Save as PDF) - a real, always-accurate way to get a
              downloadable copy without generating/storing a separate PDF that could drift from the
              live schedule above. */}
          <Button type="button" variant="outline" className="mt-4" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </>
      )}
    </Dialog>
  );
}

/**
 * "My Statement of Account" dialog (2026-08-06 user request) - view/download only, no generate
 * option: an SOA's fee/date parameters are staff-set, not something a client should self-serve.
 */
function StatementsOfAccountDialog({ loanAccount, onClose }: { loanAccount: PortalLoanAccountSummary | null; onClose: () => void }) {
  const [statements, setStatements] = React.useState<PortalStatementOfAccountEntry[] | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!loanAccount) return;
    setStatements(null);
    setDownloadError(null);
    apiClient
      .get<PortalStatementOfAccountEntry[]>(`/portal/loan-accounts/${loanAccount.id}/statements-of-account`)
      .then(setStatements)
      .catch(() => setStatements([]));
  }, [loanAccount]);

  const handleDownload = async (statement: PortalStatementOfAccountEntry) => {
    if (!loanAccount) return;
    setDownloadingId(statement.id);
    setDownloadError(null);
    try {
      await downloadFile(
        `/portal/loan-accounts/${loanAccount.id}/statements-of-account/${statement.id}/download`,
        `Statement of Account - ${statement.soaNumber}.pdf`,
      );
    } catch {
      setDownloadError('Could not download this statement. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={loanAccount !== null} onClose={onClose} title={loanAccount ? `Statement of Account - ${loanAccount.loanCode}` : 'Statement of Account'}>
      {statements === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : statements.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Statement of Account has been generated for this loan yet - ask your loan officer to generate one.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {downloadError && <p className="pb-3 text-sm text-destructive">{downloadError}</p>}
          {statements.map((statement) => (
            <div key={statement.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">SOA #{statement.soaNumber}</p>
                <p className="text-xs text-muted-foreground">
                  Generated {new Date(statement.generatedAt).toLocaleDateString()} - Total amount due: {peso(statement.totalAmountDue)}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={downloadingId === statement.id} onClick={() => handleDownload(statement)}>
                {downloadingId === statement.id ? 'Downloading…' : 'Download'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}

/**
 * "Payoff Amount" dialog (2026-08-06 user request) - how much the client would need to pay TODAY
 * to fully close this loan. Deliberately just `outstandingBalance` (the system's own definition of
 * "settled" - see `LoanAccount.isFullyPaid`) broken into its four components, with an explicit
 * caveat that it may not include interest still accruing since the last posted transaction - NOT a
 * full recalculation like the staff-only Statement of Account generator, which needs judgment-call
 * inputs (collection/other fee, penalty date range) with no honest client-facing default. Showing
 * a client a more "precise-looking" number that quietly bakes in unconfirmed assumptions would be
 * worse than being upfront about what this figure does and doesn't include.
 */
function PayoffAmountDialog({ loanAccount, onClose }: { loanAccount: PortalLoanAccountSummary | null; onClose: () => void }) {
  return (
    <Dialog open={loanAccount !== null} onClose={onClose} title={loanAccount ? `Payoff Amount - ${loanAccount.loanCode}` : 'Payoff Amount'}>
      {loanAccount && (
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground">Pay this amount today to fully close this loan</p>
            <p className="mt-1 text-2xl font-bold text-primary">{peso(loanAccount.outstandingBalance)}</p>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Principal</dt>
              <dd>{peso(loanAccount.principalBalance)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Interest</dt>
              <dd>{peso(loanAccount.interestBalance)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Fees</dt>
              <dd>{peso(loanAccount.feesBalance)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Penalty</dt>
              <dd>{peso(loanAccount.penaltyBalance)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            As of your last posted transaction - may not include interest still accruing since then. Confirm the exact amount with your loan
            officer before paying.
          </p>
        </div>
      )}
    </Dialog>
  );
}

/** "My Loans" section on the Portal dashboard (2026-07-31 user request, "top reputable lending
 * site" checklist) - payment history and a printable amortization schedule for a client's real,
 * booked loan account(s). Renders nothing at all once loaded if the account has none yet (still
 * pre-approval/under review, or not yet linked) - never a placeholder/empty-state card implying a
 * loan exists. */
export function PortalLoanAccountsSection() {
  const [loanAccounts, setLoanAccounts] = React.useState<PortalLoanAccountSummary[] | null>(null);
  const [viewingLoanAccount, setViewingLoanAccount] = React.useState<PortalLoanAccountSummary | null>(null);
  const [viewingStatementsFor, setViewingStatementsFor] = React.useState<PortalLoanAccountSummary | null>(null);
  const [viewingPayoffFor, setViewingPayoffFor] = React.useState<PortalLoanAccountSummary | null>(null);

  React.useEffect(() => {
    apiClient
      .get<PortalLoanAccountSummary[]>('/portal/loan-accounts')
      .then(setLoanAccounts)
      .catch(() => setLoanAccounts([]));
  }, []);

  if (loanAccounts !== null && loanAccounts.length === 0) return null;

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold">My Loans</h2>
          {loanAccounts !== null && loanAccounts.some((l) => OPEN_LOAN_ACCOUNT_STATUSES.has(l.status)) && (
            <p className="text-sm text-muted-foreground">
              Total outstanding: <span className="font-semibold text-foreground">{peso(totalOutstanding(loanAccounts).toString())}</span>
            </p>
          )}
        </div>
        {loanAccounts === null ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {loanAccounts.map((loanAccount) => (
              <div key={loanAccount.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{loanAccount.loanCode}</p>
                      <LoanAccountStatusBadge status={loanAccount.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Outstanding balance: {peso(loanAccount.outstandingBalance)} of {peso(loanAccount.principalAmount)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setViewingLoanAccount(loanAccount)}>
                    View Payment Schedule
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={NOT_YET_DISBURSED_STATUSES.has(loanAccount.status)}
                    title={NOT_YET_DISBURSED_STATUSES.has(loanAccount.status) ? 'Available once this loan has been disbursed' : undefined}
                    onClick={() => setViewingStatementsFor(loanAccount)}
                  >
                    Statement of Account
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={NOT_YET_DISBURSED_STATUSES.has(loanAccount.status)}
                    title={NOT_YET_DISBURSED_STATUSES.has(loanAccount.status) ? 'Available once this loan has been disbursed' : undefined}
                    onClick={() => setViewingPayoffFor(loanAccount)}
                  >
                    Payoff Amount
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <InstallmentScheduleDialog loanAccount={viewingLoanAccount} onClose={() => setViewingLoanAccount(null)} />
      <StatementsOfAccountDialog loanAccount={viewingStatementsFor} onClose={() => setViewingStatementsFor(null)} />
      <PayoffAmountDialog loanAccount={viewingPayoffFor} onClose={() => setViewingPayoffFor(null)} />
    </>
  );
}
