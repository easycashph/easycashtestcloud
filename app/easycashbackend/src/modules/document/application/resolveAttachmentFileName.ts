const RECOGNIZED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

/** `Attachment.fileType` holds a real MIME type for attachments uploaded through the app, but a
 * plain file extension (e.g. ".pdf") for rows backfilled from the legacy SDevTech export - see
 * `documentController.ts`'s own `MIME_TYPE_BY_EXTENSION` doc comment for the same distinction. */
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/**
 * Every attachment uploaded through the app already carries its extension in `fileName` (e.g.
 * "Copy of 2x2 picture.jpg"), but ~thousands of legacy-migrated rows only have the bare name (e.g.
 * "Company_ID", "CMAP Borrower") with no extension at all - confirmed 2026-08-25 by querying real
 * production data. A file with no extension can't be opened by double-clicking it once downloaded,
 * so every place that hands an attachment's name to a user (single-file download, and every bulk
 * ZIP export) must go through this instead of using `attachment.fileName` raw.
 */
export function resolveAttachmentFileName(fileName: string, fileType: string): string {
  const lowerName = fileName.toLowerCase();
  if (RECOGNIZED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return fileName;
  }

  const lowerType = fileType.toLowerCase();
  const extension = lowerType.startsWith('.') ? lowerType : EXTENSION_BY_MIME_TYPE[lowerType];
  return extension ? `${fileName}${extension}` : fileName;
}
