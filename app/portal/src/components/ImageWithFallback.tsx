import * as React from 'react';
import { cn } from '@/lib/utils';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
  fallbackIcon?: React.ReactNode;
}

/** Renders `src` if it loads; otherwise renders a gradient placeholder with `fallbackIcon`.
 * Used for landing-page photos that may not exist yet (see public/images/README.md). */
export function ImageWithFallback({ src, alt, className, fallbackClassName, fallbackIcon, ...rest }: ImageWithFallbackProps) {
  const [failed, setFailed] = React.useState(false);

  if (failed || !src) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/40 text-primary/40',
          className,
          fallbackClassName,
        )}
        aria-hidden={!alt}
        role={alt ? 'img' : undefined}
        aria-label={alt}
      >
        {fallbackIcon}
        <span className="px-2 text-center text-[11px] font-medium leading-tight text-primary/50">No photo selected yet</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} {...rest} />;
}
