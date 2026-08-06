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

  return (
    <div className="border-b border-border bg-secondary/50">
      <div className="container flex items-center gap-3 py-2">
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <Radio className="h-3.5 w-3.5" />
          News Flash
        </span>
        <div className="flex min-w-0 flex-1 gap-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <a
              key={item.id}
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
      </div>
    </div>
  );
}
