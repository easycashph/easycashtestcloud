/**
 * Storage abstraction (CLAUDE.md "Storage" — local first, so S3/cloud object storage can be added
 * later without touching application logic). `LocalFileStorage` is the only implementation today;
 * an `S3FileStorage` would implement this same port.
 */
export interface IFileStorage {
  /** Writes the file under a storage-driver-specific key and returns that key (never the caller's
   * own file name — callers must not assume the key is a readable path). */
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
