import * as React from 'react';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable, type SortState } from '@/lib/useSortableTable';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { fetchAllPages } from '@/lib/apiClient';
import type { LoanProduct, LoanProductVersion } from '@/lib/loanApiTypes';
import { formatPeso } from '@/lib/utils';

interface ProductRow {
  id: string;
  code: string;
  name: string;
  activeVersion: LoanProductVersion | null;
  latestVersion: LoanProductVersion | null;
}

function getProductSortValue(p: ProductRow, key: string): string | number | Date | null | undefined {
  const v = p.activeVersion ?? p.latestVersion;
  switch (key) {
    case 'name':
      return p.name;
    case 'interestCalculationMethod':
      return v?.interestCalculationMethod ?? '';
    case 'loanAmountMin':
      return v ? Number.parseFloat(v.loanAmountMin) : 0;
    case 'installmentCountMin':
      return v?.installmentCountMin ?? 0;
    case 'minInterestRate':
      return v?.minInterestRate ? Number.parseFloat(v.minInterestRate) : 0;
    case 'isActive':
      return p.activeVersion ? 1 : 0;
    default:
      return undefined;
  }
}

function num(v: string | null): number {
  return v ? Number.parseFloat(v) || 0 : 0;
}

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-09 after CP12. Real `GET /loan-products` replaces
 * `MOCK_LOAN_PRODUCTS`. Deliberately read-only: the real backend's `LoanProductVersion` is
 * immutable by design (LPV-2/LPV-3 in `schema.prisma` — editing a product must never affect
 * historical loans), so the mock UI's "Customize"/"Add New Product" in-place-edit dialogs don't
 * correspond to any real mutation. A correct implementation would be a create-version +
 * activate-version workflow (endpoints already exist:
 * `POST /loan-products/:id/versions`, `POST /loan-products/:id/versions/:versionId/activate`) —
 * out of scope for this pass; see the 2026-07-09 CHANGELOG entry. Document templates also have no
 * backend endpoint yet, so that section is dropped rather than faked.
 */
export function LoanProductsPage() {
  useLogPageView('Loan Products');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const productsQuery = useQuery({
    queryKey: ['loan-products', 'all'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
  });

  const rows: ProductRow[] = React.useMemo(
    () =>
      (productsQuery.data ?? []).map((p) => {
        const sortedVersions = [...p.versions].sort((a, b) => b.versionNumber - a.versionNumber);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          activeVersion: sortedVersions.find((v) => v.isActive) ?? null,
          latestVersion: sortedVersions[0] ?? null,
        };
      }),
    [productsQuery.data],
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeProducts = rows.filter((p) => p.activeVersion !== null);
  const discontinuedProducts = rows.filter((p) => p.activeVersion === null);
  const activeSortState = useSortableTable(activeProducts, getProductSortValue, { key: null, direction: 'asc' });
  const discontinuedSortState = useSortableTable(discontinuedProducts, getProductSortValue, { key: null, direction: 'asc' });

  function renderProductRow(p: ProductRow) {
    const isOpen = expanded.has(p.id);
    const v = p.activeVersion ?? p.latestVersion;
    return (
      <React.Fragment key={p.id}>
        <TableRow className="cursor-pointer" onClick={() => toggle(p.id)}>
          <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
          <TableCell>
            <p className="font-medium">{p.name}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {p.code} · v{v?.versionNumber ?? '—'}
            </p>
          </TableCell>
          <TableCell className="text-sm">{v?.interestCalculationMethod.replaceAll('_', ' ') ?? '—'}</TableCell>
          <TableCell className="text-right text-sm">
            {v ? `${formatPeso(num(v.loanAmountMin))} – ${v.loanAmountMax ? formatPeso(num(v.loanAmountMax)) : '—'}` : '—'}
          </TableCell>
          <TableCell className="text-right text-sm">
            {v ? `${v.installmentCountMin}–${v.installmentCountMax ?? '—'} mos` : '—'}
          </TableCell>
          <TableCell className="text-right text-sm">
            {v?.minInterestRate ? `${v.minInterestRate}%` : '—'} – {v?.maxInterestRate ? `${v.maxInterestRate}%` : '—'}
          </TableCell>
          <TableCell>
            <Badge variant={p.activeVersion ? 'success' : 'secondary'}>{p.activeVersion ? 'Active' : 'Discontinued'}</Badge>
          </TableCell>
        </TableRow>
        {isOpen && v && (
          <TableRow>
            <TableCell colSpan={7} className="bg-secondary/30">
              <div className="grid gap-4 p-2 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default Rate</p>
                  <p className="text-sm font-semibold">{v.defaultInterestRate ? `${v.defaultInterestRate}% monthly` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grace Period</p>
                  <p className="text-sm font-semibold">{v.gracePeriodDefaultDays} days</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rounding Method</p>
                  <p className="text-sm font-semibold">{v.roundingMethod.replaceAll('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Penalty Rule</p>
                  {v.penaltyRule && v.penaltyRule.calculationMethod !== 'NONE' ? (
                    <p className="text-sm font-semibold">
                      {v.penaltyRule.ratePercent ?? 0}% after {v.penaltyRule.gracePeriodDays}-day grace
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No penalty configured.</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fee Rules</p>
                  {v.feeRules.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">No fee configuration on record.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {v.feeRules.map((fee) => (
                        <li key={fee.id} className="flex items-center justify-between">
                          <span>{fee.name}</span>
                          <span className="font-medium">
                            {fee.calculationMethod === 'FLAT' ? formatPeso(num(fee.flatAmount)) : `${fee.percentage ?? 0}%`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  }

  function renderTable(rows: ProductRow[], sort: SortState, onSort: (key: string, isDateColumn?: boolean) => void) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <SortableTableHead sortKey="name" currentSort={sort} onSort={onSort}>
              Product
            </SortableTableHead>
            <SortableTableHead sortKey="interestCalculationMethod" currentSort={sort} onSort={onSort}>
              Interest Method
            </SortableTableHead>
            <SortableTableHead sortKey="loanAmountMin" currentSort={sort} onSort={onSort} className="text-right">
              Amount Range
            </SortableTableHead>
            <SortableTableHead sortKey="installmentCountMin" currentSort={sort} onSort={onSort} className="text-right">
              Installments
            </SortableTableHead>
            <SortableTableHead sortKey="minInterestRate" currentSort={sort} onSort={onSort} className="text-right">
              Rate Range
            </SortableTableHead>
            <SortableTableHead sortKey="isActive" currentSort={sort} onSort={onSort}>
              Status
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(renderProductRow)}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                No products in this category.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  }

  const isLoading = productsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Loan Products</h2>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? 'Loading…'
            : `${activeProducts.length} active, ${discontinuedProducts.length} discontinued (real product catalog, migrated legacy data — read-only, click a row to expand fee/penalty rules).`}
        </p>
      </div>

      {productsQuery.isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> Could not load loan products. Is the backend running?
        </div>
      )}

      <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        Real product catalog, migrated from legacy data (CP12) — read-only. Loan product versions are
        immutable by design (editing a product must never affect historical loans), so adding or
        customizing a product here would need a proper create-version + activate workflow — not yet
        built. Document templates are not yet wired to real data.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading products…</p>
          ) : (
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">Active ({activeProducts.length})</TabsTrigger>
                <TabsTrigger value="discontinued">Discontinued ({discontinuedProducts.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="active">
                {renderTable(activeSortState.sorted, activeSortState.sort, activeSortState.toggleSort)}
              </TabsContent>
              <TabsContent value="discontinued">
                <p className="mb-3 text-xs text-muted-foreground">
                  These products have no currently-active version but remain visible because real client loans still reference them.
                </p>
                {renderTable(discontinuedSortState.sorted, discontinuedSortState.sort, discontinuedSortState.toggleSort)}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Loan Products')} title="Recent Activity — Loan Products" />
    </div>
  );
}
