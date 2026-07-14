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
   * @param data values are usually strings, but an array of row objects is also valid — docxtemplater
   *   repeats a table row for each array entry when the template wraps that row in `{#Field}`/`{/Field}`
   *   tags (used for the Promissory Note's installment schedule table).
   */
  fill(templateCode: string, data: Record<string, unknown>): Promise<Buffer>;
}
