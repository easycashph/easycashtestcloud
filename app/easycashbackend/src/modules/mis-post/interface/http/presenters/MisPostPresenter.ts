import type { MisPost } from '../../../domain/MisPost';

export function presentMisPost(post: MisPost) {
  const p = post.toProps();
  return {
    id: p.id,
    type: p.type,
    caption: p.caption,
    imageUrl: `/portal/mis-posts/${p.id}/image`,
    imageFileName: p.imageFileName,
    poolOrder: p.poolOrder,
    poolActive: p.poolActive,
    isCurrentlyLive: p.isCurrentlyLive,
    publishedAt: p.publishedAt,
    expiresAt: p.expiresAt,
    withdrawn: p.withdrawn,
    createdByUserId: p.createdByUserId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
