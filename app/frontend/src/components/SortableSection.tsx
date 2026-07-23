import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Wraps one reorderable page section (a Card, or a component that renders its own Card) with a
 * drag handle in its top-left corner. The handle is the only draggable surface - buttons, links,
 * and text inputs inside the section stay fully interactive, since only the handle itself has the
 * dnd-kit drag listeners attached. */
export function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-10 opacity-70')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder this section"
        className="absolute -left-1 top-4 z-10 flex h-7 w-7 -translate-x-full cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}
