import type { Response } from 'express';
import { ZipArchive } from 'archiver';

export interface ZipEntry {
  path: string;
  data: Buffer;
}

/** Streams a set of already-read file buffers to the client as a single ZIP download (2026-08-20,
 * MIS bulk-document-download feature) - shared by the borrower and loan-account controllers so the
 * archiver wiring (headers, piping, per-entry naming, finalize) lives in exactly one place. */
export function streamZipResponse(res: Response, zipFileName: string, entries: ZipEntry[]): void {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipFileName)}"`);

  // archiver v8 dropped its callable `archiver('zip', ...)` factory in favor of this class - see
  // node_modules/@types/archiver's `Archiver`/`ZipArchive` exports.
  const archive = new ZipArchive({ zlib: { level: 9 } });
  // Entries are already-read in-memory buffers (no further disk/network I/O happens inside
  // archiver itself), so a mid-stream error here is not expected - log rather than throw, since
  // throwing from an event callback after headers may already be sent would crash the process
  // instead of just failing this one download.
  archive.on('error', (err: Error) => {
    console.error('[streamZipResponse] archiver error', err);
    res.destroy(err);
  });
  archive.pipe(res);
  for (const entry of entries) {
    archive.append(entry.data, { name: entry.path });
  }
  void archive.finalize();
}
