/** Mirrors `app/backend`'s `ExtractLoanApplicationFieldsUseCase` output shape. Ephemeral -
 * this endpoint never persists the uploaded file. */
export interface ExtractedLoanApplicationFields {
  applicantName?: string;
  age?: number;
  /** ISO `YYYY-MM-DD`, ready to drop into an `<input type="date">` as-is. */
  dateOfBirth?: string;
  /** Exactly `MALE` or `FEMALE`, matching `GENDER_OPTIONS`. */
  gender?: string;
  nationality?: string;
  address?: string;
  employer?: string;
  monthlyIncome?: number;
  summary: string;
  warnings: string[];
}
