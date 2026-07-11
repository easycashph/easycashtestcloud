/** Mirrors `app/backend`'s `ExtractLoanApplicationFieldsUseCase` output shape. Ephemeral —
 * this endpoint never persists the uploaded file. */
export interface ExtractedLoanApplicationFields {
  applicantName?: string;
  age?: number;
  address?: string;
  employer?: string;
  monthlyIncome?: number;
  summary: string;
  warnings: string[];
}
