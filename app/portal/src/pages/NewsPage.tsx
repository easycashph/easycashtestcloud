import * as React from 'react';
import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import {
  NEWS_CATEGORIES,
  formatPostDate,
  getPublishedPosts,
  getUsedCategories,
  type NewsCategory,
} from '@/content/news';

/**
 * News listing page.
 *
 * Serves two audiences at once: existing borrowers looking for service advisories (which reduces
 * call volume), and search traffic arriving on financial-literacy guides. See
 * `docs/PORTAL_WEBSITE_STRATEGY.md` §3.5.
 */
export function NewsPage() {
  const posts = getPublishedPosts();
  const usedCategories = getUsedCategories();
  const [activeCategory, setActiveCategory] = React.useState<NewsCategory | 'all'>('all');

  const visiblePosts =
    activeCategory === 'all' ? posts : posts.filter((post) => post.category === activeCategory);

  return (
    <PublicPageLayout
      title="News & Announcements"
      intro="Service advisories, financial guides, and company updates from Easycash."
    >
      {posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {/* Only render the filter when there is something to filter by. */}
          {usedCategories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <CategoryChip
                label="All"
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Newspaper className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold">No posts yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Easycash announcements, service advisories, and financial guides will appear here. Check
        back soon.
      </p>
    </div>
  );
}
