import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Plus, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { LoanStatusBadge } from '@/components/StatusBadge';
import { PaginationControls } from '@/components/PaginationControls';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { sortRows, useSortState } from '@/lib/useSortableTable';
import { useCursorPagination } from '@/lib/useCursorPagination';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { formatDate, formatPeso } from '@/lib/utils';
import { fetchAllPages } from '@/lib/apiClient';
import { classifyProductType, PRODUCT_TYPE_ORDER } from '@/lib/productTypeClassification';
import { productTypeLabel, useProductTypeLabels } from '@/lib/productTypeLabels';
import type { Borrower, LoanAccount, LoanAccountStatus, LoanProduct } from '@/lib/loanApiTypes';

const PAGE_SIZE = 25;

interface LoanRow {
  id: string;
  loanCode: string;
  borrowerId: string;
  borrowerName: string;
  productName: string;
  productActive: boolean;
  status: LoanAccountStatus;
  isMatured: boolean;
  principalAmount: number;
  collectionsBalance: number;
  createdAt: string;
  legacyNonReconcilingClosedBalance: boolean;
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

/** 'MATURED' isn't a raw `LoanAccountStatus` - it's a computed overlay (the loan's full scheduled
 * term ended and it's still unpaid), same as the "Matured" badge that takes priority over the raw
 * status label on a matured loan. Filtered as its own option so it doesn't silently mix into the
 * Active/In Arrears views - the backend excludes matured loans from those two when filtering by
 * them directly, matching what the badge already shows. */
const STATUS_OPTIONS: { value: LoanAccountStatus | 'MATURED' | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'For Disbursement' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ACTIVE_IN_ARREARS', label: 'In Arrears' },
  { value: 'MATURED', label: 'Matured' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CLOSED_WRITTEN_OFF', label: 'Written Off' },
  { value: 'CLOSED_REJECTED', label: 'Rejected' },
  { value: 'CLOSED_RESTRUCTURED', label: 'Restructured' },
  { value: 'CLOSED_ADJUSTED', label: 'Rescheduled' },
];

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-08 after CP12 (real legacy data migrated -
 * `docs/Architecture/CP12_LEGACY_MIGRATION_DESIGN.md`). Real `GET /loan-accounts`, `/borrowers`,
 * `/loan-products` replace `MOCK_LOANS`. No branch filter/column: the backend has no `GET
 * /branches` endpoint yet, and every migrated record currently belongs to the single seeded "HQ"
 * branch anyway (§5 point 1 of the CP12 design), so a branch dimension has no real value to show
 * right now - removed rather than faked.
 *
 * Real, server-side pagination (25 rows/page, Next/Previous - see `useCursorPagination`) replaced
 * the earlier "load every loan up front" approach that this doc comment used to flag as a temporary
 * stopgap - it became the actual frontend-lag problem it warned about. Borrower/loan-code search,
 * status, Product Type, and Product Class (2026-07-16, Product Type added 2026-07-20) all go to
 * backend query params, so a full page of up to 25 matching rows is always shown even with a
 * filter applied - status is a direct equality filter; Product Type/Class resolve the selected
 * product name(s) to every matching LoanProductVersion id client-side (via the already-fetched
 * full product catalog, grouped by `classifyProductType` for the Type filter - same classification
 * the Loan Products catalog and Create Loan Account's picker already use) and filter loan-accounts
 * by that id set. Product Class narrows to the selected Product Type, same cascading UX as
 * elsewhere in the app.
 */
export function LoanListPage() {
  const navigate = useNavigate();
  const { canCreateLoanAccount } = useRole();
  useLogPageView('List of Loan Accounts');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = React.useState<LoanAccountStatus | 'MATURED' | 'ALL'>('ALL');
  const [productType, setProductType] = React.useState<string>('ALL');
  const [product, setProduct] = React.useState<string>('ALL');
  const productTypeLabelsQuery = useProductTypeLabels();
  // "Created" is sorted server-side (spans every matching loan, not just the current page, unlike
  // every other column here - see useSortableTable.ts's `useSortState`/`sortRows` split, same
  // pattern as ClientListPage.tsx's "Date Created") - read before useCursorPagination below so its
  // direction can be passed as a query param.
  const { sort, toggleSort } = useSortState({ key: 'createdAt', direction: 'desc' });

  const productsQuery = useQuery({
    // Deliberately NOT ['loan-products', 'all'] - that key is shared by pages caching the plain
    // LoanProduct[] array; this query's Map shape crashed them on cross-page navigation
    // (`(productsQuery.data ?? []).flatMap is not a function`). See ClientProfilePage.tsx's
    // identical fix for the full explanation.
    queryKey: ['loan-products', 'all', 'versionToProductMap'],
    queryFn: async () => {
      const products = await fetchAllPages<LoanProduct>('/loan-products');
      const versionToProduct = new Map<string, { name: string; isActive: boolean }>();
      // 2026-07-16 (status/product filters): the Product filter needs every version id belonging
      // to a selected product name, so the loan-accounts request can filter server-side by
      // `loanProductVersionIds` (a product can have several versions over time) - avoids needing a
      // product-name join on the backend.
      const versionIdsByProductName = new Map<string, string[]>();
      for (const p of products) {
        for (const v of p.versions ?? []) {
          versionToProduct.set(v.id, { name: p.name, isActive: v.isActive });
          versionIdsByProductName.set(p.name, [...(versionIdsByProductName.get(p.name) ?? []), v.id]);
        }
      }
      const productNames = [...versionIdsByProductName.keys()].sort();
      // 2026-07-20 (Product Type filter, user request): groups the same product names by
      // `classifyProductType` - same classification the Loan Products catalog and Create Loan
      // Account's own Product Type -> Product Class picker already use, so this filter behaves
      // consistently with those instead of introducing a second definition of "type."
      const productNamesByType = new Map<string, string[]>();
      for (const name of productNames) {
        const type = classifyProductType(name);
        productNamesByType.set(type, [...(productNamesByType.get(type) ?? []), name]);
      }
      return { versionToProduct, versionIdsByProductName, productNames, productNamesByType };
    },
  });

  const productTypeOptions = React.useMemo(
    () => PRODUCT_TYPE_ORDER.filter((t) => productsQuery.data?.productNamesByType.has(t)),
    [productsQuery.data],
  );

  // Product Class options narrow to the selected Product Type - mirrors the same cascading
  // Product Type -> Product Class UX as Create Loan Account and Loan Application's picker.
  const productOptions = React.useMemo(() => {
    const data = productsQuery.data;
    if (!data) return [];
    return productType === 'ALL' ? data.productNames : (data.productNamesByType.get(productType) ?? []);
  }, [productsQuery.data, productType]);

  const handleProductTypeChange = (v: string) => {
    setProductType(v);
    setProduct('ALL');
  };

  const selectedProductVersionIds = React.useMemo(() => {
    const data = productsQuery.data;
    if (!data) return undefined;
    if (product !== 'ALL') return data.versionIdsByProductName.get(product);
    if (productType !== 'ALL') {
      const names = data.productNamesByType.get(productType) ?? [];
      return names.flatMap((n) => data.versionIdsByProductName.get(n) ?? []);
    }
    return undefined;
  }, [productsQuery.data, product, productType]);

  const {
    items: loans,
    query: loansQuery,
    pageNumber,
    hasNext,
    hasPrev,
    goNext,
    goPrev,
  } = useCursorPagination<LoanAccount>(
    ['loan-accounts'],
    '/loan-accounts',
    {
      search: debouncedSearch,
      status: status === 'ALL' ? undefined : status,
      loanProductVersionIds: selectedProductVersionIds && selectedProductVersionIds.length > 0 ? selectedProductVersionIds.join(',') : undefined,
      sortDirection: sort.key === 'createdAt' ? sort.direction : undefined,
    },
    PAGE_SIZE,
    // Waits for the product catalog to load before the first fetch whenever a product/product-type
    // filter is selected, so that request always carries the real version ids instead of firing
    // once unfiltered and again a moment later once they resolve.
    (product === 'ALL' && productType === 'ALL') || Boolean(productsQuery.data),
  );

  // Still loaded in full for the name join - there's no batch "GET /borrowers?ids=" endpoint, and
  // borrower search is already covered server-side via the loan-accounts search param above.
  const borrowerIds = React.useMemo(() => [...new Set(loans.map((l) => l.borrowerId))], [loans]);
  const borrowersQuery = useQuery({
    queryKey: ['borrowers', 'all'],
    queryFn: () => fetchAllPages<Borrower>('/borrowers'),
    enabled: borrowerIds.length > 0,
  });
  const borrowerById = React.useMemo(() => new Map((borrowersQuery.data ?? []).map((b) => [b.id, b])), [borrowersQuery.data]);

  const isLoading = loansQuery.isLoading || borrowersQuery.isLoading || productsQuery.isLoading;

  const rows: LoanRow[] = React.useMemo(() => {
    const versionMap = productsQuery.data?.versionToProduct ?? new Map();
    return loans.map((l) => {
      const borrower = borrowerById.get(l.borrowerId);
      const productInfo = versionMap.get(l.loanProductVersionId);
      return {
        id: l.id,
        loanCode: l.loanCode,
        borrowerId: l.borrowerId,
        borrowerName: borrower ? borrower.fullName : l.borrowerId,
        productName: productInfo?.name ?? '-',
        productActive: productInfo?.isActive ?? true,
        status: l.status,
        isMatured: l.isMatured,
        principalAmount: Number.parseFloat(l.principalAmount) || 0,
        collectionsBalance: Number.parseFloat(l.collectionsBalance) || 0,
        createdAt: l.createdAt,
        legacyNonReconcilingClosedBalance: l.legacyNonReconcilingClosedBalance,
      };
    });
  }, [loans, borrowerById, productsQuery.data]);

  // status, product type, and product are already server-filtered above (via useCursorPagination's
  // extraParams); when sort.key is 'createdAt', `rows` already arrives in that order from the
  // server too, so this is a no-op re-sort for that column and does the real work only for the
  // other, per-page columns.
  const sorted = React.useMemo(() => sortRows(rows, getSortValue, sort), [rows, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">List of Loan Accounts</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${rows.length} loan accounts on this page.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateLoanAccount && (
            <Button onClick={() => navigate('/loans/new')}>
              <Plus className="mr-1.5 h-4 w-4" /> New Loan Account
            </Button>
          )}
        </div>
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
            <Select value={status} onValueChange={(v) => setStatus(v as LoanAccountStatus | 'MATURED' | 'ALL')}>
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
            <Select value={productType} onValueChange={handleProductTypeChange}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All product types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All product types</SelectItem>
                {productTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All product classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All product classes</SelectItem>
                {productOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
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
                    <div className="flex items-center gap-1.5">
                      <LoanStatusBadge status={loan.status} isMatured={loan.isMatured} />
                      {/* ADR-007 §4 (backfilled 2026-07-23) - flags one of the 79 legacy CLOSED
                          loans whose migrated balance doesn't sum to zero; full explanation on the
                          loan's own detail page. */}
                      {loan.legacyNonReconcilingClosedBalance && (
                        <span title="Legacy migration flag (ADR-007 §4): balance doesn't sum to ₱0.00 despite being Closed - needs manual accounting review">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatPeso(loan.principalAmount)}</TableCell>
                  <TableCell className="text-right">
                    {loan.status === 'PENDING_APPROVAL' || loan.status === 'APPROVED' ? (
                      <span className="text-muted-foreground" title="Not yet computed - the repayment schedule is only generated once this loan is Activated">
                        —
                      </span>
                    ) : (
                      formatPeso(loan.collectionsBalance)
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(loan.createdAt)}</TableCell>
                </TableRow>
              ))}
              {!isLoading && sorted.length === 0 && (
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

      <RecentActivityPanel label="List of Loan Accounts" entityTypes={['LoanAccount', 'Loan Accounts']} />
    </div>
  );
}

