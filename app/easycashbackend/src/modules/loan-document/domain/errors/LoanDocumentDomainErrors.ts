import { DomainError } from '@shared/errors/DomainError';

/** ADR-051 §2: documents can only be generated once a loan's terms are final. */
export class LoanNotYetApprovedError extends DomainError {
  constructor(status: string) {
    super(
      'LOAN_NOT_YET_APPROVED',
      `Documents can only be generated once a loan is approved — current status is ${status}.`,
      undefined,
      400,
    );
    this.name = 'LoanNotYetApprovedError';
  }
}

/**
 * ADR-051 §1/§3: a conditional (non-required) document only applies to a loan if its Loan Product
 * is linked to it via `DocumentTemplateMapping`. Required documents never hit this check.
 */
export class DocumentTemplateNotApplicableError extends DomainError {
  constructor(documentTemplateCode: string) {
    super(
      'DOCUMENT_TEMPLATE_NOT_APPLICABLE',
      `"${documentTemplateCode}" is not configured for this loan's product.`,
      undefined,
      400,
    );
    this.name = 'DocumentTemplateNotApplicableError';
  }
}

/**
 * 2026-08-09 (Document Templates admin config, user request): a Required template applies to
 * every loan and never carries `DocumentTemplateMapping` rows (see that model's own doc comment)
 * - product mappings can only be edited for a Conditional template. Flip it to Conditional first.
 */
export class DocumentTemplateIsRequiredError extends DomainError {
  constructor(documentTemplateCode: string) {
    super(
      'DOCUMENT_TEMPLATE_IS_REQUIRED',
      `"${documentTemplateCode}" is Required and applies to every loan — switch it to Conditional before editing its product mapping.`,
      undefined,
      409,
    );
    this.name = 'DocumentTemplateIsRequiredError';
  }
}

/**
 * ADR-051 §2/§9: the `.docx` file for a template hasn't been placed under
 * `app/backend/templates/` yet (the user edits these in Word, one at a time) — a configuration
 * gap, not a user input error, so the frontend should show "not available yet" rather than a
 * generic failure.
 */
export class TemplateFileNotConfiguredError extends DomainError {
  constructor(documentTemplateCode: string) {
    super(
      'TEMPLATE_FILE_NOT_CONFIGURED',
      `The template file for "${documentTemplateCode}" has not been uploaded yet.`,
      undefined,
      409,
    );
    this.name = 'TemplateFileNotConfiguredError';
  }
}
