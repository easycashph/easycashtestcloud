import type { ButtonProps } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Wraps any action the preview build does not actually perform (nothing in
 * this app calls app/backend). Always disabled, always visibly labeled, so
 * nobody mistakes it for a working control — per this checkpoint's explicit
 * requirement to never let a non-functional button pretend to work.
 */
export function ComingSoonButton({ className, children, ...props }: ButtonProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <Button disabled className={cn('cursor-not-allowed', className)} {...props}>
        {children}
      </Button>
      <Badge variant="outline" className="text-muted-foreground">
        Coming Soon
      </Badge>
    </span>
  );
}
