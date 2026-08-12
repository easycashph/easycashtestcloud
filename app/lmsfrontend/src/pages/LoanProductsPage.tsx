import * as React from 'react';
import { AlertCircle, Check, ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useRole } from '@/lib/roleContext';
import { useSortableTable, type SortState } from '@/lib/useSortableTable';
import { apiClient, ApiError, fetchAllPages } from '@/lib/apiClient';
import type { LoanProduct, LoanProductVersion } from '@/lib/loanApiTypes';
import { formatPeso } from '@/lib/utils';
import { classifyProductType, groupByProductType } from '@/lib/productTypeClassification';
import { productTypeLabel, useProductTypeLabels } from '@/lib/productTypeLabels';
import type { ProductTypeLabel } from '@/lib/productTypeLabelApiTypes';
import { AddLoanProductDialog, AddLoanProductVersionDialog } from '@/pages/LoanProductForms';

interface ProductRow {
  id: string;
  code: string;
  name: string;
  productType: string;
  activeVersion: LoanProductVersion | null;
  latestVersion: LoanProductVersion | null;
  /** 2026-08-09 (Loan Products admin config): sorted newest-first — the full history, not just active/latest, so the expanded row can list every version and offer Activate on the non-active ones. */
  versions: LoanProductVersion[];
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

function ProductTypeLabelRow({ productTypeLabel, canRename }: { productTypeLabel: ProductTypeLabel; canRename: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(productTypeLabel.label);
  const [error, setError] = React.useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (label: string) => apiClient.patch<ProductTypeLabel>(`/product-type-labels/${productTypeLabel.id}`, { label }),
    onSuccess: () => {
      setEditing(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['product-type-labels'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not rename this Product Type.'),
  });

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === productTypeLabel.label) {
      setEditing(false);
      setValue(productTypeLabel.label);
      return;
    }
    updateMutation.mutate(trimmed);
  };

  return (
    <li className="space-y-1.5 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-8 text-sm" autoFocus />
            <Button type="submit" size="sm" className="h-8 shrink-0" disabled={updateMutation.isPending}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              onClick={() => {
                setEditing(false);
                setValue(productTypeLabel.label);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <div className="text-sm">
              <span className="font-medium">{productTypeLabel.label}</span>
              {productTypeLabel.label !== productTypeLabel.canonicalKey && (
                <span className="ml-2 text-xs text-muted-foreground">was &ldquo;{productTypeLabel.canonicalKey}&rdquo;</span>
              )}
            </div>
            {canRename && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)} aria-label={`Rename ${productTypeLabel.label}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

/**
 * Loan Products > Product Types (2026-07-20 user request, moved from Administration > System the
 * same day - specifically about Loan Products, not a platform-wide System setting) - lets MIS
 * rename the catalog's Product Type groupings (Business Loan, Salary Loan, etc.) without touching
 * the underlying name-prefix classification rule (`productTypeClassification.ts`) - only the label
 * shown to staff changes, everywhere it's displayed (this catalog, Create Loan Account's and Loan
 * Application's Product Type pickers).
 */
function ProductTypesTab() {
  const { canManageMembers } = useRole();
  const query = useProductTypeLabels();
  const productTypeLabels = query.data?.productTypeLabels ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Types</CardTitle>
        <CardDescription>
          Renames how each Loan Products category is labeled throughout the app - MIS only. The underlying grouping rule (which
          products fall under which type) is unchanged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> Could not load Product Types. Is the backend running?
          </div>
        )}
        <ul className="space-y-2">
          {productTypeLabels.map((pt) => (
            <ProductTypeLabelRow key={pt.id} productTypeLabel={pt} canRename={canManageMembers} />
          ))}
          {productTypeLabels.length === 0 && !query.isLoading && (
            <li className="py-2 text-center text-xs text-muted-foreground">No Product Types found.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Frontend↔Backend Wiring Pilot, extended 2026-07-09 after CP12. Real `GET /loan-products` replaces
 * `MOCK_LOAN_PRODUCTS`. Deliberately read-only: the real backend's `LoanProductVersion` is
 * immutable by design (LPV-2/LPV-3 in `schema.prisma` - editing a product must never affect
 * historical loans), so the mock UI's "Customize"/"Add New Product" in-place-edit dialogs don't
 * correspond to any real mutation. A correct implementation would be a create-version +
 * activate-version workflow (endpoints already exist:
 * `POST /loan-products/:id/versions`, `POST /loan-products/:id/versions/:versionId/activate`) -
 * out of scope for this pass; see the 2026-07-09 CHANGELOG entry. Document templates also have no
 * backend endpoint yet, so that section is dropped rather than faked.
 */
export function LoanProductsPage() {
  useLogPageView('Loan Products');
  const { canManageLoanProducts } = useRole();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [pageTab, setPageTab] = React.useState<'catalog' | 'product-types'>('catalog');
  const [addProductOpen, setAddProductOpen] = React.useState(false);
  const [addVersionForProduct, setAddVersionForProduct] = React.useState<{ id: string; name: string; nextVersionNumber: number } | null>(
    null,
  );
  const [activateError, setActivateError] = React.useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ['loan-products', 'all'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
  });
  const productTypeLabelsQuery = useProductTypeLabels();

  // 2026-08-09 (Loan Products admin config): a LoanProductVersion can never be edited once
  // created (LPV-1/LPV-2/LPV-3) - the only way to change which rules a product uses is to
  // activate a different (possibly brand-new) version.
  const activateVersionMutation = useMutation({
    mutationFn: ({ productId, versionId }: { productId: string; versionId: string }) =>
      apiClient.post<LoanProduct>(`/loan-products/${productId}/versions/${versionId}/activate`, {}),
    onSuccess: () => {
      setActivateError(null);
      queryClient.invalidateQueries({ queryKey: ['loan-products', 'all'] });
    },
    onError: (err) => setActivateError(err instanceof ApiError ? err.message : 'Could not activate this version.'),
  });

  const rows: ProductRow[] = React.useMemo(
    () =>
      (productsQuery.data ?? []).map((p) => {
        const sortedVersions = [...p.versions].sort((a, b) => b.versionNumber - a.versionNumber);
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          productType: classifyProductType(p.name),
          activeVersion: sortedVersions.find((v) => v.isActive) ?? null,
          latestVersion: sortedVersions[0] ?? null,
          versions: sortedVersions,
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
              {p.code} · v{v?.versionNumber ?? '-'}
            </p>
          </TableCell>
          <TableCell className="text-sm">{v?.interestCalculationMethod.replaceAll('_', ' ') ?? '-'}</TableCell>
          <TableCell className="text-right text-sm">
            {v ? `${formatPeso(num(v.loanAmountMin))} – ${v.loanAmountMax ? formatPeso(num(v.loanAmountMax)) : '-'}` : '-'}
          </TableCell>
          <TableCell className="text-right text-sm">
            {v ? `${v.installmentCountMin}–${v.installmentCountMax ?? '-'} mos` : '-'}
          </TableCell>
          <TableCell className="text-right text-sm">
            {v?.minInterestRate ? `${v.minInterestRate}%` : '-'} – {v?.maxInterestRate ? `${v.maxInterestRate}%` : '-'}
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
                  <p className="text-sm font-semibold">{v.defaultInterestRate ? `${v.defaultInterestRate}% monthly` : '-'}</p>
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

              <div className="mt-4 border-t pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Version History ({p.versions.length})
                  </p>
                  {canManageLoanProducts && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddVersionForProduct({ id: p.id, name: p.name, nextVersionNumber: (p.versions[0]?.versionNumber ?? 0) + 1 });
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add Version
                    </Button>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {p.versions.map((version) => (
                    <li key={version.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{version.versionNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          effective {new Date(version.effectiveFrom).toLocaleDateString()}
                          {version.effectiveTo ? ` – ${new Date(version.effectiveTo).toLocaleDateString()}` : ''}
                        </span>
                        {version.isActive && <Badge variant="success">Active</Badge>}
                      </div>
                      {!version.isActive && canManageLoanProducts && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            activateVersionMutation.mutate({ productId: p.id, versionId: version.id });
                          }}
                          disabled={activateVersionMutation.isPending}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Activate
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {activateError && <p className="mt-2 text-xs text-destructive">{activateError}</p>}
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  }

  function renderGroupedTables(rows: ProductRow[], sort: SortState, onSort: (key: string, isDateColumn?: boolean) => void) {
    const groups = groupByProductType(rows);
    if (groups.length === 0) {
      return <p className="py-8 text-center text-sm text-muted-foreground">No products in this category.</p>;
    }
    return (
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.type}>
            <h3 className="mb-2 text-sm font-semibold">
              {productTypeLabel(productTypeLabelsQuery.data?.productTypeLabels, group.type)}{' '}
              <span className="font-normal text-muted-foreground">({group.rows.length})</span>
            </h3>
            {renderTable(group.rows, sort, onSort)}
          </div>
        ))}
      </div>
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
            : `${activeProducts.length} active, ${discontinuedProducts.length} discontinued - click a row to expand fee/penalty rules and version history.`}
        </p>
      </div>

      <Tabs value={pageTab} onValueChange={(v) => setPageTab(v as 'catalog' | 'product-types')}>
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="product-types">Product Types</TabsTrigger>
        </TabsList>
      </Tabs>

      {pageTab === 'product-types' ? (
        <ProductTypesTab />
      ) : (
        <>
          {productsQuery.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> Could not load loan products. Is the backend running?
            </div>
          )}

          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            Real product catalog, migrated from legacy data (CP12). A Loan Product Version is immutable once
            created — to change a product's rates, fees, or amounts, add a new Version and activate it; the old
            version stays on record so existing loans keep the rules that applied when they were made.
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Product Catalog</CardTitle>
              {canManageLoanProducts && (
                <Button size="sm" onClick={() => setAddProductOpen(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Product
                </Button>
              )}
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
                    {renderGroupedTables(activeSortState.sorted, activeSortState.sort, activeSortState.toggleSort)}
                  </TabsContent>
                  <TabsContent value="discontinued">
                    <p className="mb-3 text-xs text-muted-foreground">
                      These products have no currently-active version but remain visible because real client loans still reference them.
                    </p>
                    {renderGroupedTables(discontinuedSortState.sorted, discontinuedSortState.sort, discontinuedSortState.toggleSort)}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          <RecentActivityPanel label="Loan Products" />
        </>
      )}

      <AddLoanProductDialog open={addProductOpen} onOpenChange={setAddProductOpen} />
      {addVersionForProduct && (
        <AddLoanProductVersionDialog
          open
          onOpenChange={(open) => !open && setAddVersionForProduct(null)}
          loanProductId={addVersionForProduct.id}
          loanProductName={addVersionForProduct.name}
          nextVersionNumber={addVersionForProduct.nextVersionNumber}
        />
      )}
    </div>
  );
}
