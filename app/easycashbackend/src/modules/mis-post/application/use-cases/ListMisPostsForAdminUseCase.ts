import type { MisPost } from '../../domain/MisPost';
import type { IMisPostRepository } from '../ports/IMisPostRepository';

/** Backs the LMS admin view: full rotation pool + manual-post history, newest first per type. */
export class ListMisPostsForAdminUseCase {
  constructor(private readonly deps: { misPostRepository: IMisPostRepository }) {}

  async execute(): Promise<MisPost[]> {
    return this.deps.misPostRepository.findManyForAdmin();
  }
}
