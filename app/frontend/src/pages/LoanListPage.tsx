import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate, formatPeso } from '@/lib/utils';
import { fetchAllPages } from '@/lib/apiClient';
import type { Borrower, LoanAccount, LoanAccountStatus, LoanProduct } from '@/lib/loanApiTypes';

const PAGE_SIZE = 100;

interface LoanRow {
  id: string;
  loanCode: string;
  borrowerId: string;
  borrowerName: string;
  productName: string;
  productActive: boolean;
  status: LoanAccountStatus;
  principalAmount: number;
  collectionsBalance: number;
  createdAt: string;
}

function getSortValue(loan: LoanRow, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'loanCode':
      return loan.loanCode;
    case 'borrowerName':
      return loan.borrowerName;
    case 'productName':
      return loan.productName;
    case 'status':
      return loan.status;
    case 'principalAmount':
      return loan.principalAmount;
    case 'collectionsBalance':
      return loan.collectionsBalance;
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
  { value: 'CLOSED_WRITTEN_OFF', label: 'Written Off' },
  { value: 'CLOSED_REJECTED', label: 'Rejected' },
];

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-08 after CP12 (real legacy data migrated —
 * `docs/Architecture/CP12_LEGACY_MIGRATION_DESIGN.md`). Real `GET /loan-accounts`, `/borrowers`,
 * `/loan-products` replace `MOCK_LOANS`. No branch filter/column: the backend has no `GET
 * /branches` endpoint yet, and every migrated record currently belongs to the single seeded "HQ"
 * branch anyway (§5 point 1 of the CP12 design), so a branch dimension has no real value to show
 * right now — removed rather than faked.
 *
 * Real, server-side pagination (100 rows/page, Next/Previous — see `useCursorPagination`) replaced
 * the earlier "load every loan up front" approach that this doc comment used to flag as a temporary
 * stopgap — it became the actual frontend-lag problem it warned about. Borrower/loan-code search
 * goes to the backend's `?search=` param (debounced); status/product have no backend filter param
 * yet, so those two narrow within the current page only, not across every loan.
 */
export function LoanListPage() {
  const navigate = useNavigate();
  useLogPageView('Loan Accounts');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = React.useState<LoanAccountStatus | 'ALL'>('ALL');
  const [product, setProduct] = React.useState<string>('ALL');

  const {
    items: loans,
    query: loansQuery,
    pageNumber,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
  } = useCursorPagination<LoanAccount>(['loan-accounts'], '/loan-accounts', { search: debouncedSearch }, PAGE_SIZE);

  // Still loaded in full for the name join — there's no batch "GET /borrowers?ids=" endpoint, and
  // borrower search is already covered server-side via the loan-accounts search param above.
  const borrowerIds = React.useMemo(() => [...new Set(loans.map((l) => l.borrowerId))], [loans]);
  const borrowersQuery = useQuery({
    queryKey: ['borrowers', 'all'],
    queryFn: () => fetchAllPages<Borrower>('/borrowers'),
    enabled: borrowerIds.length > 0,
  });
  const borrowerById = React.useMemo(() => new Map((borrowersQuery.data ?? []).map((b) => [b.id, b])), [borrowersQuery.data]);

  const productsQuery = useQuery({
    // Deliberately NOT ['loan-products', 'all'] — that key is shared by pages caching the plain
    // LoanProduct[] array; this query's Map shape crashed them on cross-page navigation
    // (`(productsQuery.data ?? []).flatMap is not a function`). See ClientProfilePage.tsx's
    // identical fix for the full explanation.
    queryKey: ['loan-products', 'all', 'versionToProductMap'],
    queryFn: async () => {
      const products = await fetchAllPages<LoanProduct>('/loan-products');
      const versionToProduct = new Map<string, { name: string; isActive: boolean }>();
      for (const p of products) {
        for (const v of p.versions ?? []) {
          versionToProduct.set(v.id, { name: p.name, isActive: v.isActive });
        }
      }
      return versionToProduct;
    },
  });

  const isLoading = loansQuery.isLoading || borrowersQuery.isLoading || productsQuery.isLoading;

  const rows: LoanRow[] = React.useMemo(() => {
    const versionMap = productsQuery.data ?? new Map();
    return loans.map((l) => {
      const borrower = borrowerById.get(l.borrowerId);
      const productInfo = versionMap.get(l.loanProductVersionId);
      return {
        id: l.id,
        loanCode: l.loanCode,
        borrowerId: l.borrowerId,
        borrowerName: borrower ? `${borrower.firstName} ${borrower.lastName}` : l.borrowerId,
        productName: productInfo?.name ?? '—',
        productActive: productInfo?.isActive ?? true,
        status: l.status,
        principalAmount: Number.parseFloat(l.principalAmount) || 0,
        collectionsBalance: Number.parseFloat(l.collectionsBalance) || 0,
        createdAt: l.createdAt,
      };
    });
  }, [loans, borrowerById, productsQuery.data]);

  const productOptions = React.useMemo(() => ['ALL', ...[...new Set(rows.map((r) => r.productName))].sort()], [rows]);

  const filtered = rows.filter((loan) => {
    const matchesStatus = status === 'ALL' || loan.status === status;
    const matchesProduct = product === 'ALL' || loan.productName === product;
    return matchesStatus && matchesProduct;
  });
  const { sorted, sort, toggleSort } = useSortableTable(filtered, getSortValue, { key: 'createdAt', direction: 'desc' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Loan Accounts</h2>
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading…' : `${rows.length} loan accounts on this page.`}
        </p>
      </div>

      {loansQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load loan accounts. Is the backend running?
        </div>
      )}

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
                {productOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p === 'ALL' ? 'All products' : p}
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
                <SortableTableHead sortKey="productName" currentSort={sort} onSort={toggleSort}>
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
                <SortableTableHead sortKey="createdAt" currentSort={sort} onSort={toggleSort} isDateColumn>
                  Created
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((loan) => (
                <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                  <TableCell className="font-mono text-xs">{loan.loanCode}</TableCell>
                  <TableCell className="font-medium">{loan.borrowerName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{loan.productName}</span>
                      {!loan.productActive && (
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
                  <TableCell className="text-xs text-muted-foreground">{formatDate(loan.createdAt)}</TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No loans match your search/filter.
                  </TableCell>
                </TableRow>
              )}
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Loading loan accounts…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls
            pageNumber={pageNumber}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onNext={goNext}
            onPrev={goPrev}
            pageSize={PAGE_SIZE}
            itemCount={loans.length}
          />
        </CardContent>
      </Card>

      <RecentActivityPanel
        entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'LoanAccount' || l.entityType === 'Loan Accounts')}
        title="Recent Activity — Loan Accounts"
      />
    </div>
  );
}

