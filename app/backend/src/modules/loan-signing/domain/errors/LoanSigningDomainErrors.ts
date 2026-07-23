import { DomainError } from '@shared/errors/DomainError';

export class SigningSessionExpiredError extends DomainError {
  constructor() {
    super('SIGNING_SESSION_EXPIRED', 'This signing link has expired or was revoked.', undefined, 410);
    this.name = 'SigningSessionExpiredError';
  }
}

export class OtpVerificationRequiredError extends DomainError {
  /** 403, not 401 - this is a public route with no session/JWT at all, so a 401 here would
   * trigger the frontend's generic "session expired, try to refresh" interceptor (meant for the
   * authenticated staff app), which has nothing to do with this domain's own OTP gate. */
  constructor() {
    super('OTP_VERIFICATION_REQUIRED', 'Please verify the one-time code sent to your phone before continuing.', undefined, 403);
    this.name = 'OtpVerificationRequiredError';
  }
}

export class OtpNotRequestedError extends DomainError {
  constructor() {
    super('OTP_NOT_REQUESTED', 'Request a one-time code first.', undefined, 400);
    this.name = 'OtpNotRequestedError';
  }
}

export class OtpExpiredError extends DomainError {
  constructor() {
    super('OTP_EXPIRED', 'This code has expired. Request a new one.', undefined, 400);
    this.name = 'OtpExpiredError';
  }
}

export class DocumentAlreadySignedError extends DomainError {
  constructor(documentId: string) {
    super('DOCUMENT_ALREADY_SIGNED', `Document "${documentId}" has already been signed.`, undefined, 409);
    this.name = 'DocumentAlreadySignedError';
  }
}

export class ConsentRequiredError extends DomainError {
  constructor() {
    super('CONSENT_REQUIRED', 'You must confirm you have read the document before signing.', undefined, 400);
    this.name = 'ConsentRequiredError';
  }
}

export class NoRequiredDocumentTemplatesError extends DomainError {
  constructor() {
    super('NO_REQUIRED_DOCUMENT_TEMPLATES', 'No required document templates are configured.', undefined, 400);
    this.name = 'NoRequiredDocumentTemplatesError';
  }
}
