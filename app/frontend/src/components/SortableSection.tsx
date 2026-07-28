import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

/** Wraps one reorderable page section (a Card, or a component that renders its own Card) with a
 * drag handle in its top-left corner. The handle is the only draggable surface - buttons, links,
 * and text inputs inside the section stay fully interactive, since only the handle itself has the
 * dnd-kit drag listeners attached.
 *
 * 2026-07-25 fix: the handle used to sit outside the card (`-translate-x-full`), which only had
 * room to render on a single-column page (LoanDetailPage). On a 2-column grid (ClientProfilePage,
 * LoanApplicationDetailPage) the left-column card's handle had nowhere to go - it either clipped
 * off the page edge or landed in the narrow grid gap under the neighboring card, making it
 * effectively unclickable. Now it sits inside the card's own top-left corner instead, so it works
 * in any column layout. */
export function SortableSection({
  id,
  children,
  fullWidth,
}: {
  id: string;
  children: React.ReactNode;
  /** For a section rendered inside a multi-column grid (ClientProfilePage, LoanApplicationDetailPage)
   * that's too dense/wide for a half column - e.g. Underwriting's nested decision-scoring and
   * document-checklist sections. No effect on a single-column page. */
  fullWidth?: boolean;
}) {
  const { dragReorderEnabled } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !dragReorderEnabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative', fullWidth && 'lg:col-span-2', isDragging && 'z-10 opacity-70')}
    >
      {dragReorderEnabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder this section"
          className="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}
