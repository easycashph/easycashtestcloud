export interface StampSignatureInput {
  /** The already-generated document's PDF bytes (read from the original `GeneratedLoanDocument`'s
   * storage key) - never mutated in place, a new stamped buffer is returned. */
  pdfBuffer: Buffer;
  /** A PNG signature image, either a raw base64 string or a `data:image/png;base64,...` data URL. */
  signatureImagePng: string;
  signerName: string;
  signedAtIso: string;
  ipAddress?: string;
}

export interface IDocumentSignatureStamper {
  /** Stamps the signature image plus a short audit line (name, timestamp, IP) onto the last page
   * of the PDF and returns the new PDF bytes. */
  stamp(input: StampSignatureInput): Promise<Buffer>;
}
