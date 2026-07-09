import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
import type { OriginationReportRow, ReportGranularity } from '@/lib/reportApiTypes';
import { MOCK_ACTIVITY_LOGS } from '@/lib/mockData';
import { formatDate, formatPeso, pesoTooltipFormatter } from '@/lib/utils';

function getSortValue(row: OriginationReportRow, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'period':
      return row.period;
    case 'loansOriginated':
      return row.loansOriginated;
    case 'amountOriginated':
      return Number(row.amountOriginated);
    default:
      return undefined;
  }
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function useOriginationReport(granularity: ReportGranularity, from?: string, to?: string) {
  return useQuery({
    queryKey: ['reports', 'loan-origination', granularity, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ granularity });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return apiClient.get<{ items: OriginationReportRow[] }>(`/reports/loan-origination?${params.toString()}`);
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

function DailyLoanReport() {
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 13 * 86_400_000);
    return { from: isoDate(from), to: isoDate(to) };
  });

  const query = useOriginationReport('DAILY', range.from || undefined, range.to || undefined);
  const rows = query.data?.items ?? [];
  const totalLoans = rows.reduce((sum, r) => sum + r.loansOriginated, 0);
  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amountOriginated), 0);
  const { sorted: sortedRows, sort, toggleSort } = useSortableTable(rows, getSortValue, { key: 'period', direction: 'desc' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
      {query.isError && <ErrorBanner message="Could not load the loan origination report. Is the backend running?" />}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="period" tickFormatter={(d: string) => formatDate(d)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(d) => formatDate(d as string)} />
            <Bar dataKey="loansOriginated" name="Loans Originated" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="period" currentSort={sort} onSort={toggleSort} isDateColumn>
              Date
            </SortableTableHead>
            <SortableTableHead sortKey="loansOriginated" currentSort={sort} onSort={toggleSort} className="text-right">
              Loans Originated
            </SortableTableHead>
            <SortableTableHead sortKey="amountOriginated" currentSort={sort} onSort={toggleSort} className="text-right">
              Amount Originated
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.period}>
              <TableCell>{formatDate(row.period)}</TableCell>
              <TableCell className="text-right">{row.loansOriginated}</TableCell>
              <TableCell className="text-right">{formatPeso(Number(row.amountOriginated))}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                {query.isLoading ? 'Loading…' : 'No loans originated in this date range.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totalLoans}</TableCell>
            <TableCell className="text-right">{formatPeso(totalAmount)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function PeriodLoanReport({ granularity, from }: { granularity: 'MONTHLY' | 'YEARLY'; from: string }) {
  const query = useOriginationReport(granularity, from);
  const rows = query.data?.items ?? [];
  const totalLoans = rows.reduce((sum, r) => sum + r.loansOriginated, 0);
  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amountOriginated), 0);
  const { sorted: sortedRows, sort, toggleSort } = useSortableTable(rows, getSortValue, { key: null, direction: 'asc' });

  return (
    <div className="space-y-4">
      {query.isError && <ErrorBanner message="Could not load the loan origination report. Is the backend running?" />}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={pesoTooltipFormatter} />
            <Bar dataKey="amountOriginated" name="Amount Originated" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="period" currentSort={sort} onSort={toggleSort}>
              Period
            </SortableTableHead>
            <SortableTableHead sortKey="loansOriginated" currentSort={sort} onSort={toggleSort} className="text-right">
              Loans Originated
            </SortableTableHead>
            <SortableTableHead sortKey="amountOriginated" currentSort={sort} onSort={toggleSort} className="text-right">
              Amount Originated
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.period}>
              <TableCell>{row.period}</TableCell>
              <TableCell className="text-right">{row.loansOriginated}</TableCell>
              <TableCell className="text-right">{formatPeso(Number(row.amountOriginated))}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                {query.isLoading ? 'Loading…' : 'No loans originated in this period.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totalLoans}</TableCell>
            <TableCell className="text-right">{formatPeso(totalAmount)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

/** Wired to the real backend (`GET /reports/loan-origination`) — branch scoping is automatic from the signed-in session (MIS sees every branch, everyone else sees their own), matching Dashboard/Payment Reminders rather than offering a manual branch picker. */
export function LoanReportPage() {
  useLogPageView('Loan Report');
  const twelveMonthsAgo = React.useMemo(() => isoDate(new Date(Date.now() - 365 * 86_400_000)), []);
  const fourYearsAgo = React.useMemo(() => isoDate(new Date(Date.now() - 4 * 365 * 86_400_000)), []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Loan Report</h2>
        <p className="text-sm text-muted-foreground">Loan origination volume and amount, filterable by period.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Origination Volume</CardTitle>
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
              <DailyLoanReport />
            </TabsContent>
            <TabsContent value="monthly">
              <PeriodLoanReport granularity="MONTHLY" from={twelveMonthsAgo} />
            </TabsContent>
            <TabsContent value="yearly">
              <PeriodLoanReport granularity="YEARLY" from={fourYearsAgo} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Loan Report')} title="Recent Activity — Loan Report" />
    </div>
  );
}
