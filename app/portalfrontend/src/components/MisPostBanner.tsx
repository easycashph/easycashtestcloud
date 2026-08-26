import * as React from 'react';
import { Megaphone } from 'lucide-react';
import { apiClient, API_BASE_URL } from '@/lib/apiClient';
import type { ActiveMisPostsResponse, MisPostView } from '@/lib/portalApiTypes';

/**
 * Homepage MIS post banner (2026-08-20 user request) - shown above the News Flash ticker, full
 * text/image, not scrolling ("ilagay na lang ang buong post sa bandang itaas ng newsflash, para
 * madaling mabasa"). Two kinds of card, both rendered in full: any currently-live custom/manual
 * MIS post (e.g. a typhoon advisory - disappears on its own once its duration elapses) shown
 * first, and the day's auto-rotating post next to it ("lalabas... Homepage at News &
 * Announcements page... kasabay ng anumang active manual announcement"). Deliberately separate
 * from `NewsFlashTicker`, which stays external-news-only per the same user request.
 */
export function MisPostBanner() {
  const [data, setData] = React.useState<ActiveMisPostsResponse | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<ActiveMisPostsResponse>('/portal/mis-posts/active')
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData({ autoPost: null, manualPosts: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  const posts = [...data.manualPosts, ...(data.autoPost ? [data.autoPost] : [])];
  if (posts.length === 0) return null;

  return (
    <div className="border-b border-border bg-secondary/30">
      <div className="container grid gap-3 py-3 sm:grid-cols-2">
        {posts.map((post) => (
          <MisPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

function MisPostCard({ post }: { post: MisPostView }) {
  // 2026-08-25 (user-reported: too small, cropped, sometimes broken): image moved from a tiny
  // 64-96px side square to a full-width banner with a fixed aspect ratio - big enough to actually
  // read, and consistent across every post regardless of what resolution/aspect ratio MIS
  // originally uploaded (uploads have no dimension restriction - see CreateManualMisPostUseCase).
  // `onError` hides a genuinely missing/broken image instead of leaving the browser's default
  // broken-image icon on screen.
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {!imageFailed && (
        <img
          src={`${API_BASE_URL}${post.imageUrl}`}
          alt=""
          onError={() => setImageFailed(true)}
          className="aspect-[16/9] w-full object-cover"
        />
      )}
      <div className="p-3">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <Megaphone className="h-3 w-3" />
          {post.type === 'MANUAL' ? 'Announcement' : 'Easycash'}
        </span>
        <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">{post.caption}</p>
      </div>
    </div>
  );
}
