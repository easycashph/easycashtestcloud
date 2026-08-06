import * as React from 'react';
import { cn } from '@/lib/utils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  fallbackIcon?: React.ReactNode;
}

/** Renders `src` if it loads; otherwise renders a branded gradient placeholder with
 * `fallbackIcon`. Used for landing-page photos that may not exist yet (see
 * public/images/README.md).
 *
 * 2026-08-06 (user request, "pagandahin ang landing page"): the placeholder used to display the
 * literal text "No photo selected yet" to real site visitors - an internal, developer-facing TODO
 * note that had no business being shown on a live public page. Real photos are still a pending
 * decision (see the README), so this only fixes the placeholder's own presentation in the
 * meantime: a subtle repeating dot pattern + the icon, with no apologetic copy - reads as an
 * intentional brand texture, not a broken/missing asset. The "still needs a real photo" signal now
 * only reaches a developer, via this comment and the README, not a live visitor.
 */
export function ImageWithFallback({ src, alt, className, fallbackClassName, fallbackIcon, ...rest }: ImageWithFallbackProps) {
  const [failed, setFailed] = React.useState(false);

  if (failed || !src) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/50 text-primary/50',
          className,
          fallbackClassName,
        )}
        aria-hidden={!alt}
        role={alt ? 'img' : undefined}
        aria-label={alt}
      >
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' }}
        />
        <div className="relative">{fallbackIcon}</div>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} {...rest} />;
}
