import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { env } from '@shared/config/env';
import type { IFileStorage } from '../application/ports/IFileStorage';

/** Local-disk implementation of IFileStorage — writes under `STORAGE_LOCAL_PATH` (the `/app/storage`
 * volume in Docker). Keys are namespaced by owner so a directory listing alone never mixes files
 * from different owners; the caller (UploadAttachmentUseCase) generates the key, never the raw
 * client-supplied file name, to avoid path traversal via a crafted file name. */
export class LocalFileStorage implements IFileStorage {
  private readonly root = path.resolve(env.STORAGE_LOCAL_PATH);

  async save(key: string, data: Buffer): Promise<void> {
    const fullPath = this.resolveWithinRoot(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveWithinRoot(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolveWithinRoot(key), { force: true });
  }

  /** Streaming counterparts (2026-08-24, MIS bulk document export) - see `IFileStorage`'s (shared
   * port) own doc comment for why these exist alongside the buffer-based `save`/`read` above. */
  createReadStream(key: string): Readable {
    return fsSync.createReadStream(this.resolveWithinRoot(key));
  }

  createWriteStream(key: string): Writable {
    const fullPath = this.resolveWithinRoot(key);
    fsSync.mkdirSync(path.dirname(fullPath), { recursive: true });
    return fsSync.createWriteStream(fullPath);
  }

  /** Rejects any key that would resolve outside the storage root — defense in depth even though
   * keys are always generated server-side (UploadAttachmentUseCase), never taken from user input. */
  private resolveWithinRoot(key: string): string {
    const fullPath = path.resolve(this.root, key);
    if (!fullPath.startsWith(this.root + path.sep) && fullPath !== this.root) {
      throw new Error(`Refusing to access a storage key outside the storage root: ${key}`);
    }
    return fullPath;
  }
}
