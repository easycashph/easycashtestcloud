import * as React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Newspaper } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { ExternalNewsLinksSection } from '@/components/ExternalNewsLinksSection';
import { apiClient, API_BASE_URL } from '@/lib/apiClient';
import type { ActiveMisPostsResponse, MisPostView } from '@/lib/portalApiTypes';
import {
  NEWS_CATEGORIES,
  formatPostDate,
  getPublishedPosts,
  getUsedCategories,
  type NewsCategory,
} from '@/content/news';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * News listing page.
 *
 * Serves two audiences at once: existing borrowers looking for service advisories (which reduces
 * call volume), and search traffic arriving on financial-literacy guides. See
 * `docs/PORTAL_WEBSITE_STRATEGY.md` §3.5.
 *
 * 2026-07-29: wired to the i18n system for the page chrome (title, empty state, filter label) -
 * post content itself is never translated (see content/news.ts's own scope note - there are no
 * posts yet, and a future post's language is up to whoever writes it).
 */
export function NewsPage() {
  const { t } = useLanguage();
  const posts = getPublishedPosts();
  const usedCategories = getUsedCategories();
  const [activeCategory, setActiveCategory] = React.useState<NewsCategory | 'all'>('all');
  const [misPosts, setMisPosts] = React.useState<ActiveMisPostsResponse | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ActiveMisPostsResponse>('/portal/mis-posts/active')
      .then((res) => {
        if (!cancelled) setMisPosts(res);
      })
      .catch(() => {
        if (!cancelled) setMisPosts({ autoPost: null, manualPosts: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePosts =
    activeCategory === 'all' ? posts : posts.filter((post) => post.category === activeCategory);

  // MIS posts lead the page (2026-08-20 user request: "dapat pinakauna at hindi nasa dulo") -
  // manual/custom posts first, then the current auto-rotation post, both ahead of external news.
  const misPostsInOrder = misPosts ? [...misPosts.manualPosts, ...(misPosts.autoPost ? [misPosts.autoPost] : [])] : [];

  return (
    <PublicPageLayout title={t.news.title} intro={t.news.intro}>
      {misPostsInOrder.length > 0 && (
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {misPostsInOrder.map((post) => (
            <MisPostFeedCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <div className="space-y-10">
        <ExternalNewsLinksSection category="ADVISORY" title="Road & Weather Advisories (Metro Manila)" />
        <ExternalNewsLinksSection category="FINANCE" title="PH Lending & Finance News" />
      </div>

      {posts.length === 0 ? (
        <div className="mt-10">
          <EmptyState />
        </div>
      ) : (
        <div className="mt-10 space-y-6">
          {/* Only render the filter when there is something to filter by. */}
          {usedCategories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <CategoryChip
                label={t.news.filterAll}
                active={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
              />
              {usedCategories.map((category) => (
                <CategoryChip
                  key={category}
                  label={NEWS_CATEGORIES[category]}
                  active={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                />
              ))}
            </div>
          )}

          <ul className="space-y-4">
            {visiblePosts.map((post) => (
              <li key={post.slug}>
                <Link
                  to={`/news/${post.slug}`}
                  className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                      {NEWS_CATEGORIES[post.category]}
                    </span>
                    <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                  </div>
                  <h2 className="mt-2.5 text-base font-semibold">{post.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PublicPageLayout>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function MisPostFeedCard({ post }: { post: MisPostView }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-primary/30 bg-card p-4">
      <img src={`${API_BASE_URL}${post.imageUrl}`} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24" />
      <div className="min-w-0">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <Megaphone className="h-3 w-3" />
          {post.type === 'MANUAL' ? 'Announcement' : 'Easycash'}
        </span>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{post.caption}</p>
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Newspaper className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold">{t.news.emptyTitle}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{t.news.emptyBody}</p>
    </div>
  );
}
