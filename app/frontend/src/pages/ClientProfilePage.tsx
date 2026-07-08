import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Home, Landmark, Mail, Paperclip, Pencil, Phone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { CreateLoanAccountDialog, type CreateLoanAccountParams } from '@/components/CreateLoanAccountDialog';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable } from '@/lib/useSortableTable';
import {
  clientHasActiveLoan,
  createLoanAccountForClient,
  findApprovedApplicationForClient,
  getMockBorrower,
  getMockLoan,
  logActivity,
  MOCK_ACTIVITY_LOGS,
  type MockBorrowerProfile,
  type MockLoanAccount,
} from '@/lib/mockData';
import { apiClient, fetchAllPages } from '@/lib/apiClient';
import type { Borrower as RealBorrower, LoanAccount, LoanProduct } from '@/lib/loanApiTypes';
import { formatDate, formatPeso } from '@/lib/utils';

function getLoanSortValue(loan: MockLoanAccount, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'loanCode':
      return loan.loanCode;
    case 'productType':
      return loan.productType;
    case 'status':
      return loan.status;
    case 'principalAmount':
      return loan.principalAmount;
    case 'collectionsBalance':
      return loan.collectionsBalance;
    default:
      return undefined;
  }
}

/**
 * Edits are held in local component state only, seeded from
 * `getMockBorrower()` — saving here never reaches `app/backend` and resets
 * on page reload. This demonstrates the edit-form flow, not persistence.
 */
function EditClientDialog({
  open,
  onOpenChange,
  borrower,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrower: MockBorrowerProfile;
  onSave: (next: MockBorrowerProfile) => void;
}) {
  const [draft, setDraft] = React.useState<MockBorrowerProfile>(borrower);

  React.useEffect(() => {
    if (open) setDraft(borrower);
  }, [open, borrower]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit / Customize Client Details</DialogTitle>
          <DialogDescription>Preview only — changes are held in this browser tab and are not saved anywhere.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Full Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Number</Label>
            <Input value={draft.contactNumber} onChange={(e) => setDraft({ ...draft, contactNumber: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Employer</Label>
            <Input value={draft.employer} onChange={(e) => setDraft({ ...draft, employer: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Position</Label>
            <Input value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Income</Label>
            <Input
              type="number"
              value={draft.monthlyIncome}
              onChange={(e) => setDraft({ ...draft, monthlyIncome: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Civil Status</Label>
            <Select value={draft.civilStatus} onValueChange={(v) => setDraft({ ...draft, civilStatus: v as MockBorrowerProfile['civilStatus'] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Single">Single</SelectItem>
                <SelectItem value="Married">Married</SelectItem>
                <SelectItem value="Widowed">Widowed</SelectItem>
                <SelectItem value="Separated">Separated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-09 after CP12. `getMockBorrower()` only knows
 * hand-authored mock clients — a borrower id from `ClientListPage`'s now-real list (a UUID,
 * migrated from legacy data) doesn't exist there and would otherwise hit this page's "not found"
 * state. Deliberately minimal, same scope decision as `LoanDetailPage.tsx`'s `RealLoanDetailView`:
 * personal info + real loan history, read-only. Editing, Create Loan Account (needs a loan
 * application eligibility check the backend doesn't have yet), and Attachments stay mock-only.
 */
function RealClientProfileView({ borrowerId }: { borrowerId: string }) {
  const navigate = useNavigate();

  const borrowerQuery = useQuery({
    queryKey: ['borrower', borrowerId],
    queryFn: () => apiClient.get<RealBorrower>(`/borrowers/${borrowerId}`),
    retry: false,
  });
  const borrower = borrowerQuery.data;

  const loansQuery = useQuery({
    queryKey: ['loan-accounts', 'all'],
    queryFn: () => fetchAllPages<LoanAccount>('/loan-accounts'),
  });
  const productsQuery = useQuery({
    queryKey: ['loan-products', 'all'],
    queryFn: async () => {
      const products = await fetchAllPages<LoanProduct>('/loan-products');
      const versionToProductName = new Map<string, string>();
      for (const p of products) {
        for (const v of p.versions ?? []) versionToProductName.set(v.id, p.name);
      }
      return versionToProductName;
    },
  });

  const loans = (loansQuery.data ?? []).filter((l) => l.borrowerId === borrowerId);

  if (borrowerQuery.isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading client…</p>;
  }

  if (!borrower) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Client not found: {borrowerId}</p>
      </div>
    );
  }

  const address = borrower.addresses[0];
  const addressLine = address
    ? [address.houseUnitNumber, address.street, address.barangay, address.cityMunicipality, address.province]
        .filter(Boolean)
        .join(', ')
    : '—';
  const num = (v: string) => Number.parseFloat(v) || 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        Real client, migrated from legacy data (CP12) — details and loan history below are live.
        Editing, Create Loan Account, and Attachments are not yet wired to real data for this screen.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {((borrower.firstName[0] ?? '') + (borrower.lastName[0] ?? '')).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="mt-2">{borrower.fullName}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {borrower.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> {borrower.mobilePhone1 ?? '—'}
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" /> {borrower.email ?? '—'}
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" /> {addressLine}
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              {borrower.incomeDetail?.position ?? '—'}, {borrower.incomeDetail?.employerName ?? '—'}
            </div>
            <dl className="grid grid-cols-2 gap-y-2 border-t pt-3">
              <dt className="text-muted-foreground">Civil status</dt>
              <dd className="text-right font-medium">{borrower.civilStatus ?? '—'}</dd>
              <dt className="text-muted-foreground">Date of birth</dt>
              <dd className="text-right font-medium">{borrower.birthDate ? formatDate(borrower.birthDate) : '—'}</dd>
              <dt className="text-muted-foreground">Loan cycle</dt>
              <dd className="text-right font-medium">{borrower.loanCycle}</dd>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Loan History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium text-muted-foreground">Loan Code</TableCell>
                    <TableCell className="font-medium text-muted-foreground">Product</TableCell>
                    <TableCell className="font-medium text-muted-foreground">Status</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">Principal</TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">Collections Balance</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.map((loan) => (
                    <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                      <TableCell className="font-mono text-xs">{loan.loanCode}</TableCell>
                      <TableCell>{productsQuery.data?.get(loan.loanProductVersionId) ?? '—'}</TableCell>
                      <TableCell>
                        <LoanStatusBadge status={loan.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatPeso(num(loan.principalAmount))}</TableCell>
                      <TableCell className="text-right">{formatPeso(num(loan.collectionsBalance))}</TableCell>
                    </TableRow>
                  ))}
                  {loansQuery.isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Loading loans…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loansQuery.isLoading && loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No loans on record for this client.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ClientProfilePage() {
  const { borrowerId } = useParams<{ borrowerId: string }>();
  const navigate = useNavigate();
  const { currentAccount, canCreateLoanAccount } = useRole();
  const seedBorrower = borrowerId ? getMockBorrower(borrowerId) : undefined;
  const [borrower, setBorrower] = React.useState(seedBorrower);
  const [editOpen, setEditOpen] = React.useState(false);
  const [createLoanOpen, setCreateLoanOpen] = React.useState(false);
  const [, forceRerender] = React.useState(0);

  useLogPageView('Client Profile', borrowerId);

  React.useEffect(() => {
    setBorrower(seedBorrower);
  }, [seedBorrower]);

  // Computed before the early return below (unconditionally, for every
  // render) so useSortableTable's own hook call never becomes conditional.
  const loans = (borrower?.loanIds ?? []).map((id) => getMockLoan(id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  const { sorted: sortedLoans, sort: loanSort, toggleSort: toggleLoanSort } = useSortableTable(loans, getLoanSortValue, {
    key: null,
    direction: 'asc',
  });

  if (!borrower) {
    // Not a hand-authored mock client — try the real backend (a UUID from ClientListPage's now-real
    // list, migrated via CP12). See RealClientProfileView's own doc comment for scope.
    return borrowerId ? <RealClientProfileView borrowerId={borrowerId} /> : (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Sample client not found: {borrowerId}</p>
      </div>
    );
  }

  const hasActiveLoan = clientHasActiveLoan(borrower.id);
  // A new loan account may only be created from a specific, still-unconverted APPROVED
  // application — see `findApprovedApplicationForClient()`'s doc comment for why (every loan,
  // including a renewal, needs its own reviewed/approved application).
  const eligibleApplication = findApprovedApplicationForClient(borrower.id);
  const canCreateLoanAccountNow = canCreateLoanAccount && !hasActiveLoan && Boolean(eligibleApplication);
  const initials = borrower.name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const clientLogs = MOCK_ACTIVITY_LOGS.filter((l) => l.entityId === borrower.id || borrower.loanIds.includes(l.entityId));

  const saveEdit = (next: MockBorrowerProfile) => {
    setBorrower(next);
    logActivity({
      userName: currentAccount.name,
      action: 'EDIT_CLIENT',
      entityType: 'Client',
      entityId: next.id,
      at: new Date().toISOString(),
    });
  };

  const createLoan = (params: CreateLoanAccountParams) => {
    if (!eligibleApplication) return;
    const loan = createLoanAccountForClient(
      borrower,
      {
        productCode: params.productCode,
        principalAmount: params.principalAmount,
        installmentCount: params.installmentCount,
        interestRate: params.interestRate,
        coBorrowerName: params.coBorrowerName,
        anticipatedDisbursementDate: params.anticipatedDisbursementDate,
        paymentMethod: params.paymentMethod,
        disbursementBank: params.disbursementBank,
        sourceApplicationId: eligibleApplication.id,
      },
      currentAccount.name,
    );
    forceRerender((n) => n + 1);
    navigate(`/loans/${loan.id}`);
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="items-center text-center">
            <Avatar className="h-16 w-16">
              <AvatarImage src={borrower.profilePictureUrl} alt={borrower.name} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <CardTitle className="mt-2">{borrower.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{borrower.homeBranchName}</p>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit / Customize Details
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> {borrower.contactNumber}
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" /> {borrower.email}
            </div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" /> {borrower.address}
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" /> {borrower.position}, {borrower.employer}
            </div>
            <dl className="grid grid-cols-2 gap-y-2 border-t pt-3">
              <dt className="text-muted-foreground">Monthly income</dt>
              <dd className="text-right font-medium">{formatPeso(borrower.monthlyIncome)}</dd>
              <dt className="text-muted-foreground">Civil status</dt>
              <dd className="text-right font-medium">{borrower.civilStatus}</dd>
              <dt className="text-muted-foreground">Date of birth</dt>
              <dd className="text-right font-medium">{formatDate(borrower.dateOfBirth)}</dd>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Loan History</CardTitle>
              {canCreateLoanAccount ? (
                <Button size="sm" disabled={!canCreateLoanAccountNow} onClick={() => setCreateLoanOpen(true)}>
                  <Landmark className="mr-1.5 h-3.5 w-3.5" /> Create Loan Account
                </Button>
              ) : (
                <Badge variant="outline" className="text-xs">
                  Only MIS, Loan Operation Manager, or CRM can create loan accounts
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {hasActiveLoan && canCreateLoanAccount && (
                <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  This client already has an active (or in-arrears) loan account. A client cannot have 2 active loan accounts at once.
                </p>
              )}
              {!hasActiveLoan && canCreateLoanAccount && !eligibleApplication && (
                <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  This client has no approved loan application on file. Every loan account — including a renewal — must come from its
                  own reviewed and approved Loan Application first.
                </p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="loanCode" currentSort={loanSort} onSort={toggleLoanSort}>
                      Loan Code
                    </SortableTableHead>
                    <SortableTableHead sortKey="productType" currentSort={loanSort} onSort={toggleLoanSort}>
                      Product
                    </SortableTableHead>
                    <SortableTableHead sortKey="status" currentSort={loanSort} onSort={toggleLoanSort}>
                      Status
                    </SortableTableHead>
                    <SortableTableHead sortKey="principalAmount" currentSort={loanSort} onSort={toggleLoanSort} className="text-right">
                      Principal
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="collectionsBalance"
                      currentSort={loanSort}
                      onSort={toggleLoanSort}
                      className="text-right"
                    >
                      Collections Balance
                    </SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLoans.map((loan) => (
                    <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                      <TableCell className="font-mono text-xs">{loan.loanCode}</TableCell>
                      <TableCell>{loan.productType}</TableCell>
                      <TableCell>
                        <LoanStatusBadge status={loan.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatPeso(loan.principalAmount)}</TableCell>
                      <TableCell className="text-right">{formatPeso(loan.collectionsBalance)}</TableCell>
                    </TableRow>
                  ))}
                  {loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No loans on record for this sample client.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uploaded Attachments ({borrower.attachments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {borrower.attachments.map((att) => (
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
        </div>
      </div>

      <RecentActivityPanel entries={clientLogs} title="Recent Activity — This Client" />

      <EditClientDialog open={editOpen} onOpenChange={setEditOpen} borrower={borrower} onSave={saveEdit} />
      <CreateLoanAccountDialog open={createLoanOpen} onOpenChange={setCreateLoanOpen} onCreate={createLoan} />
    </div>
  );
}
