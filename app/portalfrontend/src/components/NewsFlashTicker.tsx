import * as React from 'react';
import { Radio } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import type { ExternalNewsLinkView } from '@/lib/portalApiTypes';

/**
 * Homepage "News Flash" ticker (2026-08-06 user request) - a slim strip of the latest road/weather
 * advisories and PH lending/finance headlines, each linking straight out to the real source.
 * Deliberately just headlines here (no excerpt) - the full excerpt + "Read on {source}" cards live
 * on the News page (`ExternalNewsLinksSection`); this is a glanceable pointer, not a duplicate of
 * that content. Advisories are fetched first and shown ahead of finance headlines - more
 * time-sensitive for a client checking before heading out, or a loan officer reporting to the
 * main office. Renders nothing at all once loaded if there's nothing to show yet.
 *
 * 2026-08-20 (user request): now scrolls right-to-left continuously ("katulad ng NBA drafting
 * pick"), pausing on hover so a link can actually be clicked. Content is unchanged - still
 * external advisories/finance links only; MIS-authored posts are deliberately NOT mixed into this
 * ticker (they get their own full-text, non-scrolling `MisPostBanner` above it instead).
 */
export function NewsFlashTicker() {
  const [items, setItems] = React.useState<ExternalNewsLinkView[] | null>(null);

  React.useEffect(() => {
    Promise.all([
      apiClient.get<ExternalNewsLinkView[]>('/portal/finance-news?category=ADVISORY&limit=5'),
      apiClient.get<ExternalNewsLinkView[]>('/portal/finance-news?category=FINANCE&limit=5'),
    ])
      .then(([advisories, finance]) => setItems([...advisories, ...finance]))
      .catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;

  // Rendered twice back to back so translateX(-50%) loops seamlessly - see the `marquee`
  // keyframe's own comment in tailwind.config.ts.
  const track = (keyPrefix: string) => (
    <div className="flex shrink-0 items-center gap-5 pr-5">
      {items.map((item) => (
        <a
          key={`${keyPrefix}-${item.id}`}
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          {item.category === 'ADVISORY' ? '⚠️ ' : ''}
          {item.title}
        </a>
      ))}
    </div>
  );

  return (
    <div className="border-b border-border bg-secondary/50">
      <div className="container flex items-center gap-3 py-2">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <Radio className="h-3.5 w-3.5" />
          News Flash
        </span>
        <div className="group min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          <div className="flex w-max animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused]">
            {track('a')}
            {track('b')}
          </div>
        </div>
      </div>
    </div>
  );
}
