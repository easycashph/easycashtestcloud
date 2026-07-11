import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ArrowLeft, Lock, Paperclip, RotateCcw, ShieldCheck, UserPlus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { AttachmentsPanel } from '@/components/AttachmentsPanel';
import { ApplicantAvatar } from '@/components/ApplicantAvatar';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { apiClient, fetchAllPages } from '@/lib/apiClient';
import type { LoanApplication, UpdateLoanApplicationRequest } from '@/lib/loanApplicationApiTypes';
import type { Borrower, LoanProduct } from '@/lib/loanApiTypes';
import type { User } from '@/lib/userApiTypes';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate, formatMobileNumber, formatPeso, toProperCase } from '@/lib/utils';

/** Best-effort split of a free-text full name into first/middle/last for the create-client
 * form's initial prefill — staff can still edit every field before submitting, so an imperfect
 * split (e.g. multi-word surnames) is never silently wrong, just a starting point. */
function splitApplicantName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1] };
}

/**
 * Prefilled from the APPROVED application's own fields — only covers what the real `POST
 * /borrowers` endpoint (`createBorrowerSchema`) actually accepts today (name parts, gender, civil
 * status, contact info). The application's address/employer/monthly income have no home in that
 * request body yet (no income-detail or address input on create — see `CreateBorrowerUseCase`),
 * so they're surfaced read-only as reference instead of being force-mapped into fields that don't
 * exist, per CLAUDE.md "never fabricate" — staff adds those via "Edit Client Details" after
 * creation.
 */
function CreateClientProfileDialog({
  open,
  onOpenChange,
  application,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: LoanApplication;
}) {
  const navigate = useNavigate();
  const initialSplit = React.useMemo(() => splitApplicantName(application.applicantName), [application.applicantName]);
  const [firstName, setFirstName] = React.useState(initialSplit.firstName);
  const [middleName, setMiddleName] = React.useState(initialSplit.middleName);
  const [lastName, setLastName] = React.useState(initialSplit.lastName);
  const [gender, setGender] = React.useState('');
  const [civilStatus, setCivilStatus] = React.useState('');
  const [mobilePhone1, setMobilePhone1] = React.useState(application.mobilePhone ?? '');
  const [email, setEmail] = React.useState(application.email ?? '');

  React.useEffect(() => {
    if (!open) return;
    const split = splitApplicantName(application.applicantName);
    setFirstName(split.firstName);
    setMiddleName(split.middleName);
    setLastName(split.lastName);
    setGender('');
    setCivilStatus('');
    setMobilePhone1(application.mobilePhone ?? '');
    setEmail(application.email ?? '');
  }, [open, application.applicantName, application.mobilePhone, application.email]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post<Borrower>('/borrowers', {
        branchId: application.branchId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
        gender: gender || undefined,
        civilStatus: civilStatus || undefined,
        mobilePhone1: mobilePhone1.trim() || undefined,
        email: email.trim() || undefined,
      }),
    onSuccess: (borrower) => {
      onOpenChange(false);
      navigate(`/clients/${borrower.id}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Client Profile</DialogTitle>
          <DialogDescription>
            Prefilled from {application.applicantName}'s approved application. Review before creating — this becomes the
            client's real record.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>First Name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Last Name</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Middle Name</Label>
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Civil Status</Label>
            <Select value={civilStatus} onValueChange={setCivilStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Single">Single</SelectItem>
                <SelectItem value="Married">Married</SelectItem>
                <SelectItem value="Widowed">Widowed</SelectItem>
                <SelectItem value="Separated">Separated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mobile Number</Label>
            <Input value={mobilePhone1} onChange={(e) => setMobilePhone1(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="rounded-md border bg-secondary/30 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            From the application (reference only — add via "Edit Client Details" after creating)
          </p>
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-muted-foreground">Age</dt>
            <dd className="text-right">{application.age ?? '—'}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd className="text-right">{toProperCase(application.address) || '—'}</dd>
            <dt className="text-muted-foreground">Employer</dt>
            <dd className="text-right">{application.employer ?? '—'}</dd>
            <dt className="text-muted-foreground">Monthly income</dt>
            <dd className="text-right">{application.monthlyIncome !== null ? formatPeso(application.monthlyIncome) : '—'}</dd>
          </dl>
        </div>

        {createMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {createMutation.error instanceof Error ? createMutation.error.message : 'Could not create the client profile.'}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!firstName.trim() || !lastName.trim() || createMutation.isPending}
          >
            Create Client Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

/** Mirrors LoanApplicationsPage's STATUS_BADGE_VARIANT — kept local since this file doesn't
 * otherwise import from that page. */
const DETAIL_STATUS_BADGE_VARIANT: Record<LoanApplication['status'], 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PREAPPROVED: 'secondary',
  PREDECLINED: 'warning',
  APPROVED: 'success',
  DECLINED: 'destructive',
};

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
 * Plain data entry for the three inputs a future AI risk-scoring feature will read (income, credit
 * score, properties owned) — moved here from the Create form's old "Verification Inputs" section,
 * since these are no longer officer-encoded at intake. No scoring/PREAPPROVED-PREDECLINED logic
 * exists yet (that's still a separate, deferred feature) — this card is only the data source it
 * will eventually read from.
 */
function AiRiskManagementSummaryCard({
  application,
  canEdit,
}: {
  application: LoanApplication;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [monthlyIncome, setMonthlyIncome] = React.useState(String(application.monthlyIncome ?? ''));
  const [creditScore, setCreditScore] = React.useState(String(application.creditScore ?? ''));
  const [propertiesOwned, setPropertiesOwned] = React.useState(application.propertiesOwned.join(', '));

  const resetDraft = () => {
    setMonthlyIncome(String(application.monthlyIncome ?? ''));
    setCreditScore(String(application.creditScore ?? ''));
    setPropertiesOwned(application.propertiesOwned.join(', '));
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<LoanApplication>(`/loan-applications/${application.id}`, {
        monthlyIncome: Number(monthlyIncome) > 0 ? Number(monthlyIncome) : undefined,
        creditScore: Number(creditScore) || undefined,
        propertiesOwned: propertiesOwned
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      } satisfies UpdateLoanApplicationRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan-application', application.id] });
      setEditing(false);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" /> AI Risk Management Summary
        </CardTitle>
        <CardDescription>
          Feeds a future AI risk-assessment feature (not yet built) — for now, plain data recorded by the reviewing officer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {saveMutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {saveMutation.error instanceof Error ? saveMutation.error.message : 'Could not save these values.'}
          </div>
        )}
        {editing ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monthly income (₱)</Label>
              <Input type="number" min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Credit score (from CB report)</Label>
              <Input type="number" min="0" max="1000" value={creditScore} onChange={(e) => setCreditScore(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Properties owned</Label>
              <Input
                value={propertiesOwned}
                onChange={(e) => setPropertiesOwned(e.target.value)}
                placeholder="Comma-separated"
              />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
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
          </dl>
        )}

        {canEdit && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetDraft();
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Wired to the real backend Loan Applications module (`GET/POST /loan-applications/:id/...`).
 * Every application starts system-classified PREAPPROVED/PREDECLINED (backend's
 * `LoanApplicationPreQualificationService`, added 2026-07-11 — advisory only). Approve/decline
 * work from either system verdict, requiring a product version to be assigned first — mirrors the
 * backend's `ProductNotAssignedError` gate. Only MIS can revert a decided application back to a
 * freshly recomputed system verdict (accidental-click safety net), matching
 * `canRevertLoanApplicationDecision`.
 *
 * The Create-Loan-Account bridge has no backend equivalent yet (converting an APPROVED application
 * into a LoanAccount is a deliberately separate concern — see the backend module's own design
 * notes) and is intentionally left out here. Create Client Profile is different: `POST /borrowers`
 * is real, so an APPROVED application can create a real client, prefilled from its own fields (see
 * `CreateClientProfileDialog`).
 */
export function LoanApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by LoanApplicationCreatePage when one or more best-effort attachment auto-saves failed
  // (AI Auto-fill document and/or Applicant Document slots) — the application itself was still
  // created successfully.
  const failedDocumentLabels = (location.state as { failedDocumentLabels?: string[] } | null)?.failedDocumentLabels ?? [];
  const queryClient = useQueryClient();
  const { canAccessLoanApplications, canRevertLoanApplicationDecision, currentAccount } = useRole();
  const [decisionNote, setDecisionNote] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<'APPROVED' | 'DECLINED' | 'REVERT' | null>(null);
  const [createClientOpen, setCreateClientOpen] = React.useState(false);

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

  const isPending = application.status === 'PREAPPROVED' || application.status === 'PREDECLINED';
  const applicationLogs = MOCK_ACTIVITY_LOGS.filter((l) => l.entityId === application.id);
  const mutationError = assignProductMutation.error || decideMutation.error || revertMutation.error;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ApplicantAvatar ownerId={application.id} initials={initials} />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">{application.applicantName}</h2>
                <Badge variant={DETAIL_STATUS_BADGE_VARIANT[application.status]}>{application.status.replaceAll('_', ' ')}</Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {application.requestedCategory} · Submitted {formatDate(application.createdAt)}
                {encodedByName ? ` · Encoded by ${encodedByName}` : ''}
              </p>
              {isPending && (
                <p className="text-xs text-muted-foreground">
                  System pre-qualification —{' '}
                  {application.distanceFromBranchKm !== null
                    ? `${application.distanceFromBranchKm} km from branch`
                    : 'distance from branch could not be verified'}
                  .
                </p>
              )}
            </div>
          </div>
          {canAccessLoanApplications && (
            <Button
              size="sm"
              disabled={application.status !== 'APPROVED'}
              onClick={() => setCreateClientOpen(true)}
              title={application.status !== 'APPROVED' ? 'Only available once the application is Approved' : undefined}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Create Client Profile
            </Button>
          )}
        </div>
      </div>

      {mutationError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {mutationError instanceof Error ? mutationError.message : 'Something went wrong.'}
        </div>
      )}

      {failedDocumentLabels.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> The application was created, but the following document(s) could not be
          saved as attachments automatically: {failedDocumentLabels.join(', ')}. Please upload them manually below.
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
              <dd className="text-right font-medium">{toProperCase(application.address) || '—'}</dd>
              <dt className="text-muted-foreground">Mobile number</dt>
              <dd className="text-right font-medium">{formatMobileNumber(application.mobilePhone)}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-right font-medium">{application.email ?? '—'}</dd>
              <dt className="text-muted-foreground">Employer</dt>
              <dd className="text-right font-medium">{application.employer ?? '—'}</dd>
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
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to AI Pre-Qualification
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Only MIS can revert a decided application back to AI pre-qualification (accidental-click safety net).
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AiRiskManagementSummaryCard application={application} canEdit={canAccessLoanApplications} />

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
                `This will revert ${application.applicantName}'s application back to a freshly recomputed AI pre-qualification and clear the previous decision.`}
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

      <CreateClientProfileDialog open={createClientOpen} onOpenChange={setCreateClientOpen} application={application} />
    </div>
  );
}
