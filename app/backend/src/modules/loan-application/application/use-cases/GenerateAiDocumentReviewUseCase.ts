import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanApplicationRepository } from '../ports/ILoanApplicationRepository';
import type { AiDocumentReviewResult } from '../../interface/http/dto/AiDocumentReviewResult';

export interface GenerateAiDocumentReviewUseCaseDeps {
  loanApplicationRepository: ILoanApplicationRepository;
}

/** Builds the "Assist" panel content shown above the Credit Evaluation Report.
 *
 * MOCKED (2026-07-22) — returns a deterministic placeholder, not a real model call. See the
 * doc comment on `AiDocumentReviewResult` for why, and what changes when a real model is wired
 * up (local Ollama vs. cloud Claude API is still an open decision). Reads `submittedDocuments`
 * off the real application record so the checklist at least reflects real document names, but
 * every judgment (status/flagged/risk/recommendation) is canned text, never analysis. */
export class GenerateAiDocumentReviewUseCase {
  constructor(private readonly deps: GenerateAiDocumentReviewUseCaseDeps) {}

  async execute(applicationId: string): Promise<AiDocumentReviewResult> {
    const application = await this.deps.loanApplicationRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError('LoanApplication', applicationId);
    }

    const submittedDocuments = application.toProps().submittedDocuments;
    const documentChecklist: AiDocumentReviewResult['documentChecklist'] =
      submittedDocuments.length > 0
        ? submittedDocuments.map((document) => {
            const looksLikePayslip = /payslip|pay slip/i.test(document);
            return looksLikePayslip
              ? {
                  document,
                  status: 'NEEDS_ATTENTION' as const,
                  note: '[Preview] Placeholder flag — image-quality checking is not yet implemented.',
                }
              : {
                  document,
                  status: 'OK' as const,
                  note: '[Preview] Placeholder — not yet checked against real content.',
                };
          })
        : [];

    return {
      mock: true,
      riskLevel: 'MEDIUM',
      recommendation:
        '[Preview] This is placeholder text — no real AI analysis is connected yet. Once a model is wired up, this will summarize document consistency and suggest a risk level here.',
      keyFactors: [
        '[Preview] Real document cross-checking is not implemented yet.',
        `[Preview] ${submittedDocuments.length} document(s) on file for this application.`,
      ],
      crossChecks: [
        { label: 'Name on ID vs. application', result: '[Preview] Not yet checked', flagged: false },
        { label: 'Employer on ID vs. declared employer', result: '[Preview] Not yet checked', flagged: false },
        { label: 'Payslip income vs. declared monthly income', result: '[Preview] Not yet checked', flagged: false },
      ],
      documentChecklist,
    };
  }
}
