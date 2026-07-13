/**
 * Storage abstraction (CLAUDE.md: "Design storage abstraction so AWS S3 or cloud object storage
 * can be added later without changing application logic"). First real implementation is
 * `LocalFileStorage` (ADR-051 §4) — no application code should depend on the local-filesystem
 * detail, only on this port, so swapping in an S3-backed adapter later is a wiring change in
 * `app.ts`, not a rewrite of every use case that reads/writes a file.
 */
export interface IFileStorage {
  /** `key` is a relative path segment, e.g. `loan-documents/<uuid>.pdf` — never an absolute path. */
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
}
