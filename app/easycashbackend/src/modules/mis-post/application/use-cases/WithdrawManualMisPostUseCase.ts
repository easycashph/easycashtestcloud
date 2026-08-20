import { NotFoundError, ValidationError } from '@shared/errors/DomainError';
import type { IMisPostRepository } from '../ports/IMisPostRepository';

/** Lets MIS pull a manual post down early (e.g. the typhoon has passed) instead of waiting out
 * its `expiresAt` duration. */
export class WithdrawManualMisPostUseCase {
  constructor(private readonly deps: { misPostRepository: IMisPostRepository }) {}

  async execute(id: string): Promise<void> {
    const post = await this.deps.misPostRepository.findById(id);
    if (!post) {
      throw new NotFoundError('MisPost', id);
    }
    if (post.type !== 'MANUAL') {
      throw new ValidationError('Only manual posts can be withdrawn.');
    }
    post.withdraw();
    await this.deps.misPostRepository.save(post);
  }
}
