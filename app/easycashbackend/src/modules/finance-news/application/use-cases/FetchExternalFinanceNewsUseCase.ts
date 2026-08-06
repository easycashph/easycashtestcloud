import Parser from 'rss-parser';
import type { IExternalNewsLinkRepository, ExternalNewsCategory } from '../ports/IExternalNewsLinkRepository';

/** Injected rather than calling `rss-parser` directly in the use case, so a unit test can
 * substitute a fake without a real network call. */
type ParsedFeed = {
  title?: string;
  items: Array<{ title?: string; link?: string; contentSnippet?: string; content?: string; isoDate?: string; pubDate?: string }>;
};

export interface IRssFeedParser {
  parseUrl(url: string): Promise<ParsedFeed>;
}

export class RssParserAdapter implements IRssFeedParser {
  private readonly parser = new Parser();
  parseUrl(url: string): Promise<ParsedFeed> {
    return this.parser.parseURL(url);
  }
}

const EXCERPT_MAX_LENGTH = 200;

/** Simple automated relevance guard (2026-08-06 user request) - NOT a human judgment call, just a
 * keyword allowlist per category, since there is deliberately no staff review step before an item
 * goes live (see ExternalNewsLink's own doc comment on schema.prisma for the full trade-off). */
const CATEGORY_KEYWORDS: Record<ExternalNewsCategory, string[]> = {
  FINANCE: [
    'loan',
    'lending',
    'bank',
    'banking',
    'bsp',
    'sec',
    'interest rate',
    'credit',
    'fintech',
    'peso',
    'finance',
    'financial',
    'ofw remittance',
  ],
  // Road/weather advisories around Metro Manila - relevant to clients/prospective clients and to
  // onsite loan officers who need to report to the Easycash main office (2026-08-06 user request).
  // Deliberately specific disaster/weather/road terms only - a bare "metro manila"/"ncr" matched
  // unrelated Metro Manila lifestyle stories during testing (2026-08-06), which is exactly the
  // false-positive risk this codebase's own "no human review" trade-off (see this file's class doc
  // comment) makes worth guarding against with a tighter keyword list.
  ADVISORY: [
    'pagasa',
    'signal no',
    'typhoon',
    'tropical depression',
    'tropical storm',
    'habagat',
    'monsoon',
    'flood',
    'flooding',
    'landslide',
    'storm surge',
    'weather advisory',
    'road advisory',
    'mmda',
    'traffic advisory',
    'evacuation',
    'class suspension',
    'suspension of classes',
  ],
};

function isRelevant(category: ExternalNewsCategory, text: string): boolean {
  const lower = text.toLowerCase();
  return CATEGORY_KEYWORDS[category].some((keyword) => lower.includes(keyword));
}

function truncateExcerpt(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > EXCERPT_MAX_LENGTH ? `${clean.slice(0, EXCERPT_MAX_LENGTH).trimEnd()}…` : clean;
}

export interface FeedSource {
  url: string;
  category: ExternalNewsCategory;
}

function deriveSourceName(feedTitle: string | undefined, feedUrl: string): string {
  // Some feeds' own <title> starts with a bare "- " (e.g. an empty category name before the site
  // name) - stripped so "Read on {sourceName}" never renders as "Read on - Manila Bulletin".
  const cleaned = feedTitle?.replace(/^[\s-]+/, '').trim();
  if (cleaned) return cleaned;
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, '');
  } catch {
    return feedUrl;
  }
}

export interface FetchExternalFinanceNewsUseCaseDeps {
  externalNewsLinkRepository: IExternalNewsLinkRepository;
  rssFeedParser: IRssFeedParser;
}

export interface FetchExternalFinanceNewsResult {
  fetched: number;
  saved: number;
  skippedDuplicate: number;
  skippedIrrelevant: number;
  feedErrors: { url: string; error: string }[];
}

/**
 * Daily automated PH Lending/Finance News + Road/Weather Advisory fetch (2026-08-06 user request).
 * Pulls headline + a short (~200 char) excerpt + a link back to the source from a small,
 * env-configured allowlist of RSS feeds - never the full article body (copyright). Runs fully
 * unattended (explicit user decision, no human approval step) - the per-category keyword filter
 * and the hard excerpt truncation are the only automated guardrails.
 */
export class FetchExternalFinanceNewsUseCase {
  constructor(private readonly deps: FetchExternalFinanceNewsUseCaseDeps) {}

  async execute(feeds: FeedSource[]): Promise<FetchExternalFinanceNewsResult> {
    const { externalNewsLinkRepository, rssFeedParser } = this.deps;
    const result: FetchExternalFinanceNewsResult = { fetched: 0, saved: 0, skippedDuplicate: 0, skippedIrrelevant: 0, feedErrors: [] };

    for (const feed of feeds) {
      let parsed;
      try {
        parsed = await rssFeedParser.parseUrl(feed.url);
      } catch (error) {
        result.feedErrors.push({ url: feed.url, error: error instanceof Error ? error.message : String(error) });
        continue;
      }

      const sourceName = deriveSourceName(parsed.title, feed.url);

      for (const item of parsed.items) {
        result.fetched += 1;
        if (!item.title || !item.link) continue;

        const description = item.contentSnippet ?? item.content ?? '';
        if (!isRelevant(feed.category, `${item.title} ${description}`)) {
          result.skippedIrrelevant += 1;
          continue;
        }

        const existing = await externalNewsLinkRepository.findBySourceUrl(item.link);
        if (existing) {
          result.skippedDuplicate += 1;
          continue;
        }

        await externalNewsLinkRepository.create({
          category: feed.category,
          title: item.title,
          sourceName,
          sourceUrl: item.link,
          excerpt: truncateExcerpt(description),
          publishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : new Date(),
        });
        result.saved += 1;
      }
    }

    return result;
  }
}
