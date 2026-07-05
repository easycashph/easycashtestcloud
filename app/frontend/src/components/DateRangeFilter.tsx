import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Real, working date-range control — filters an already-precomputed mock
 * dataset client-side (see `src/lib/mockData.ts`'s `DAILY_REPORT_ROWS`).
 * Does not call any backend; the "period" it selects over is fixed sample
 * data, per this checkpoint's interactivity requirement.
 */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (next: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="date-from" className="text-xs">
          From
        </Label>
        <Input id="date-from" type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-40" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date-to" className="text-xs">
          To
        </Label>
        <Input id="date-to" type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-40" />
      </div>
    </div>
  );
}
