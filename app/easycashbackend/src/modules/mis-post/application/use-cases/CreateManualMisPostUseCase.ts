import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { ValidationError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import { MisPost } from '../../domain/MisPost';
import type { IMisPostRepository } from '../ports/IMisPostRepository';

/** Same whitelist as `UploadAttachmentUseCase` minus PDF - a Portal post is always an image. */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Preset shown in the LMS composer (2026-08-20 user request: "mag lagay din ng preset timer na
 * 30 mins duration... para matulungan ang MIS kapag mag po-post"). MIS can still type any other
 * duration - this is only the default the form starts with. */
export const DEFAULT_MANUAL_POST_DURATION_MINUTES = 30;
const MAX_MANUAL_POST_DURATION_MINUTES = 60 * 24 * 7; // 7 days - generous ceiling, not unbounded

export interface CreateManualMisPostInput {
  caption: string;
  durationMinutes: number;
  fileName: string;
  fileType: string;
  data: Buffer;
  createdByUserId: string;
}

export class CreateManualMisPostUseCase {
  constructor(
    private readonly deps: {
      misPostRepository: IMisPostRepository;
      fileStorage: IFileStorage;
    },
  ) {}

  async execute(input: CreateManualMisPostInput): Promise<MisPost> {
    const caption = input.caption.trim();
    if (caption.length === 0) {
      throw new ValidationError('Caption is required.');
    }
    if (caption.length > 2000) {
      throw new ValidationError('Caption is too long (max 2000 characters).');
    }
    if (!ALLOWED_MIME_TYPES.has(input.fileType)) {
      throw new ValidationError(`Unsupported file type "${input.fileType}". Allowed: JPEG, PNG.`);
    }
    if (input.data.length === 0) {
      throw new ValidationError('The uploaded image is empty.');
    }
    if (input.data.length > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`Image exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`);
    }
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
      throw new ValidationError('Duration must be a positive number of minutes.');
    }
    if (input.durationMinutes > MAX_MANUAL_POST_DURATION_MINUTES) {
      throw new ValidationError(`Duration exceeds the ${MAX_MANUAL_POST_DURATION_MINUTES / 60 / 24}-day limit.`);
    }

    const extension = path.extname(input.fileName).slice(0, 10);
    const storageKey = path.posix.join('mis-posts', `${crypto.randomUUID()}${extension}`);
    await this.deps.fileStorage.save(storageKey, input.data);

    const post = MisPost.createManualPost({
      caption,
      imageStorageKey: storageKey,
      imageFileName: input.fileName,
      imageFileType: input.fileType,
      durationMinutes: input.durationMinutes,
      createdByUserId: input.createdByUserId,
    });

    await this.deps.misPostRepository.save(post);
    return post;
  }
}
