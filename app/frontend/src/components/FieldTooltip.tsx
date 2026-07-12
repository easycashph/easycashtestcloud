import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Small info-icon + hover tooltip for form field labels - explains what to
 * enter or why a field matters, without cluttering the label itself.
 */
export function FieldTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger type="button" className="inline-flex align-middle text-muted-foreground hover:text-foreground" tabIndex={-1}>
        <Info className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
