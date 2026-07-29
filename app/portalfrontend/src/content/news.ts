/**
 * Easycash news, announcements, and guides — the content source for /news.
 *
 * ── WHY POSTS ARE TYPESCRIPT OBJECTS AND NOT MARKDOWN ────────────────────────────────────────
 * The obvious choice would be Markdown/MDX files. That needs an extra build plugin and a markdown
 * renderer dependency, and `CLAUDE.md` says to avoid unnecessary dependencies. Structured blocks
 * give us type safety (a malformed post fails the build instead of rendering broken), zero new
 * dependencies, and full git review on every published word — which matters for a lender.
 *
 * The upgrade path, once non-technical staff need to publish without a developer, is a real CMS or
 * an MDX pipeline. See `docs/PORTAL_WEBSITE_STRATEGY.md` §3.5.
 *
 * ── HOW TO ADD A POST ────────────────────────────────────────────────────────────────────────
 * Copy the template at the bottom of this file into the NEWS_POSTS array. Rules:
 *   • `slug` is permanent — it is the URL. Never change one after publishing; links will break.
 *   • `date` is ISO `YYYY-MM-DD`, the publication date.
 *   • `summary` is one or two sentences, and is what shows on the listing page and in link previews.
 *   • Newest posts can go anywhere in the array — the listing sorts by date.
 *
 * ── WHAT NOT TO PUBLISH ──────────────────────────────────────────────────────────────────────
 * This is a public page of a regulated lending company. Do not state interest rates, fees, or loan
 * terms here — those belong on the (still to be built) Rates & Fees page, driven by the actual
 * product configuration, so they cannot drift out of date. A stale rate in a blog post is a
 * mis-disclosure.
 */

export const NEWS_CATEGORIES = {
  announcement: 'Announcements',
  guide: 'Guides',
  company: 'Company News',
} as const;

export type NewsCategory = keyof typeof NEWS_CATEGORIES;

/** A single block of post body content. Add new block types here as they are genuinely needed. */
export type NewsBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] };

export interface NewsPost {
  /** Permanent URL segment. Lowercase, hyphenated, never reused or changed. */
  slug: string;
  title: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  category: NewsCategory;
  /** One or two sentences; shown on the listing page. */
  summary: string;
  body: NewsBlock[];
}

/**
 * INTENTIONALLY EMPTY.
 *
 * The news system is built and wired, but no posts have been written yet. Easycash's real
 * announcements must come from the business — inventing company news would be fabrication, and on
 * a lender's public site that is a serious problem, not a placeholder. The /news page renders a
 * proper empty state until the first real post is added here.
 */
export const NEWS_POSTS: NewsPost[] = [];

/** Posts sorted newest-first. Use this rather than reading NEWS_POSTS directly. */
export function getPublishedPosts(): NewsPost[] {
  return [...NEWS_POSTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function getPostBySlug(slug: string): NewsPost | undefined {
  return NEWS_POSTS.find((post) => post.slug === slug);
}

/** Categories that actually have at least one post — so the filter never offers an empty result. */
export function getUsedCategories(): NewsCategory[] {
  return (Object.keys(NEWS_CATEGORIES) as NewsCategory[]).filter((category) =>
    NEWS_POSTS.some((post) => post.category === category),
  );
}

/** Formats an ISO date for display, e.g. "28 July 2026". */
export function formatPostDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── TEMPLATE — copy into NEWS_POSTS above ────────────────────────────────────────────────────
{
  slug: 'holiday-schedule-2026',
  title: 'Holiday schedule for December 2026',
  date: '2026-12-01',
  category: 'announcement',
  summary: 'Our branches and support lines will follow adjusted hours over the holidays.',
  body: [
    { type: 'paragraph', text: 'Opening paragraph explaining the announcement.' },
    { type: 'heading', text: 'Branch hours' },
    { type: 'list', items: ['24 December — closed at 12:00 NN', '25 December — closed'] },
    { type: 'paragraph', text: 'Closing paragraph, e.g. how to reach support meanwhile.' },
  ],
},
──────────────────────────────────────────────────────────────────────────────────────────── */
