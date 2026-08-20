import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { IMisPostRepository } from '../ports/IMisPostRepository';

export interface MisPostImage {
  data: Buffer;
  fileName: string;
  fileType: string;
}

/** Public image bytes for a post (2026-08-20) - deliberately unauthenticated, same as the post
 * itself: marketing/advisory material meant for a borrower who has not logged in yet, addressed
 * only by its unguessable UUID (never the client-supplied file name - path traversal). */
export class GetMisPostImageUseCase {
  constructor(
    private readonly deps: {
      misPostRepository: IMisPostRepository;
      fileStorage: IFileStorage;
    },
  ) {}

  async execute(id: string): Promise<MisPostImage> {
    const post = await this.deps.misPostRepository.findById(id);
    if (!post) {
      throw new NotFoundError('MisPost', id);
    }
    const props = post.toProps();
    const data = await this.deps.fileStorage.read(props.imageStorageKey);
    return { data, fileName: props.imageFileName, fileType: props.imageFileType };
  }
}
