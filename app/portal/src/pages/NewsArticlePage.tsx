import { Link, useParams } from 'react-router-dom';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { NEWS_CATEGORIES, formatPostDate, getPostBySlug, type NewsBlock } from '@/content/news';

/**
 * A single news post.
 *
 * An unknown slug renders a "not found" state rather than redirecting: a borrower who followed an
 * old link should be told the post is gone, not silently dumped on the listing page wondering
 * whether they mistyped.
 */
export function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return (
      <PublicPageLayout
        title="Post not found"
        intro="This post may have been moved or removed."
      >
        <Link to="/news" className="text-sm font-semibold text-primary hover:underline">
          Back to all news
        </Link>
      </PublicPageLayout>
    );
  }

  return (
    <PublicPageLayout title={post.title} metaDescription={post.summary}>
      <article>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
            {NEWS_CATEGORIES[post.category]}
          </span>
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
        </div>

        <p className="mt-4 text-base leading-relaxed text-foreground">{post.summary}</p>

        <div className="mt-6 space-y-4">
          {post.body.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </div>
      </article>

      <div className="mt-10 border-t border-border pt-6">
        <Link to="/news" className="text-sm font-semibold text-primary hover:underline">
          Back to all news
        </Link>
      </div>
    </PublicPageLayout>
  );
}

/** Renders one content block. Exhaustive over NewsBlock - adding a block type without handling it
 * here is a TypeScript error, not a silently blank section. */
function Block({ block }: { block: NewsBlock }) {
  switch (block.type) {
    case 'heading':
      return <h2 className="pt-2 text-lg font-bold tracking-tight">{block.text}</h2>;
    case 'list':
      return (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'paragraph':
      return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
  }
}
