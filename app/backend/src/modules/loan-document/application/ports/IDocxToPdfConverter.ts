/**
 * ADR-051 §4: converts a filled `.docx` buffer to PDF. `LibreOfficeDocxToPdfConverter` (headless
 * `soffice`) is the only implementation — kept behind this port so the generation use case doesn't
 * know or care that LibreOffice is the mechanism.
 */
export interface IDocxToPdfConverter {
  convert(docxBuffer: Buffer): Promise<Buffer>;
}
