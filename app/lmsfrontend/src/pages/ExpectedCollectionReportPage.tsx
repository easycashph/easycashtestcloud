import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, Columns3, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { ReportLoadingProgress } from '@/components/ReportLoadingProgress';
import { useLogPageView } from '@/lib/activityLog';
import { apiClient, downloadFile, fetchAllPages, ApiError } from '@/lib/apiClient';
import type { LoanProduct } from '@/lib/loanApiTypes';
import type { ExpectedCollectionReportRow } from '@/lib/reportApiTypes';
import { formatDate, formatPeso, isoDate } from '@/lib/utils';

/**
 * 2026-08-19 (user request): the remaining 9 of 17 columns, hidden by default - Client Name/
 * Product/Account ID/Due Date/Principal Due/Interest Due/Past Due Amount/Days Late stay
 * always-visible (the minimum needed to identify a row and its headline collection figures at a
 * glance), same convention as LoanReleasesReportPage's OPTIONAL_COLUMNS. Persisted per-browser via
 * localStorage, not per-user on the backend - a display preference, not worth a server round-trip.
 */
const OPTIONAL_COLUMNS = [
  { key: 'mobileNumber', label: 'Mobile Number' },
  { key: 'accountState', label: 'Account State' },
  { key: 'maturityDate', label: 'Maturity Date' },
  { key: 'lastPaidDate', label: 'Last Paid Date' },
  { key: 'principalPaid', label: 'Principal Paid' },
  { key: 'interestPaid', label: 'Interest Paid' },
  { key: 'monthDue', label: 'Month Due' },
  { key: 'repayment', label: 'Repayment' },
  { key: 'state', label: 'State' },
] as const;

type OptionalColumnKey = (typeof OPTIONAL_COLUMNS)[number]['key'];
const MONEY_COLUMN_KEYS = new Set<OptionalColumnKey>(['principalPaid', 'interestPaid', 'repayment']);
const DATE_COLUMN_KEYS = new Set<OptionalColumnKey>(['maturityDate', 'lastPaidDate']);

const COLUMN_VISIBILITY_STORAGE_KEY = 'expected-collection-report-visible-columns';

function loadColumnVisibility(): Record<OptionalColumnKey, boolean> {
  const defaults = Object.fromEntries(OPTIONAL_COLUMNS.map((c) => [c.key, false])) as Record<OptionalColumnKey, boolean>;
  try {
    const stored = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!stored) return defaults;
    return { ...defaults, ...JSON.parse(stored) };
  } catch {
    return defaults;
  }
}

function optionalCellValue(row: ExpectedCollectionReportRow, key: OptionalColumnKey): React.ReactNode {
  const value = row[key];
  if (value === null || value === undefined || value === '') return '—';
  if (DATE_COLUMN_KEYS.has(key)) return formatDate(value as string);
  if (MONEY_COLUMN_KEYS.has(key)) return formatPeso(Number(value));
  return String(value);
}

/**
 * Wired to the real backend (`GET /reports/expected-collection`, JSON counterpart of the existing
 * `.xlsx` export). On-screen table mirrors Loan Releases Report's shape (scrollable body, sticky
 * total row, column picker) - the `.xlsx` download always includes every column regardless of what's
 * toggled visible here, same "display preference, not a report-scope filter" posture.
 */
export function ExpectedCollectionReportPage() {
  useLogPageView('Expected Collection Report');
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return { from: isoDate(from), to: isoDate(to) };
  });
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = React.useState<Record<OptionalColumnKey, boolean>>(loadColumnVisibility);
  React.useEffect(() => {
    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);
  const toggleColumn = (key: OptionalColumnKey) => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  const visibleOptionalColumns = OPTIONAL_COLUMNS.filter((c) => visibleColumns[c.key]);

  /** 2026-08-20 (user request): multi-select Product filter, same pattern as Transaction Report's
   * type/channel filters - `productCodes` selected by `LoanProduct.code` (stable), displayed by
   * `name` (what the report's own Product column shows). Undefined/empty means every product. */
  const productsQuery = useQuery({
    queryKey: ['loan-products', 'for-report-filter'],
    queryFn: () => fetchAllPages<LoanProduct>('/loan-products'),
  });
  const productOptions = productsQuery.data ?? [];
  const [productCodes, setProductCodes] = React.useState<string[]>([]);
  const toggleProduct = (code: string) => {
    setProductCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };
  const productFilterLabel =
    productCodes.length === 0
      ? 'All products'
      : productCodes.length === 1
        ? (productOptions.find((p) => p.code === productCodes[0])?.name ?? productCodes[0]!)
        : `${productCodes.length} products selected`;

  const buildParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    for (const code of productCodes) params.append('product', code);
    return params;
  }, [range.from, range.to, productCodes]);

  const collectionQuery = useQuery({
    queryKey: ['reports', 'expected-collection', range.from, range.to, [...productCodes].sort().join(',')],
    queryFn: () => apiClient.get<{ items: ExpectedCollectionReportRow[] }>(`/reports/expected-collection?${buildParams().toString()}`),
  });
  const rows = collectionQuery.data?.items ?? [];

  const totals = rows.reduce(
    (acc, r) => {
      acc.principalDue += Number(r.principalDue);
      acc.interestDue += Number(r.interestDue);
      acc.pastDueAmount += Number(r.pastDueAmount);
      return acc;
    },
    { principalDue: 0, interestDue: 0, pastDueAmount: 0 },
  );

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const query = buildParams().toString();
      await downloadFile(`/reports/expected-collection.xlsx${query ? `?${query}` : ''}`, 'Expected Collection.xlsx');
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Expected Collection</h2>
        <p className="text-sm text-muted-foreground">What should come in and when - installments due in the selected date range.</p>
      </div>

      {(collectionQuery.isError || downloadError) && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {downloadError ?? 'Could not load the report. Check your connection and try again.'}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date range filters on installment due date, defaulting to the current month. Product filters by loan product, multiple selectable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter value={range} onChange={setRange} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-56 justify-between font-normal">
                  <span className="truncate">{productFilterLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              {/* Checkbox items keep the menu open on select, so several products can be ticked in one go. */}
              <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
                <DropdownMenuItem onSelect={() => setProductCodes([])}>All products</DropdownMenuItem>
                <DropdownMenuSeparator />
                {productOptions.map((product) => (
                  <DropdownMenuCheckboxItem
                    key={product.code}
                    checked={productCodes.includes(product.code)}
                    onCheckedChange={() => toggleProduct(product.code)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {product.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Columns3 className="mr-1.5 h-4 w-4" /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                <DropdownMenuLabel>Optional columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {OPTIONAL_COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={visibleColumns[column.key]}
                    onCheckedChange={() => toggleColumn(column.key)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleDownload} disabled={isDownloading} className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? 'Preparing…' : 'Download report'}
            </Button>
          </div>

          <div className="rounded-md border">
            <div className="max-h-[600px] overflow-auto">
              <Table containerClassName="w-full" className="text-xs [&_td]:whitespace-nowrap [&_td]:px-2 [&_td]:py-1.5">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Account ID</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Principal Due</TableHead>
                    <TableHead className="text-right">Interest Due</TableHead>
                    <TableHead className="text-right">Past Due Amount</TableHead>
                    <TableHead className="text-right">Days Late</TableHead>
                    {visibleOptionalColumns.map((c) => (
                      <TableHead key={c.key} className={MONEY_COLUMN_KEYS.has(c.key) ? 'text-right' : undefined}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collectionQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8 + visibleOptionalColumns.length} className="py-6">
                        <ReportLoadingProgress stages={['Fetching expected collections', 'Computing due amounts']} />
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8 + visibleOptionalColumns.length} className="text-center text-muted-foreground">
                        No installments due in this date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, idx) => (
                      <TableRow key={`${r.accountId}-${idx}`}>
                        <TableCell className="max-w-[180px] truncate font-medium" title={r.clientName}>
                          {r.clientName}
                        </TableCell>
                        <TableCell>{r.product}</TableCell>
                        <TableCell className="font-mono">{r.accountId}</TableCell>
                        <TableCell>{formatDate(r.dueDate)}</TableCell>
                        <TableCell className="text-right">{formatPeso(Number(r.principalDue))}</TableCell>
                        <TableCell className="text-right">{formatPeso(Number(r.interestDue))}</TableCell>
                        <TableCell className="text-right">{formatPeso(Number(r.pastDueAmount))}</TableCell>
                        <TableCell className="text-right">{r.daysLate}</TableCell>
                        {visibleOptionalColumns.map((c) => (
                          <TableCell key={c.key} className={MONEY_COLUMN_KEYS.has(c.key) ? 'text-right' : undefined}>
                            {optionalCellValue(r, c.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {rows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-10 bg-background">
                    <TableRow className="border-t-2 font-semibold hover:bg-transparent">
                      <TableCell colSpan={4}>Total ({rows.length} installment{rows.length === 1 ? '' : 's'})</TableCell>
                      <TableCell className="text-right">{formatPeso(totals.principalDue)}</TableCell>
                      <TableCell className="text-right">{formatPeso(totals.interestDue)}</TableCell>
                      <TableCell className="text-right">{formatPeso(totals.pastDueAmount)}</TableCell>
                      <TableCell />
                      {visibleOptionalColumns.map((c) => (
                        <TableCell key={c.key} />
                      ))}
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <RecentActivityPanel label="Expected Collection Report" />
    </div>
  );
}
