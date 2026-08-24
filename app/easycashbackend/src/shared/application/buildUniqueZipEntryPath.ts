/**
 * Builds a collision-safe zip entry path for a bulk-document-download feature (2026-08-20 user
 * request: MIS staff downloading every file for a client/loan account as one organized ZIP).
 * Sanitizes path-breaking characters out of the folder/file name, then appends " (2)", " (3)", ...
 * before the extension if the same folder already has an entry with that exact name - mirrors how
 * a filesystem (and Windows Explorer's own zip extractor) resolves a naming collision.
 *
 * `folder` may itself be a multi-segment path (e.g. `"SML-REG_00097 (ad29c78d)/Other"` - a caller
 * building "<record>/<category>" in one string) - sanitize each segment separately and rejoin with
 * "/", rather than stripping "/" everywhere, which used to collapse an intended subfolder into one
 * flat, dash-joined name (confirmed 2026-08-25: MIS reported downloading a folder literally named
 * "SML-Co-Borrower_00097 (ad29c78d)-Other" instead of an "Other" folder nested one level inside).
 */
export function buildUniqueZipEntryPath(usedPaths: Set<string>, folder: string, fileName: string): string {
  const safeFolder =
    folder
      .split('/')
      .map((segment) => segment.replace(/[\\:*?"<>|]/g, '-').trim())
      .filter((segment) => segment.length > 0)
      .join('/') || 'Other';
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
