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
    // 2026-08-25 (user-reported "images sometimes don't load"): a post row can outlive its image
    // file (e.g. an AUTO_ROTATION pool row seeded outside the normal upload flow, pointing at a
    // storage key that was never actually written) - `fileStorage.read()` throws a raw ENOENT in
    // that case, which the shared error handler maps to an unhandled 500 instead of a clean 404.
    // Translate it here so the Portal's <img> at least fails predictably.
    try {
      const data = await this.deps.fileStorage.read(props.imageStorageKey);
      return { data, fileName: props.imageFileName, fileType: props.imageFileType };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundError('MisPostImage', id);
      }
      throw error;
    }
  }
}
