import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { apiClient } from '@/lib/apiClient';
import type { CollectionReportRow, ReportGranularity } from '@/lib/reportApiTypes';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate, formatPeso, pesoTooltipFormatter } from '@/lib/utils';

function getSortValue(row: CollectionReportRow, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'period':
      return row.period;
    case 'amountCollected':
      return Number(row.amountCollected);
    default:
      return undefined;
  }
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function useCollectionReport(granularity: ReportGranularity, from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'collections', granularity, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ granularity });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return apiClient.get<{ items: CollectionReportRow[] }>(`/reports/collections?${params.toString()}`);
    },
  });
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" /> {message}
    </div>
  );
}

function DailyCollectionReport() {
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 13 * 86_400_000);
    return { from: isoDate(from), to: isoDate(to) };
  });

  const query = useCollectionReport('DAILY', range.from || undefined, range.to || undefined);
  const rows = query.data?.items ?? [];
  const totalCollected = rows.reduce((sum, r) => sum + Number(r.amountCollected), 0);
  const { sorted: sortedRows, sort, toggleSort } = useSortableTable(rows, getSortValue, { key: 'period', direction: 'desc' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
      {query.isError && <ErrorBanner message="Could not load the collection report. Is the backend running?" />}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="period" tickFormatter={(d: string) => formatDate(d)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
            <Tooltip labelFormatter={(d) => formatDate(d as string)} formatter={pesoTooltipFormatter} />
            <Line
              type="monotone"
              dataKey={(row: CollectionReportRow) => Number(row.amountCollected)}
              name="Collected"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="period" currentSort={sort} onSort={toggleSort} isDateColumn>
              Date
            </SortableTableHead>
            <SortableTableHead sortKey="amountCollected" currentSort={sort} onSort={toggleSort} className="text-right">
              Collected
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.period}>
              <TableCell>{formatDate(row.period)}</TableCell>
              <TableCell className="text-right">{formatPeso(Number(row.amountCollected))}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                {query.isLoading ? 'Loading…' : 'No collections in this date range.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{formatPeso(totalCollected)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function PeriodCollectionReport({ granularity, from }: { granularity: 'MONTHLY' | 'YEARLY'; from: string }) {
  const query = useCollectionReport(granularity, from);
  const rows = query.data?.items ?? [];
  const totalCollected = rows.reduce((sum, r) => sum + Number(r.amountCollected), 0);
  const { sorted: sortedRows, sort, toggleSort } = useSortableTable(rows, getSortValue, { key: null, direction: 'asc' });

  return (
    <div className="space-y-4">
      {query.isError && <ErrorBanner message="Could not load the collection report. Is the backend running?" />}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={pesoTooltipFormatter} />
            <Line
              type="monotone"
              dataKey={(row: CollectionReportRow) => Number(row.amountCollected)}
              name="Collected"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="period" currentSort={sort} onSort={toggleSort}>
              Period
            </SortableTableHead>
            <SortableTableHead sortKey="amountCollected" currentSort={sort} onSort={toggleSort} className="text-right">
              Collected
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.period}>
              <TableCell>{row.period}</TableCell>
              <TableCell className="text-right">{formatPeso(Number(row.amountCollected))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{formatPeso(totalCollected)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

/**
 * Wired to the real backend (`GET /reports/collections`) — sums `REPAYMENT` transactions per
 * period. Drops the mock version's Target/% of Target columns: there's no collection-target/quota
 * concept anywhere in the backend (no config table, no field) — showing a fabricated target would
 * violate CLAUDE.md's "never invent business rules." Branch scoping is automatic from the
 * signed-in session, matching Dashboard/Payment Reminders.
 */
export function CollectionReportPage() {
  useLogPageView('Collection Report');
  const twelveMonthsAgo = React.useMemo(() => isoDate(new Date(Date.now() - 365 * 86_400_000)), []);
  const fourYearsAgo = React.useMemo(() => isoDate(new Date(Date.now() - 4 * 365 * 86_400_000)), []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Collection Report</h2>
        <p className="text-sm text-muted-foreground">Real collections (REPAYMENT transactions), filterable by period.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collections Performance</CardTitle>
          <CardDescription>Switch tabs for a different reporting granularity.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="daily">
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
            <TabsContent value="daily">
              <DailyCollectionReport />
            </TabsContent>
            <TabsContent value="monthly">
              <PeriodCollectionReport granularity="MONTHLY" from={twelveMonthsAgo} />
            </TabsContent>
            <TabsContent value="yearly">
              <PeriodCollectionReport granularity="YEARLY" from={fourYearsAgo} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Collection Report')} title="Recent Activity — Collection Report" />
    </div>
  );
}
