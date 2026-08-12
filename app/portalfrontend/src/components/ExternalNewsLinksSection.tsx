import * as React from 'react';
import { ExternalLink, TriangleAlert } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import type { ExternalNewsCategory, ExternalNewsLinkView } from '@/lib/portalApiTypes';

/**
 * Automated PH Lending/Finance News + Road/Weather Advisory links (2026-08-06 user request) -
 * curated pointers to real external articles (headline + short excerpt + outbound link), fetched
 * daily by a backend cron job. Deliberately styled so it's unambiguous this points to someone
 * else's article, not Easycash's own writing - clear source attribution + an explicit "Read on
 * {source}" outbound link, never presented as in-house content.
 */
export function ExternalNewsLinksSection({ category, title }: { category: ExternalNewsCategory; title: string }) {
  const [items, setItems] = React.useState<ExternalNewsLinkView[] | null>(null);

  React.useEffect(() => {
    apiClient
      .get<ExternalNewsLinkView[]>(`/portal/finance-news?category=${category}&limit=10`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [category]);

  if (items !== null && items.length === 0) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {category === 'ADVISORY' && <TriangleAlert className="h-4 w-4 text-warning" />}
        {title}
      </h2>
      {items === null ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{item.sourceName}</span>
                <time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleDateString()}</time>
              </div>
              <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.excerpt}</p>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Read on {item.sourceName} <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
