import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ArrowLeft, Lock, Paperclip, RotateCcw } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { AttachmentsPanel } from '@/components/AttachmentsPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, fetchAllPages } from '@/lib/apiClient';
import type { LoanApplication } from '@/lib/loanApplicationApiTypes';
import type { LoanProduct } from '@/lib/loanApiTypes';
import type { User } from '@/lib/userApiTypes';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

/**
 * Curated product-class whitelist per loan type, confirmed with the business 2026-07-10 — not
 * every active `LoanProduct` in the database, deliberately: only these are offered through this
 * assignment flow. `discontinued: true` entries are still real, currently-active products (loans
 * already running under them still need to be assignable/visible), but are no longer offered to
 * new applicants going forward — surfaced with a badge, not hidden, so staff can tell the
 * difference at a glance.
 */
const LOAN_TYPE_OPTIONS = ['Salary Loan', 'Seafarer Loan', 'Business Loan'] as const;
type LoanTypeOption = (typeof LOAN_TYPE_OPTIONS)[number];

const PRODUCT_CLASS_BY_TYPE: Record<LoanTypeOption, { name: string; discontinued?: boolean }[]> = {
  'Salary Loan': [
    { name: 'SL-Regular' },
    { name: 'SL-Corporate' },
    { name: 'SL-Snap-A', discontinued: true },
    { name: 'SL-Snap-B', discontinued: true },
    { name: 'SL-Online', discontinued: true },
    { name: 'SL-Online_New', discontinued: true },
    { name: 'SL-Lazada', discontinued: true },
    { name: 'SL-Lazada -New', discontinued: true },
    { name: 'SL-Lazada-Promo', discontinued: true },
  ],
  'Seafarer Loan': [
    { name: 'SML-Regular' },
    { name: 'SML-Special' },
    { name: 'SML-Kaborrow', discontinued: true },
    { name: 'SML-PDC', discontinued: true },
    { name: 'SML-Quick Cash', discontinued: true },
    { name: 'SML-Co-Borrower Allotment', discontinued: true },
    { name: 'SML-Self Allotment', discontinued: true },
  ],
  'Business Loan': [{ name: 'BL-Regular' }, { name: 'BL-Special' }],
};

function findLoanTypeForProductName(productName: string): LoanTypeOption | null {
  for (const type of LOAN_TYPE_OPTIONS) {
    if (PRODUCT_CLASS_BY_TYPE[type].some((c) => c.name === productName)) return type;
  }
  return null;
}

/**
 * Wired to the real backend Loan Applications module (`GET/POST /loan-applications/:id/...`).
 * Approve requires a product version to be assigned first — mirrors the backend's
 * `ProductNotAssignedError` gate. Only MIS can revert a decided application back to Pending
 * Review (accidental-click safety net), matching `canRevertLoanApplicationDecision`.
 *
 * The mock preview's AI Risk Assessment and the Create-Client/Create-Loan-Account bridge have no
 * backend equivalent yet (converting an APPROVED application into a Borrower/LoanAccount is a
 * deliberately separate concern — see the backend module's own design notes) and are intentionally
 * left out here rather than shown against data that can't correlate to this application's real id.
 */
export function LoanApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccessLoanApplications, canRevertLoanApplicationDecision, currentAccount } = useRole();
  const [decisionNote, setDecisionNote] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<'APPROVED' | 'DECLINED' | 'REVERT' | null>(null);

  useLogPageView('Loan Application Detail', applicationId);

  const applicationQuery = useQuery({
    queryKey: ['loan-application', applicationId],
    queryFn: () => apiClient.get<LoanApplication>(`/loan-applications/${applicationId}`),
    enabled: canAccessLoanApplications && Boolean(applicationId),
    retry: false,
  });
  const application = applicationQuery.data;

  const productsQuery = useQuery({
    queryKey: ['loan-products', 'all'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
    enabled: canAccessLoanApplications,
  });
  const activeVersionOptions = React.useMemo(
    () =>
      (productsQuery.data ?? []).flatMap((product) =>
        product.versions
          .filter((v) => v.isActive)
          .map((v) => ({ id: v.id, productName: product.name, label: `${product.name} (v${v.versionNumber})` })),
      ),
    [productsQuery.data],
  );
  const versionIdByProductName = React.useMemo(
    () => new Map(activeVersionOptions.map((v) => [v.productName, v.id])),
    [activeVersionOptions],
  );
  const productNameByVersionId = React.useMemo(
    () => new Map(activeVersionOptions.map((v) => [v.id, v.productName])),
    [activeVersionOptions],
  );

  const assignedProductName = application?.assignedLoanProductVersionId
    ? (productNameByVersionId.get(application.assignedLoanProductVersionId) ?? null)
    : null;

  // Local UI-only step — narrows which product classes the second dropdown offers. Initialized
  // from whatever the application is currently assigned to, if it falls under one of the 3 curated
  // types; otherwise starts unset so staff picks a type first.
  const [selectedProductType, setSelectedProductType] = React.useState<LoanTypeOption | ''>('');
  React.useEffect(() => {
    if (assignedProductName) {
      const resolvedType = findLoanTypeForProductName(assignedProductName);
      if (resolvedType) setSelectedProductType(resolvedType);
    }
    // Only re-derive when the application itself (or its assignment) changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id, assignedProductName]);

  const productClassOptions = React.useMemo(() => {
    if (!selectedProductType) return [];
    return PRODUCT_CLASS_BY_TYPE[selectedProductType]
      .map((c) => ({ ...c, versionId: versionIdByProductName.get(c.name) }))
      .filter((c): c is { name: string; discontinued?: boolean; versionId: string } => Boolean(c.versionId));
  }, [selectedProductType, versionIdByProductName]);

  // Resolves encodedByUserId/reviewedByUserId (raw LMS account ids) into display names for the
  // "encoded by" / "reviewed by" indicators below — same join pattern used elsewhere (e.g.
  // LoanListPage's borrower/product name join).
  const usersQuery = useQuery({ queryKey: ['users', 'all'], queryFn: () => fetchAllPages<User>('/users') });
  const userNameById = React.useMemo(() => new Map((usersQuery.data ?? []).map((u) => [u.id, u.fullName])), [usersQuery.data]);
  const encodedByName = application?.encodedByUserId ? (userNameById.get(application.encodedByUserId) ?? 'Unknown account') : null;
  const reviewedByName = application?.reviewedByUserId ? (userNameById.get(application.reviewedByUserId) ?? 'Unknown account') : null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['loan-application', applicationId] });
    queryClient.invalidateQueries({ queryKey: ['loan-applications', 'all'] });
  };

  const markReviewedMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/mark-reviewed`),
    onSuccess: invalidate,
  });

  React.useEffect(() => {
    if (application && application.reviewState === 'UNREVIEWED' && !markReviewedMutation.isPending) {
      markReviewedMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id, application?.reviewState]);

  const assignProductMutation = useMutation({
    mutationFn: (loanProductVersionId: string) =>
      apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/assign-product`, { loanProductVersionId }),
    onSuccess: invalidate,
  });

  const decideMutation = useMutation({
    mutationFn: (decision: 'APPROVED' | 'DECLINED') =>
      apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/${decision === 'APPROVED' ? 'approve' : 'decline'}`, {
        decisionNote: decisionNote.trim() || undefined,
      }),
    onSuccess: () => {
      setDecisionNote('');
      setConfirmAction(null);
      invalidate();
    },
  });

  const revertMutation = useMutation({
    mutationFn: () => apiClient.post<LoanApplication>(`/loan-applications/${applicationId}/revert`),
    onSuccess: () => {
      setConfirmAction(null);
      invalidate();
    },
  });

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

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Loading application…</p>
      </div>
    );
  }

  if (applicationQuery.isError || !application) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Application not found: {applicationId}
        </div>
      </div>
    );
  }

  const initials = application.applicantName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isPending = application.status === 'PENDING_REVIEW';
  const applicationLogs = MOCK_ACTIVITY_LOGS.filter((l) => l.entityId === application.id);
  const mutationError = assignProductMutation.error || decideMutation.error || revertMutation.error;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
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
              {application.requestedCategory} · Submitted {formatDate(application.createdAt)}
              {encodedByName ? ` · Encoded by ${encodedByName}` : ''}
            </p>
          </div>
        </div>
      </div>

      {mutationError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {mutationError instanceof Error ? mutationError.message : 'Something went wrong.'}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applicant Details</CardTitle>
            <CardDescription>
              {encodedByName
                ? `Walk-in applicant — encoded by ${encodedByName} from the paper form (ECLC-LOFN01)`
                : 'Submitted via the (not yet built) public loan application website'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Age</dt>
              <dd className="text-right font-medium">{application.age ?? '—'}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-right font-medium">{application.address ?? '—'}</dd>
              <dt className="text-muted-foreground">Employer</dt>
              <dd className="text-right font-medium">{application.employer ?? '—'}</dd>
              <dt className="text-muted-foreground">Monthly income</dt>
              <dd className="text-right font-medium">
                {application.monthlyIncome !== null ? formatPeso(application.monthlyIncome) : '—'}
              </dd>
              <dt className="text-muted-foreground">Credit score</dt>
              <dd className="text-right font-medium">{application.creditScore ?? '—'}</dd>
              <dt className="text-muted-foreground">Properties owned</dt>
              <dd className="text-right font-medium">
                {application.propertiesOwned.length === 0 ? 'None on record' : application.propertiesOwned.join(', ')}
              </dd>
              <dt className="text-muted-foreground">Co-borrower</dt>
              <dd className="text-right font-medium">{application.coBorrowerName ?? 'None (optional)'}</dd>
            </dl>

            <Separator className="my-4" />

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Submitted Documents ({application.submittedDocuments.length})
            </p>
            {application.submittedDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">None on record.</p>
            ) : (
              <ul className="space-y-1.5">
                {application.submittedDocuments.map((doc) => (
                  <li key={doc} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    {doc}
                  </li>
                ))}
              </ul>
            )}
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

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The client only selects a category when applying — staff assigns the specific product type and class here.
              </p>
              {isPending ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Assigned product type</Label>
                    <Select
                      value={selectedProductType}
                      onValueChange={(v) => setSelectedProductType(v as LoanTypeOption)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOAN_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assigned product class</Label>
                    <Select
                      value={application.assignedLoanProductVersionId ?? ''}
                      onValueChange={(v) => assignProductMutation.mutate(v)}
                      disabled={!selectedProductType || assignProductMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedProductType ? 'Select product class' : 'Select a product type first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {productClassOptions.map((c) => (
                          <SelectItem key={c.versionId} value={c.versionId} disabled={c.discontinued}>
                            <span className="flex items-center gap-2">
                              {c.name}
                              {c.discontinued && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                  title="Discontinued — no longer offered to new applicants, not selectable here"
                                >
                                  Discontinued
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned product type</p>
                    <p className="font-medium">{selectedProductType || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned product class</p>
                    <p className="font-mono">{assignedProductName ?? 'Not assigned'}</p>
                  </div>
                </div>
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
                  <Button
                    onClick={() => setConfirmAction('APPROVED')}
                    disabled={!application.assignedLoanProductVersionId || decideMutation.isPending}
                  >
                    Approve Application
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmAction('DECLINED')} disabled={decideMutation.isPending}>
                    Decline Application
                  </Button>
                </div>
                {!application.assignedLoanProductVersionId && (
                  <p className="text-xs text-muted-foreground">Assign a product version above before approving.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{application.status === 'APPROVED' ? 'Approved' : 'Declined'}</p>
                  <p className="text-xs text-muted-foreground">
                    {application.reviewedAt && formatDate(application.reviewedAt)}
                    {reviewedByName ? ` · by ${reviewedByName}` : ''}
                  </p>
                  {application.decisionNote && <p className="mt-2 text-sm text-muted-foreground">{application.decisionNote}</p>}
                </div>
                {canRevertLoanApplicationDecision ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmAction('REVERT')}
                    disabled={revertMutation.isPending}
                  >
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

      <AttachmentsPanel ownerType="LOAN_APPLICATION" ownerId={application.id} canUpload={canAccessLoanApplications} />

      <RecentActivityPanel entries={applicationLogs} title="Recent Activity — This Application" />

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Confirm{' '}
              {confirmAction === 'REVERT' ? 'revert' : confirmAction === 'APPROVED' ? 'approval' : 'decline'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'REVERT' &&
                `This will revert ${application.applicantName}'s application back to Pending Review and clear the previous decision.`}
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
                if (confirmAction === 'REVERT') revertMutation.mutate();
                else if (confirmAction) decideMutation.mutate(confirmAction);
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
