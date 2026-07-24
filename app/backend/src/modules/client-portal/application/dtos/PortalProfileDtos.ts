import type { CreateBorrowerAddressInput } from '@modules/borrower/application/dtos/BorrowerDtos';

/**
 * Phase D (2026-07-24 user request, confirmed scope): contact info ONLY - mobile number(s),
 * email, and present address. Deliberately excludes name, employment/income, government IDs, and
 * every other Borrower field - those stay staff-editable-only for now (a wider self-service scope
 * was explicitly NOT requested).
 */
export interface UpdatePortalProfileInput {
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  addresses?: CreateBorrowerAddressInput[];
}
