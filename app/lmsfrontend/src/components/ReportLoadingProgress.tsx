import * as React from 'react';
import { Check, CircleDashed, Loader2 } from 'lucide-react';

/**
 * Shared loading state for report pages (2026-08-30, rolled out from the CIC Monthly Report page
 * to every single-request report). One backend request, but each report genuinely does its work in
 * a small number of real phases (query, then compute derived figures) - stepping through named
 * stages gives an honest sense of progress instead of a bare spinner, without claiming a false
 * level of granularity. `stages` should name what THIS report's query is actually doing, not be a
 * generic placeholder - see each page's own usage for its specific wording.
 */
export function ReportLoadingProgress({ stages, isDone = false }: { stages: string[]; isDone?: boolean }) {
  const [stageIndex, setStageIndex] = React.useState(0);

  React.useEffect(() => {
    if (isDone) return;
    const interval = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, stages.length - 1));
    }, 800);
    return () => clearInterval(interval);
  }, [isDone, stages.length]);

  const progressPercent = isDone ? 100 : ((stageIndex + 0.5) / stages.length) * 100;

  return (
    <div className="mx-auto max-w-sm space-y-3 py-2">
      {stages.map((label, idx) => {
        const state = isDone || idx < stageIndex ? 'done' : idx === stageIndex ? 'active' : 'pending';
        return (
          <div
            key={label}
            className={`flex items-center gap-2 text-sm ${
              state === 'done' ? 'text-emerald-600' : state === 'active' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {state === 'done' ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : state === 'active' ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : (
              <CircleDashed className="h-4 w-4 shrink-0" />
            )}
            <span>{label}</span>
          </div>
        );
      })}
      <div className="h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  );
}
