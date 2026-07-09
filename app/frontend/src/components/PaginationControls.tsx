import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PaginationControls({
  pageNumber,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  pageSize,
  itemCount,
}: {
  pageNumber: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  pageSize: number;
  itemCount: number;
}) {
  if (pageNumber === 1 && !hasNext) return null;

  return (
    <div className="flex items-center justify-between border-t pt-3">
      <p className="text-xs text-muted-foreground">
        Page {pageNumber} · {itemCount} of up to {pageSize} shown
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
          Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
