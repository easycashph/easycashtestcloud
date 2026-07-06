import { Info } from 'lucide-react';

/**
 * Inline financial-term definition tooltip (hover or keyboard focus). Applies
 * the Investopedia practice of never showing a jargon figure without its
 * plain-language definition one gesture away. Definitions live in
 * `src/lib/financialGlossary.ts`.
 */
export function TermTip({ term, definition }: { term: string; definition: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`Definition of ${term}`}
        className="text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className="invisible absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-md border bg-popover p-3 text-left text-xs font-normal normal-case tracking-normal text-popover-foreground shadow-md group-focus-within:visible group-hover:visible"
      >
        <span className="mb-1 block font-semibold">{term}</span>
        {definition}
        <span className="mt-1.5 block text-[10px] text-muted-foreground">
          Standard lending-industry definition (as taught on Investopedia). Figures computed from sample data.
        </span>
      </span>
    </span>
  );
}
