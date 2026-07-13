import { Lock, Unlock } from 'lucide-react';

/**
 * Safety toggle for Edit forms: a field starts locked (disabled) and must be
 * explicitly unlocked before it can be changed, so an edit session can't
 * silently overwrite the wrong field (e.g. typing into Email when Company ID
 * was meant). Not used on Add/Create forms - there's nothing to accidentally
 * overwrite yet.
 */
export function FieldLockToggle({ unlocked, onToggle }: { unlocked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {unlocked ? (
        <>
          <Unlock className="h-3 w-3" /> Editable
        </>
      ) : (
        <>
          <Lock className="h-3 w-3" /> Click to edit
        </>
      )}
    </button>
  );
}
