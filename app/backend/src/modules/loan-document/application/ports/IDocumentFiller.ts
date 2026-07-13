/**
 * ADR-051 §4: fills a `.docx` template's `{Placeholder}` merge fields with real data.
 * `DocxtemplaterDocumentFiller` is the only implementation — this port exists so
 * `GenerateLoanDocumentUseCase` doesn't depend on the docxtemplater/pizzip libraries directly.
 */
export interface IDocumentFiller {
  /**
   * @param templateCode matches `DocumentTemplate.code` — the implementation resolves this to a
   *   `.docx` file path (`app/backend/templates/<code>.docx`).
   * @throws TemplateFileNotConfiguredError if that file doesn't exist yet (ADR-051 §9).
   */
  fill(templateCode: string, data: Record<string, string>): Promise<Buffer>;
}
