import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import {
  getMockBorrowerForLoan,
  MOCK_ACTIVITY_LOGS,
  MOCK_LOANS,
  REPORT_BRANCHES,
  type LoanAccountStatus,
  type MockLoanAccount,
} from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';

function getSortValue(loan: MockLoanAccount, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'loanCode':
      return loan.loanCode;
    case 'borrowerName':
      return loan.borrowerName;
    case 'productType':
      return loan.productType;
    case 'status':
      return loan.status;
    case 'principalAmount':
      return loan.principalAmount;
    case 'collectionsBalance':
      return loan.collectionsBalance;
    case 'branchName':
      return loan.branchName;
    case 'createdAt':
      return new Date(loan.createdAt);
    default:
      return undefined;
  }
}

const STATUS_OPTIONS: { value: LoanAccountStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ACTIVE_IN_ARREARS', label: 'In Arrears' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRODUCT_OPTIONS = ['ALL', ...[...new Set(MOCK_LOANS.map((l) => l.productType))].sort()];

export function LoanListPage() {
  const navigate = useNavigate();
  useLogPageView('Loan Accounts');
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<LoanAccountStatus | 'ALL'>('ALL');
  const [product, setProduct] = React.useState<string>('ALL');
  const [branchId, setBranchId] = React.useState<string>('ALL');

  const filtered = MOCK_LOANS.filter((loan) => {
    const matchesStatus = status === 'ALL' || loan.status === status;
    const matchesProduct = product === 'ALL' || loan.productType === product;
    const matchesBranch = branchId === 'ALL' || loan.branchId === branchId;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 || loan.borrowerName.toLowerCase().includes(query) || loan.loanCode.toLowerCase().includes(query);
    return matchesStatus && matchesProduct && matchesBranch && matchesSearch;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'createdAt', direction: 'desc' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Loan Accounts</h2>
        <p className="text-sm text-muted-foreground">{MOCK_LOANS.length} sample loan accounts.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="text-base">Search &amp; Filter</CardTitle>
          <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search borrower or loan code..."
                className="w-full pl-8 sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as LoanAccountStatus | 'ALL')}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === 'ALL' ? 'All products' : p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All branches</SelectItem>
                {REPORT_BRANCHES.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="loanCode" currentSort={sort} onSort={toggleSort}>
                  Loan Code
                </SortableTableHead>
                <SortableTableHead sortKey="borrowerName" currentSort={sort} onSort={toggleSort}>
                  Borrower
                </SortableTableHead>
                <SortableTableHead sortKey="productType" currentSort={sort} onSort={toggleSort}>
                  Product
                </SortableTableHead>
                <SortableTableHead sortKey="status" currentSort={sort} onSort={toggleSort}>
                  Status
                </SortableTableHead>
                <SortableTableHead sortKey="principalAmount" currentSort={sort} onSort={toggleSort} className="text-right">
                  Principal
                </SortableTableHead>
                <SortableTableHead sortKey="collectionsBalance" currentSort={sort} onSort={toggleSort} className="text-right">
                  Collections Balance
                </SortableTableHead>
                <SortableTableHead sortKey="branchName" currentSort={sort} onSort={toggleSort}>
                  Branch
                </SortableTableHead>
                <SortableTableHead sortKey="createdAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Created
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((loan) => (
                <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                  <TableCell className="font-mono text-xs">{loan.loanCode}</TableCell>
                  <TableCell className="font-medium">
                    {(() => {
                      const borrower = getMockBorrowerForLoan(loan);
                      return borrower ? (
                        <Link
                          to={`/clients/${borrower.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {loan.borrowerName}
                        </Link>
                      ) : (
                        loan.borrowerName
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{loan.productType}</span>
                      {loan.isDiscontinuedProduct && (
                        <Badge variant="secondary" className="text-[10px]">
                          Discontinued
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <LoanStatusBadge status={loan.status} />
                  </TableCell>
                  <TableCell className="text-right">{formatPeso(loan.principalAmount)}</TableCell>
                  <TableCell className="text-right">{formatPeso(loan.collectionsBalance)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{loan.branchName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(loan.createdAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No sample loans match your search/filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Loan Accounts')} title="Recent Activity — Loan Accounts" />
    </div>
  );
}
