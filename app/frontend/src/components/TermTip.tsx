import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Inline financial-term definition tooltip (hover or keyboard focus). Applies
 * the Investopedia practice of never showing a jargon figure without its
 * plain-language definition one gesture away. Definitions live in
 * `src/lib/financialGlossary.ts`.
 *
 * 2026-07-20 fix: was a hand-rolled `position: absolute` span, clipped whenever its trigger sat
 * near the edge of a scrollable container (e.g. `DialogContent`'s `overflow-y-auto` - see the
 * Member Profile dialog's Role field) - the description was rendered but visually cut off. Rebuilt
 * on the same `Tooltip`/`TooltipContent` (Radix, portal-rendered straight to `document.body`)
 * already used by `FieldTooltip` elsewhere, which escapes any ancestor's `overflow` entirely.
 */
export function TermTip({ term, definition }: { term: string; definition: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={`Definition of ${term}`}
        className="inline-flex align-middle text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <Info className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent className="w-64 max-w-64 text-left normal-case tracking-normal">
        <span className="mb-1 block font-semibold">{term}</span>
        {definition}
        <span className="mt-1.5 block text-[10px] text-muted-foreground">
          Standard lending-industry definition (as taught on Investopedia). Figures computed from sample data.
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
