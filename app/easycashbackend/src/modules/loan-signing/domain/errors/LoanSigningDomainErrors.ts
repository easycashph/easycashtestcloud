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

/** 2026-07-25 (two-party signing) - thrown when "Send for Co-Borrower Signing" is attempted but no
 * CoBorrower profile is linked to this loan's borrower yet (create one via "Create Client Profile"
 * or the client's own profile page first - the phone number itself is staff-entered per-send, not
 * read from this profile, but the profile itself must exist for the signer's name/identity). */
export class NoCoBorrowerLinkedError extends DomainError {
  constructor() {
    super('NO_CO_BORROWER_LINKED', 'No co-borrower is linked to this loan account yet.', undefined, 400);
    this.name = 'NoCoBorrowerLinkedError';
  }
}

/** No document template requires this party's signature (e.g. a loan product with no
 * co-borrower-signed conditional templates mapped to it) - "Send for Co-Borrower Signing" would
 * have nothing to send. */
export class NoDocumentsForPartyError extends DomainError {
  constructor(partyType: string) {
    super('NO_DOCUMENTS_FOR_PARTY', `No documents require a ${partyType} signature for this loan.`, undefined, 400);
    this.name = 'NoDocumentsForPartyError';
  }
}

/** 2026-07-28 (email delivery channel) - thrown when "Send via Email" is attempted but the party
 * (Borrower or CoBorrower) has no email address on file. Unlike the SMS channel's phone number
 * (always staff-entered per-send), the email address is deliberately auto-read from the profile,
 * not typed by staff - so there is no staff-entered fallback here; the profile must be updated
 * with an email address first. */
export class NoEmailOnFileError extends DomainError {
  constructor(partyType: string) {
    super('NO_EMAIL_ON_FILE', `No email address is on file for the ${partyType.toLowerCase()}.`, undefined, 400);
    this.name = 'NoEmailOnFileError';
  }
}

/** 2026-07-28 (email delivery channel) - OTP verification always goes out via SMS regardless of
 * which channel delivered the initial link (a plain numeric code isn't affected by the
 * link-filtering issue that motivated the email channel), so a phone number is still required even
 * for an EMAIL-channel send - auto-read from the profile in that case, same as the email address. */
/** 2026-08-20 (Portal e-signature) - thrown when "Send via Portal" is attempted but the borrower
 * has no linked `PortalAccount` yet. Unlike SMS/email, a Portal-channel session cannot fall back to
 * a staff-entered value - the borrower must already have a Portal login for the session to be
 * reachable at all. */
export class NoPortalAccountLinkedError extends DomainError {
  constructor() {
    super('NO_PORTAL_ACCOUNT_LINKED', 'This borrower has no Easycash Portal account linked yet.', undefined, 400);
    this.name = 'NoPortalAccountLinkedError';
  }
}

export class NoPhoneNumberOnFileError extends DomainError {
  constructor(partyType: string) {
    super(
      'NO_PHONE_NUMBER_ON_FILE',
      `No phone number is on file for the ${partyType.toLowerCase()} - one is still required to deliver the OTP code.`,
      undefined,
      400,
    );
    this.name = 'NoPhoneNumberOnFileError';
  }
}
