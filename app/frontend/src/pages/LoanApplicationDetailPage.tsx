import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, History, Lock, Paperclip, RotateCcw, Sparkles, UserPlus, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import {
  createClientFromApplication,
  findRepeatClientBorrower,
  getMockLoan,
  getMockLoanApplication,
  logActivity,
  MOCK_ACTIVITY_LOGS,
  MOCK_LOAN_PRODUCTS,
  type MockRiskLevel,
} from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

const RISK_BADGE_VARIANT: Record<MockRiskLevel, 'success' | 'warning' | 'destructive'> = {
  'Low Risk': 'success',
  'Medium Risk': 'warning',
  'High Risk': 'destructive',
};

/**
 * Approving/declining/reverting/creating-a-client here mutates the shared
 * `MOCK_LOAN_APPLICATIONS`/`MOCK_BORROWERS` mock records directly (in-memory
 * only, per this preview's "no real backend" scope) and forces a local
 * re-render via `forceRerender`. Nothing is sent anywhere; reloading the
 * page resets every decision back to its seeded state.
 *
 * Access is restricted to MIS, Loan Operation Manager, and CRM accounts.
 * CRM and Loan Operation Manager can approve/decline (behind a confirmation
 * dialog, as a safety net against an accidental click) but can never revert
 * a decision once made — only MIS can revert a decided application back to
 * Pending Review.
 */
export function LoanApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { canAccessLoanApplications, canRevertLoanApplicationDecision, currentAccount } = useRole();
  const [, forceRerender] = React.useState(0);
  const [decisionNote, setDecisionNote] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<'APPROVED' | 'DECLINED' | 'REVERT' | 'CREATE_CLIENT' | null>(null);

  useLogPageView('Loan Application Detail', applicationId);

  const application = applicationId ? getMockLoanApplication(applicationId) : undefined;

  React.useEffect(() => {
    if (application && application.reviewState === 'UNREVIEWED') {
      application.reviewState = 'REVIEWED';
      logActivity({
        userName: currentAccount.name,
        action: 'MARK_APPLICATION_REVIEWED',
        entityType: 'LoanApplication',
        entityId: application.id,
        at: new Date().toISOString(),
      });
      forceRerender((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id]);

  if (!canAccessLoanApplications) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Restricted to MIS, Loan Operation Manager, and CRM accounts</p>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{currentAccount.name}</span> ({currentAccount.role}).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Sample application not found: {applicationId}</p>
      </div>
    );
  }

  const availableSubTypes = MOCK_LOAN_PRODUCTS.filter((p) => p.isActive && p.category === application.requestedCategory);
  const repeatClientBorrower = findRepeatClientBorrower(application.applicantName);
  const previousLoans = repeatClientBorrower?.loanIds.map((id) => getMockLoan(id)).filter((l): l is NonNullable<typeof l> => Boolean(l)) ?? [];
  const initials = application.applicantName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const assignSubType = (productCode: string) => {
    application.assignedSubType = productCode;
    forceRerender((n) => n + 1);
  };

  const confirmDecision = (decision: 'APPROVED' | 'DECLINED') => {
    application.status = decision;
    application.reviewedBy = currentAccount.name;
    application.reviewedAt = new Date().toISOString();
    application.decisionNote = decisionNote.trim() || undefined;
    logActivity({
      userName: currentAccount.name,
      action: decision === 'APPROVED' ? 'APPROVE_LOAN_APPLICATION' : 'DECLINE_LOAN_APPLICATION',
      entityType: 'LoanApplication',
      entityId: application.id,
      at: application.reviewedAt,
    });
    setDecisionNote('');
    setConfirmAction(null);
    forceRerender((n) => n + 1);
  };

  const confirmRevert = () => {
    application.status = 'PENDING_REVIEW';
    application.reviewedBy = undefined;
    application.reviewedAt = undefined;
    application.decisionNote = undefined;
    logActivity({
      userName: currentAccount.name,
      action: 'REVERT_LOAN_APPLICATION_DECISION',
      entityType: 'LoanApplication',
      entityId: application.id,
      at: new Date().toISOString(),
    });
    setConfirmAction(null);
    forceRerender((n) => n + 1);
  };

  const confirmCreateClient = () => {
    const client = createClientFromApplication(application, currentAccount.name);
    setConfirmAction(null);
    navigate(`/clients/${client.id}`);
  };

  const isPending = application.status === 'PENDING_REVIEW';
  const applicationLogs = MOCK_ACTIVITY_LOGS.filter((l) => l.entityId === application.id);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={application.profilePictureUrl} alt={application.applicantName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{application.applicantName}</h2>
              <Badge
                variant={application.status === 'PENDING_REVIEW' ? 'warning' : application.status === 'APPROVED' ? 'success' : 'destructive'}
              >
                {application.status.replaceAll('_', ' ')}
              </Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {application.requestedCategory} · Submitted {formatDate(application.submittedAt)}
            </p>
          </div>
        </div>
      </div>

      {application.status === 'APPROVED' && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">
                {application.clientCreated ? 'Official client record created' : 'Ready to become an official client'}
              </p>
              <p className="text-xs text-muted-foreground">
                {application.clientCreated
                  ? 'Profile picture, personal/contact info, and attachments were copied to Client Details.'
                  : "Creates the official Client Details record from this application's info — profile picture, age, contact info, address, and attachments included. Does not create a loan account (that's a separate step on the client's profile)."}
              </p>
            </div>
            {application.clientCreated ? (
              <Button variant="outline" size="sm" onClick={() => navigate(`/clients/${application.createdClientId}`)}>
                View Client Profile
              </Button>
            ) : (
              <Button size="sm" onClick={() => setConfirmAction('CREATE_CLIENT')}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Create Client
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle>AI Risk Assessment</CardTitle>
          </div>
          <Badge variant={RISK_BADGE_VARIANT[application.aiRisk]}>{application.aiRisk}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{application.aiRecommendation}</p>
          <ul className="space-y-1.5">
            {application.aiFactors.map((factor) => (
              <li key={factor.label} className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm">
                <div className="flex items-start gap-2">
                  {factor.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span className="font-medium">{factor.label}</span>
                </div>
                <span className="text-right text-muted-foreground">{factor.value}</span>
              </li>
            ))}
          </ul>
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary">
            AI-Assisted — final approve/decline decision remains with MIS, Loan Operation Manager, or CRM. This summary is a static
            mock output only; the LMS is not yet connected to an API for a real AI Assist engine.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applicant Details</CardTitle>
            <CardDescription>
              {application.encodedBy
                ? `Walk-in applicant — encoded at the branch by ${application.encodedBy} from the paper form (ECLC-LOFN01)`
                : 'Submitted via the (not yet built) public loan application website'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Age</dt>
              <dd className="text-right font-medium">{application.age}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-right font-medium">{application.address}</dd>
              <dt className="text-muted-foreground">Employer</dt>
              <dd className="text-right font-medium">{application.employer}</dd>
              <dt className="text-muted-foreground">Monthly income</dt>
              <dd className="text-right font-medium">{formatPeso(application.monthlyIncome)}</dd>
              <dt className="text-muted-foreground">Credit score</dt>
              <dd className="text-right font-medium">{application.creditScore}</dd>
              <dt className="text-muted-foreground">Properties owned</dt>
              <dd className="text-right font-medium">
                {application.propertiesOwned.length === 0 ? 'None on record' : application.propertiesOwned.join(', ')}
              </dd>
              <dt className="text-muted-foreground">Co-borrower</dt>
              <dd className="text-right font-medium">{application.coBorrowerName ?? 'None (optional)'}</dd>
              <dt className="text-muted-foreground">Client status</dt>
              <dd className="text-right">
                <Badge variant={repeatClientBorrower ? 'default' : 'outline'}>
                  {repeatClientBorrower ? 'Repeat Client' : 'New Applicant'}
                </Badge>
              </dd>
            </dl>

            {repeatClientBorrower && (
              <>
                <Separator className="my-4" />
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> Previous Loan Accounts ({previousLoans.length})
                </p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Click a previous loan to view its full repayment schedule (monthly payment report).
                </p>
                <ul className="space-y-1.5">
                  {previousLoans.map((prevLoan) => (
                    <li key={prevLoan.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/loans/${prevLoan.id}`)}
                        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/50"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs">{prevLoan.loanCode}</span>
                          <span className="text-muted-foreground">{prevLoan.productType}</span>
                        </span>
                        <LoanStatusBadge status={prevLoan.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <Separator className="my-4" />

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Uploaded Attachments ({application.attachments.length})
            </p>
            <ul className="space-y-1.5">
              {application.attachments.map((att) => (
                <li key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    {att.fileName}
                  </span>
                  <span className="text-xs text-muted-foreground">{att.sizeKb} KB</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requested Loan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="text-right font-medium">{application.requestedCategory}</dd>
              <dt className="text-muted-foreground">Requested amount</dt>
              <dd className="text-right font-medium">{formatPeso(application.requestedAmount)}</dd>
              <dt className="text-muted-foreground">Requested term</dt>
              <dd className="text-right font-medium">{application.requestedTermMonths} months</dd>
              {application.accountType && (
                <>
                  <dt className="text-muted-foreground">Type of account</dt>
                  <dd className="text-right font-medium">{application.accountType === 'NEW' ? 'New' : 'Renewal'}</dd>
                </>
              )}
              {application.loanPurpose && (
                <>
                  <dt className="text-muted-foreground">Loan purpose</dt>
                  <dd className="text-right font-medium">{application.loanPurpose}</dd>
                </>
              )}
              {application.referralSource && (
                <>
                  <dt className="text-muted-foreground">Found Easycash via</dt>
                  <dd className="text-right font-medium">{application.referralSource}</dd>
                </>
              )}
            </dl>

            <Separator className="my-4" />

            <div className="space-y-1.5">
              <Label>Assigned product sub-type</Label>
              <p className="text-xs text-muted-foreground">
                The client only selects a category when applying — staff assigns the specific sub-type here based on the client's
                situation (e.g. tied-up employer, repeat client discount).
              </p>
              {isPending ? (
                <Select value={application.assignedSubType ?? ''} onValueChange={assignSubType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not yet assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubTypes.map((p) => (
                      <SelectItem key={p.id} value={p.productCode}>
                        {p.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-mono text-sm">{application.assignedSubType ?? 'Not assigned'}</p>
              )}
            </div>

            <Separator className="my-4" />

            {isPending ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="decision-note">Decision note (optional)</Label>
                  <Textarea
                    id="decision-note"
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="e.g. Verified via phone call, proceeding as recommended..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setConfirmAction('APPROVED')} disabled={!application.assignedSubType}>
                    Approve Application
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmAction('DECLINED')}>
                    Decline Application
                  </Button>
                </div>
                {!application.assignedSubType && (
                  <p className="text-xs text-muted-foreground">Assign a product sub-type above before approving.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Preview only — this updates the in-memory sample record for this browser tab; nothing is saved to a real database.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    {application.status === 'APPROVED' ? 'Approved' : 'Declined'} by {application.reviewedBy}
                  </p>
                  <p className="text-xs text-muted-foreground">{application.reviewedAt && formatDate(application.reviewedAt)}</p>
                  {application.decisionNote && <p className="mt-2 text-sm text-muted-foreground">{application.decisionNote}</p>}
                </div>
                {canRevertLoanApplicationDecision ? (
                  <Button variant="outline" size="sm" onClick={() => setConfirmAction('REVERT')}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to Pending Review
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Only MIS can revert a decided application back to Pending Review (accidental-click safety net).
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RecentActivityPanel entries={applicationLogs} title="Recent Activity — This Application" />

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Confirm{' '}
              {confirmAction === 'REVERT'
                ? 'revert'
                : confirmAction === 'CREATE_CLIENT'
                  ? 'client creation'
                  : confirmAction === 'APPROVED'
                    ? 'approval'
                    : 'decline'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'REVERT' &&
                `This will revert ${application.applicantName}'s application back to Pending Review and clear the previous decision. This action is logged.`}
              {confirmAction === 'CREATE_CLIENT' &&
                `This will create an official Client Details record for ${application.applicantName}, copying over their profile picture, personal/contact info, address, and attachments. This action is logged and cannot be undone from here.`}
              {(confirmAction === 'APPROVED' || confirmAction === 'DECLINED') &&
                `Are you sure you want to ${confirmAction === 'APPROVED' ? 'approve' : 'decline'} ${application.applicantName}'s application? This is a safety-net confirmation to prevent an accidental click.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirmAction === 'REVERT') confirmRevert();
                else if (confirmAction === 'CREATE_CLIENT') confirmCreateClient();
                else if (confirmAction) confirmDecision(confirmAction);
              }}
            >
              Yes, confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
