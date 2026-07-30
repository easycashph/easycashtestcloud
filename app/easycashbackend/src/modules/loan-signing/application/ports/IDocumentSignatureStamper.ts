export interface StampSignatureInput {
  /** The already-generated document's PDF bytes (read from the original `GeneratedLoanDocument`'s
   * storage key) - never mutated in place, a new stamped buffer is returned. */
  pdfBuffer: Buffer;
  /** A PNG signature image, either a raw base64 string or a `data:image/png;base64,...` data URL. */
  signatureImagePng: string;
  signerName: string;
  signedAtIso: string;
  ipAddress?: string;
  /** The `DocumentTemplate.code` this PDF was generated from (e.g. `PROMISSORY_NOTE`) - lets the
   * stamper apply small per-template placement nudges (see `TEMPLATE_OFFSETS` in
   * `PdfLibDocumentSignatureStamper`) on top of the generic anchor-based positioning. */
  templateCode?: string;
  /** 2026-07-25 (two-party signing) - which anchor marker to stamp at: `[[SIGNATURE_ANCHOR]]`
   * (BORROWER, the default - matches every call site before this field existed) or
   * `[[SIGNATURE_ANCHOR_CO_BORROWER]]` (CO_BORROWER). Only a handful of templates carry the
   * second marker (see `DocumentTemplate.requiresCoBorrowerSignature`); templates without it
   * simply have no match, so `findSignatureAnchor` falls back to the default placement same as
   * any other anchor-less template. */
  anchorTarget?: 'BORROWER' | 'CO_BORROWER';
  /** 2026-07-29 (user request) - which channel delivered the OTP for this signature, and the
   * recipient it went to (masked before display - see `maskOtpRecipient` in
   * `PdfLibDocumentSignatureStamper`). Omitted entirely (no audit line drawn) for a session that
   * predates this field or somehow has neither a phone number nor an email captured. */
  otpChannel?: 'SMS' | 'EMAIL';
  otpRecipient?: string;
}

export interface IDocumentSignatureStamper {
  /** Stamps the signature image plus a short audit line (name, timestamp, IP) onto the last page
   * of the PDF and returns the new PDF bytes. */
  stamp(input: StampSignatureInput): Promise<Buffer>;
}
