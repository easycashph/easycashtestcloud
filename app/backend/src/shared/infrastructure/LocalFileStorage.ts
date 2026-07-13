import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';

/**
 * `STORAGE_DRIVER=local` implementation (ADR-051 §4). Writes under `env.STORAGE_LOCAL_PATH`
 * (gitignored `app/backend/storage/`, or the Docker volume mount at `/app/storage` — see
 * `docker-compose.yml`'s `backend_storage` volume).
 */
export class LocalFileStorage implements IFileStorage {
  constructor(private readonly rootDir: string) {}

  async save(key: string, data: Buffer): Promise<void> {
    const fullPath = this.resolveKey(key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  private resolveKey(key: string): string {
    return resolve(join(this.rootDir, key));
  }
}
