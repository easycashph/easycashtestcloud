/** Response shape for POST /loan-applications/:id/ai-document-review.
 *
 * 2026-07-22: this endpoint is intentionally MOCKED — no model client is wired up yet (local
 * Ollama vs. cloud Claude API is still an open decision, see docs/Claude_API_Cost_Reference.docx).
 * Every field is a deterministic placeholder built from data already on the application record,
 * never a real credit judgment. The `mock: true` flag and the "[Preview]" prefixes on
 * user-facing text exist so nobody mistakes this for a real assessment before the real model
 * integration lands. When that lands, swap `GenerateAiDocumentReviewUseCase`'s body for a real
 * model call and this type stays the same. */
export interface AiDocumentReviewResult {
  mock: true;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  keyFactors: string[];
  crossChecks: Array<{ label: string; result: string; flagged: boolean }>;
  documentChecklist: Array<{ document: string; status: 'OK' | 'NEEDS_ATTENTION'; note: string }>;
}
