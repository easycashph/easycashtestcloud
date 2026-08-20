import type { MisPost } from '../../domain/MisPost';
import type { IMisPostRepository } from '../ports/IMisPostRepository';

export interface ActivePortalPosts {
  autoPost: MisPost | null;
  manualPosts: MisPost[];
}

/** Backs the public Portal endpoint - the current rotation post plus every still-live manual post,
 * exactly the set the homepage banner and the News & Announcements page both render. */
export class GetActivePortalPostsUseCase {
  constructor(private readonly deps: { misPostRepository: IMisPostRepository }) {}

  async execute(): Promise<ActivePortalPosts> {
    const [autoPost, manualPosts] = await Promise.all([
      this.deps.misPostRepository.findCurrentLiveAutoPost(),
      this.deps.misPostRepository.findActiveManualPosts(new Date()),
    ]);
    return { autoPost, manualPosts };
  }
}
