import * as React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilter, type DateRange } from '@/components/DateRangeFilter';
import { RecentActivityPanel } from '@/components/RecentActivityPanel';
import { useLogPageView } from '@/lib/activityLog';
import { useSortableTable } from '@/lib/useSortableTable';
import { DAILY_REPORT_ROWS, MOCK_ACTIVITY_LOGS, MONTHLY_REPORT_ROWS, REPORT_BRANCHES, YEARLY_REPORT_ROWS } from '@/lib/mockData';
import { formatDate, formatPeso, pesoTooltipFormatter } from '@/lib/utils';

interface DailyRow {
  date: string;
  amountCollected: number;
  collectionTarget: number;
}

function getDailyRowSortValue(row: DailyRow, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'date':
      return new Date(row.date);
    case 'amountCollected':
      return row.amountCollected;
    case 'collectionTarget':
      return row.collectionTarget;
    case 'percentOfTarget':
      return row.collectionTarget === 0 ? 0 : row.amountCollected / row.collectionTarget;
    default:
      return undefined;
  }
}

interface PeriodRow {
  label: string;
  amountCollected: number;
  collectionTarget: number;
}

function getPeriodRowSortValue(row: PeriodRow, key: string): string | number | Date | null | undefined {
  switch (key) {
    case 'label':
      return row.label;
    case 'amountCollected':
      return row.amountCollected;
    case 'collectionTarget':
      return row.collectionTarget;
    case 'percentOfTarget':
      return row.collectionTarget === 0 ? 0 : row.amountCollected / row.collectionTarget;
    default:
      return undefined;
  }
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function useBranchFilter() {
  const [branchId, setBranchId] = React.useState<string>('ALL');
  return { branchId, setBranchId };
}

function BranchSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-56">
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
  );
}

function DailyCollectionReport() {
  const { branchId, setBranchId } = useBranchFilter();
  const [range, setRange] = React.useState<DateRange>(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 13 * 86_400_000);
    return { from: isoDate(from), to: isoDate(to) };
  });

  const filtered = DAILY_REPORT_ROWS.filter((row) => {
    const day = row.date.slice(0, 10);
    const matchesBranch = branchId === 'ALL' || row.branchId === branchId;
    const matchesRange = (!range.from || day >= range.from) && (!range.to || day <= range.to);
    return matchesBranch && matchesRange;
  });

  const byDay = new Map<string, { date: string; amountCollected: number; collectionTarget: number }>();
  for (const row of filtered) {
    const key = row.date.slice(0, 10);
    const entry = byDay.get(key) ?? { date: row.date, amountCollected: 0, collectionTarget: 0 };
    entry.amountCollected += row.amountCollected;
    entry.collectionTarget += row.collectionTarget;
    byDay.set(key, entry);
  }
  const rows = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totalCollected = rows.reduce((sum, r) => sum + r.amountCollected, 0);
  const totalTarget = rows.reduce((sum, r) => sum + r.collectionTarget, 0);
  // The chart above always stays chronological (a trend line reversed
  // would be confusing); only the table below is independently sortable —
  // Date defaults to recent-to-oldest per the standing requirement.
  const { sorted: sortedRows, sort, toggleSort } = useSortableTable(rows, getDailyRowSortValue, { key: 'date', direction: 'desc' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter value={range} onChange={setRange} />
        <BranchSelect value={branchId} onChange={setBranchId} />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tickFormatter={(d: string) => formatDate(d)} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
            <Tooltip labelFormatter={(d) => formatDate(d as string)} formatter={pesoTooltipFormatter} />
            <Line type="monotone" dataKey="collectionTarget" name="Target" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="amountCollected" name="Collected" stroke="hsl(var(--chart-3))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="date" currentSort={sort} onSort={toggleSort} isDateColumn>
              Date
            </SortableTableHead>
            <SortableTableHead sortKey="amountCollected" currentSort={sort} onSort={toggleSort} className="text-right">
              Collected
            </SortableTableHead>
            <SortableTableHead sortKey="collectionTarget" currentSort={sort} onSort={toggleSort} className="text-right">
              Target
            </SortableTableHead>
            <SortableTableHead sortKey="percentOfTarget" currentSort={sort} onSort={toggleSort} className="text-right">
              % of Target
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.date}>
              <TableCell>{formatDate(row.date)}</TableCell>
              <TableCell className="text-right">{formatPeso(row.amountCollected)}</TableCell>
              <TableCell className="text-right">{formatPeso(row.collectionTarget)}</TableCell>
              <TableCell className="text-right">{((row.amountCollected / row.collectionTarget) * 100).toFixed(0)}%</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                No sample data in this date range.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{formatPeso(totalCollected)}</TableCell>
            <TableCell className="text-right">{formatPeso(totalTarget)}</TableCell>
            <TableCell className="text-right">{totalTarget > 0 ? ((totalCollected / totalTarget) * 100).toFixed(0) : 0}%</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function PeriodCollectionReport({ rows: allRows }: { rows: typeof MONTHLY_REPORT_ROWS }) {
  const { branchId, setBranchId } = useBranchFilter();
  const filtered = allRows.filter((r) => branchId === 'ALL' || r.branchId === branchId);

  const byLabel = new Map<string, { label: string; amountCollected: number; collectionTarget: number }>();
  for (const row of filtered) {
    const entry = byLabel.get(row.label) ?? { label: row.label, amountCollected: 0, collectionTarget: 0 };
    entry.amountCollected += row.amountCollected;
    entry.collectionTarget += row.collectionTarget;
    byLabel.set(row.label, entry);
  }
  const rows = [...byLabel.values()];
  const totalCollected = rows.reduce((sum, r) => sum + r.amountCollected, 0);
  const totalTarget = rows.reduce((sum, r) => sum + r.collectionTarget, 0);
  const { sorted: sortedRows, sort, toggleSort } = useSortableTable(rows, getPeriodRowSortValue, { key: null, direction: 'asc' });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BranchSelect value={branchId} onChange={setBranchId} />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={pesoTooltipFormatter} />
            <Line type="monotone" dataKey="collectionTarget" name="Target" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="amountCollected" name="Collected" stroke="hsl(var(--chart-3))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="label" currentSort={sort} onSort={toggleSort}>
              Period
            </SortableTableHead>
            <SortableTableHead sortKey="amountCollected" currentSort={sort} onSort={toggleSort} className="text-right">
              Collected
            </SortableTableHead>
            <SortableTableHead sortKey="collectionTarget" currentSort={sort} onSort={toggleSort} className="text-right">
              Target
            </SortableTableHead>
            <SortableTableHead sortKey="percentOfTarget" currentSort={sort} onSort={toggleSort} className="text-right">
              % of Target
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="text-right">{formatPeso(row.amountCollected)}</TableCell>
              <TableCell className="text-right">{formatPeso(row.collectionTarget)}</TableCell>
              <TableCell className="text-right">{((row.amountCollected / row.collectionTarget) * 100).toFixed(0)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{formatPeso(totalCollected)}</TableCell>
            <TableCell className="text-right">{formatPeso(totalTarget)}</TableCell>
            <TableCell className="text-right">{totalTarget > 0 ? ((totalCollected / totalTarget) * 100).toFixed(0) : 0}%</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export function CollectionReportPage() {
  useLogPageView('Collection Report');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Collection Report</h2>
        <p className="text-sm text-muted-foreground">Collections vs. target — sample data, filterable by period/branch.</p>
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
              <PeriodCollectionReport rows={MONTHLY_REPORT_ROWS} />
            </TabsContent>
            <TabsContent value="yearly">
              <PeriodCollectionReport rows={YEARLY_REPORT_ROWS} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <RecentActivityPanel entries={MOCK_ACTIVITY_LOGS.filter((l) => l.entityType === 'Collection Report')} title="Recent Activity — Collection Report" />
    </div>
  );
}
