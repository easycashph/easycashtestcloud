import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortState } from '@/lib/useSortableTable';

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSort: SortState;
  onSort: (key: string, isDateColumn?: boolean) => void;
  /** Marks this column as a Date column — clicking it the first time defaults to recent-to-oldest (desc), per the standing column-filter requirement. */
  isDateColumn?: boolean;
  children: React.ReactNode;
}

/** Clickable `TableHead` with a sort-direction indicator — the shared building block for every sortable table column across the LMS preview. */
export function SortableTableHead({ sortKey, currentSort, onSort, isDateColumn, className, children, ...props }: SortableTableHeadProps) {
  const isActive = currentSort.key === sortKey;
  const Icon = isActive ? (currentSort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead
      role="columnheader"
      aria-sort={isActive ? (currentSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('cursor-pointer select-none whitespace-nowrap hover:text-foreground', className)}
      onClick={() => onSort(sortKey, isDateColumn)}
      {...props}
    >
      <span className={cn('inline-flex items-center gap-1', className?.includes('text-right') && 'justify-end')}>
        {children}
        <Icon className={cn('h-3 w-3 shrink-0', isActive ? 'opacity-100' : 'opacity-30')} />
      </span>
    </TableHead>
  );
}
