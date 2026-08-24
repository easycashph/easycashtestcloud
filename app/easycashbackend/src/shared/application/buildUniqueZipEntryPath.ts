/**
 * Builds a collision-safe zip entry path for a bulk-document-download feature (2026-08-20 user
 * request: MIS staff downloading every file for a client/loan account as one organized ZIP).
 * Sanitizes path-breaking characters out of the folder/file name, then appends " (2)", " (3)", ...
 * before the extension if the same folder already has an entry with that exact name - mirrors how
 * a filesystem (and Windows Explorer's own zip extractor) resolves a naming collision.
 */
export function buildUniqueZipEntryPath(usedPaths: Set<string>, folder: string, fileName: string): string {
  const safeFolder = folder.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Other';
  const safeFileName = fileName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'file';

  let candidate = `${safeFolder}/${safeFileName}`;
  if (!usedPaths.has(candidate)) {
    usedPaths.add(candidate);
    return candidate;
  }

  const dotIndex = safeFileName.lastIndexOf('.');
  const base = dotIndex > 0 ? safeFileName.slice(0, dotIndex) : safeFileName;
  const ext = dotIndex > 0 ? safeFileName.slice(dotIndex) : '';

  let suffix = 2;
  do {
    candidate = `${safeFolder}/${base} (${suffix})${ext}`;
    suffix += 1;
  } while (usedPaths.has(candidate));

  usedPaths.add(candidate);
  return candidate;
}
