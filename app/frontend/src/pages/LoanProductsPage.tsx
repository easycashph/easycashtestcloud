import * as React from 'react';
import { ChevronDown, ChevronRight, FileText, Pencil, Plus, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable, type SortState } from '@/lib/useSortableTable';
import { MOCK_ACTIVITY_LOGS, MOCK_LOAN_PRODUCTS, type MockDocumentTemplate, type MockLoanProduct } from '@/lib/mockData';
import { formatPeso } from '@/lib/utils';

function getProductSortValue(p: MockLoanProduct, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'productName':
      return p.productName;
    case 'interestCalculationMethod':
      return p.interestCalculationMethod;
    case 'loanAmountMin':
      return p.loanAmountMin;
    case 'installmentCountMin':
      return p.installmentCountMin;
    case 'minInterestRate':
      return p.minInterestRate;
    case 'isActive':
      return p.isActive ? 1 : 0;
    default:
      return undefined;
  }
}

/**
 * All product edits/creates below are held in local React state only — they
 * are never sent anywhere (`app/backend` is not touched by this preview) and
 * reset on page reload. This is intentional: the goal is to demonstrate the
 * form/interaction flow, not to persist product configuration.
 */
function emptyDraftProduct(): MockLoanProduct {
  return {
    id: `product-draft-${Date.now()}`,
    productCode: '',
    productName: '',
    versionNumber: 1,
    isActive: true,
    interestCalculationMethod: 'DECLINING_BALANCE',
    daysInYearConvention: 'E30_360',
    repaymentPeriodUnit: 'MONTHS',
    loanAmountMin: 10000,
    loanAmountMax: 100000,
    installmentCountMin: 3,
    installmentCountMax: 12,
    gracePeriodDefaultDays: 5,
    roundingMethod: 'ROUND_REMAINDER_INTO_LAST_REPAYMENT',
    defaultInterestRate: 3,
    minInterestRate: 2,
    maxInterestRate: 5,
    penaltyRule: { ratePercent: 5, gracePeriodDays: 5 },
    feeRules: [{ name: 'Processing Fee', computation: 'PERCENT_OF_PRINCIPAL', value: 2 }],
    documentTemplates: [],
  };
}

function ProductForm({
  value,
  onChange,
}: {
  value: MockLoanProduct;
  onChange: (next: MockLoanProduct) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Product Name</Label>
        <Input value={value.productName} onChange={(e) => onChange({ ...value, productName: e.target.value })} placeholder="e.g. Salary Loan" />
      </div>
      <div className="space-y-1.5">
        <Label>Product Code</Label>
        <Input value={value.productCode} onChange={(e) => onChange({ ...value, productCode: e.target.value })} placeholder="e.g. SL-REGULAR" />
      </div>
      <div className="space-y-1.5">
        <Label>Interest Calculation Method</Label>
        <Select
          value={value.interestCalculationMethod}
          onValueChange={(v) => onChange({ ...value, interestCalculationMethod: v as MockLoanProduct['interestCalculationMethod'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DECLINING_BALANCE">Declining Balance</SelectItem>
            <SelectItem value="DECLINING_BALANCE_DISCOUNTED">Declining Balance (Discounted)</SelectItem>
            <SelectItem value="FLAT">Flat</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Rounding Method</Label>
        <Select value={value.roundingMethod} onValueChange={(v) => onChange({ ...value, roundingMethod: v as MockLoanProduct['roundingMethod'] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ROUND_REMAINDER_INTO_LAST_REPAYMENT">Round Remainder Into Last Repayment</SelectItem>
            <SelectItem value="NO_ROUNDING">No Rounding</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Loan Amount Min</Label>
        <Input
          type="number"
          value={value.loanAmountMin}
          onChange={(e) => onChange({ ...value, loanAmountMin: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Loan Amount Max</Label>
        <Input
          type="number"
          value={value.loanAmountMax}
          onChange={(e) => onChange({ ...value, loanAmountMax: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Installments Min</Label>
        <Input
          type="number"
          value={value.installmentCountMin}
          onChange={(e) => onChange({ ...value, installmentCountMin: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Installments Max</Label>
        <Input
          type="number"
          value={value.installmentCountMax}
          onChange={(e) => onChange({ ...value, installmentCountMax: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Default Interest Rate (% monthly)</Label>
        <Input
          type="number"
          step="0.01"
          value={value.defaultInterestRate}
          onChange={(e) => onChange({ ...value, defaultInterestRate: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Grace Period (days)</Label>
        <Input
          type="number"
          value={value.gracePeriodDefaultDays}
          onChange={(e) => onChange({ ...value, gracePeriodDefaultDays: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Penalty Rate (%)</Label>
        <Input
          type="number"
          step="0.01"
          value={value.penaltyRule.ratePercent}
          onChange={(e) => onChange({ ...value, penaltyRule: { ...value.penaltyRule, ratePercent: Number(e.target.value) } })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Processing Fee (% of principal)</Label>
        <Input
          type="number"
          step="0.01"
          value={value.feeRules[0]?.value ?? 0}
          onChange={(e) =>
            onChange({
              ...value,
              feeRules: [{ name: 'Processing Fee', computation: 'PERCENT_OF_PRINCIPAL', value: Number(e.target.value) }],
            })
          }
        />
      </div>
    </div>
  );
}

export function LoanProductsPage() {
  useLogPageView('Loan Products');
  const [products, setProducts] = React.useState<MockLoanProduct[]>(MOCK_LOAN_PRODUCTS);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<MockLoanProduct>(emptyDraftProduct());
  const [editingProduct, setEditingProduct] = React.useState<MockLoanProduct | null>(null);
  const [editingTemplate, setEditingTemplate] = React.useState<{ productId: string; template: MockDocumentTemplate } | null>(null);

  const saveEditedTemplate = (next: MockDocumentTemplate) => {
    if (!editingTemplate) return;
    setProducts((prev) =>
      prev.map((p) =>
        p.id === editingTemplate.productId
          ? { ...p, documentTemplates: p.documentTemplates.map((t) => (t.code === next.code ? next : t)) }
          : p,
      ),
    );
    setEditingTemplate(null);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeProducts = products.filter((p) => p.isActive);
  const discontinuedProducts = products.filter((p) => !p.isActive);
  const activeSortState = useSortableTable(activeProducts, getProductSortValue, { key: null, direction: 'asc' });
  const discontinuedSortState = useSortableTable(discontinuedProducts, getProductSortValue, { key: null, direction: 'asc' });

  const openAddDialog = () => {
    setDraft(emptyDraftProduct());
    setAddOpen(true);
  };

  const saveNewProduct = () => {
    setProducts((prev) => [...prev, { ...draft, versionNumber: 1, isActive: true }]);
    setAddOpen(false);
  };

  const saveEditedProduct = () => {
    if (!editingProduct) return;
    setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? editingProduct : p)));
    setEditingProduct(null);
  };

  function renderProductRow(p: MockLoanProduct, variant: 'active' | 'discontinued', indented: boolean) {
    const isOpen = expanded.has(p.id);
    return (
      <React.Fragment key={p.id}>
        <TableRow className="cursor-pointer" onClick={() => toggle(p.id)}>
          <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
          <TableCell className={indented ? 'pl-8' : undefined}>
            <p className="font-medium">{p.productName}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {p.productCode} · v{p.versionNumber}
            </p>
          </TableCell>
          <TableCell className="text-sm">{p.interestCalculationMethod.replaceAll('_', ' ')}</TableCell>
          <TableCell className="text-right text-sm">
            {formatPeso(p.loanAmountMin)} – {formatPeso(p.loanAmountMax)}
          </TableCell>
          <TableCell className="text-right text-sm">
            {p.installmentCountMin}–{p.installmentCountMax} mos
          </TableCell>
          <TableCell className="text-right text-sm">
            {p.minInterestRate}% – {p.maxInterestRate}%
          </TableCell>
          <TableCell>
            <Badge variant={p.isActive ? 'success' : 'secondary'}>{p.isActive ? 'Active' : 'Discontinued'}</Badge>
          </TableCell>
          {variant === 'active' && (
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingProduct(p);
                }}
              >
                <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Customize
              </Button>
            </TableCell>
          )}
        </TableRow>
        {isOpen && (
          <TableRow>
            <TableCell colSpan={variant === 'active' ? 8 : 7} className="bg-secondary/30">
              <div className="grid gap-4 p-2 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Default Rate</p>
                  <p className="text-sm font-semibold">{p.defaultInterestRate}% monthly</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grace Period</p>
                  <p className="text-sm font-semibold">{p.gracePeriodDefaultDays} days</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rounding Method</p>
                  <p className="text-sm font-semibold">{p.roundingMethod.replaceAll('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Penalty Rule</p>
                  <p className="text-sm font-semibold">
                    {p.penaltyRule.ratePercent}% after {p.penaltyRule.gracePeriodDays}-day grace
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fee Rules</p>
                  {p.feeRules.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">No fee configuration on record.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {p.feeRules.map((fee) => (
                        <li key={fee.name} className="flex items-center justify-between">
                          <span>{fee.name}</span>
                          <span className="font-medium">{fee.computation === 'FLAT' ? formatPeso(fee.value) : `${fee.value}%`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="sm:col-span-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Loan Document Templates</p>
                  {p.documentTemplates.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">No document templates configured.</p>
                  ) : (
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {p.documentTemplates.map((template) => (
                        <li key={template.code} className="flex items-center justify-between gap-2 rounded-md border bg-background p-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{template.name}</p>
                              <p className="font-mono text-xs text-muted-foreground">{template.code}</p>
                            </div>
                          </div>
                          {variant === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTemplate({ productId: p.id, template });
                              }}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Generated automatically for every activated loan account under this product — see the loan account's Attachments
                    tab. Adapted from the company's real legacy Word templates.
                  </p>
                </div>
                {p.legacyNote && (
                  <div className="sm:col-span-3 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                    {p.legacyNote}
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  }

  function renderDiscontinuedTable(rows: MockLoanProduct[], sort: SortState, onSort: (key: string, isDateColumn?: boolean) => void) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <SortableTableHead sortKey="productName" currentSort={sort} onSort={onSort}>
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
        <TableBody>{rows.map((p) => renderProductRow(p, 'discontinued', false))}</TableBody>
      </Table>
    );
  }

  /**
   * Groups active products by `category` so each Category shows its
   * sub-types nested underneath (e.g. Salary Loan → Corporate/Regular/
   * Special). `rows` is expected to already be sorted (per the active
   * column sort) before grouping — `Map` preserves insertion order, so
   * pre-sorting the flat list means each category's sub-types land in
   * sorted order too, without disturbing the grouping itself.
   */
  function renderActiveTable(rows: MockLoanProduct[], sort: SortState, onSort: (key: string, isDateColumn?: boolean) => void) {
    const categories = new Map<string, MockLoanProduct[]>();
    for (const p of rows) {
      const key = p.category ?? p.productName;
      categories.set(key, [...(categories.get(key) ?? []), p]);
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <SortableTableHead sortKey="productName" currentSort={sort} onSort={onSort}>
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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...categories.entries()].map(([category, subTypes]) => (
            <React.Fragment key={category}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={8} className="py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category} <span className="font-normal normal-case">— {subTypes.length} sub-type{subTypes.length > 1 ? 's' : ''}</span>
                  </p>
                </TableCell>
              </TableRow>
              {subTypes.map((p) => renderProductRow(p, 'active', true))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Loan Products</h2>
          <p className="text-sm text-muted-foreground">
            {activeProducts.length} active sub-types across 3 categories, {discontinuedProducts.length} discontinued (real legacy product
            names, retained for existing loan reference). Click a row to expand fee/penalty rules.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" /> Add New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Loan Product</DialogTitle>
              <DialogDescription>
                Preview only — added products are held in this browser tab's memory and are not saved anywhere.
              </DialogDescription>
            </DialogHeader>
            <ProductForm value={draft} onChange={setDraft} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveNewProduct} disabled={!draft.productName || !draft.productCode}>
                Add Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active ({activeProducts.length})</TabsTrigger>
              <TabsTrigger value="discontinued">Discontinued ({discontinuedProducts.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              {renderActiveTable(activeSortState.sorted, activeSortState.sort, activeSortState.toggleSort)}
            </TabsContent>
            <TabsContent value="discontinued">
              <p className="mb-3 text-xs text-muted-foreground">
                These products are no longer offered for new loans but remain visible because real client loans still reference them.
              </p>
              {renderDiscontinuedTable(discontinuedSortState.sorted, discontinuedSortState.sort, discontinuedSortState.toggleSort)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Loan Products')} title="Recent Activity — Loan Products" />

      <Dialog open={editingProduct !== null} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customize Product Details</DialogTitle>
            <DialogDescription>
              Preview only — changes update this browser tab's in-memory copy and are not saved anywhere.
            </DialogDescription>
          </DialogHeader>
          {editingProduct && <ProductForm value={editingProduct} onChange={setEditingProduct} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditedProduct}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditTemplateDialog editingTemplate={editingTemplate} onClose={() => setEditingTemplate(null)} onSave={saveEditedTemplate} />
    </div>
  );
}

function EditTemplateDialog({
  editingTemplate,
  onClose,
  onSave,
}: {
  editingTemplate: { productId: string; template: MockDocumentTemplate } | null;
  onClose: () => void;
  onSave: (next: MockDocumentTemplate) => void;
}) {
  const [draft, setDraft] = React.useState<MockDocumentTemplate | null>(editingTemplate?.template ?? null);

  React.useEffect(() => {
    setDraft(editingTemplate?.template ?? null);
  }, [editingTemplate]);

  return (
    <Dialog open={editingTemplate !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Document Template</DialogTitle>
          <DialogDescription>
            Preview only — changes update this browser tab's in-memory copy and are not saved anywhere. Use <code>{'{{FieldName}}'}</code>{' '}
            tokens for merge fields filled in per loan account.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Template Body</Label>
              <Textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={12} className="font-mono text-xs" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => draft && onSave(draft)}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
