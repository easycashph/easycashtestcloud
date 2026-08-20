import { randomUUID } from 'node:crypto';
import { NotFoundError } from '@shared/errors/DomainError';
import { DocumentAlreadySignedError, OtpExpiredError, OtpNotRequestedError } from './errors/LoanSigningDomainErrors';

/** Minutes an `otpVerifiedAt` timestamp stays valid before a resumed session needs a fresh OTP
 * (2026-07-22 user decision: resume where you left off, but re-verify for security). Long enough
 * to cover one realistic signing sitting (reading + signing several documents), short enough that
 * a lost/forwarded phone can't sit "verified" indefinitely. */
const OTP_REVERIFY_MINUTES = 30;

export interface SigningDocumentEntry {
  id: string;
  generatedLoanDocumentId: string;
  sortIndex: number;
  signedAt?: Date;
  signedStorageKey?: string;
  signedByIp?: string;
  signedUserAgent?: string;
}

export type SigningPartyType = 'BORROWER' | 'CO_BORROWER';

/** 2026-07-28 - which channel delivers the link. The OTP (see `RequestSigningOtpUseCase`) always
 * follows this SAME channel - a link sent by email gets its OTP by email too - rather than being
 * an independent toggle, since a number that can't receive the link (telco link-filtering) likely
 * can't receive an OTP SMS either for the same reason.
 * 2026-08-20 (Portal e-signature): 'PORTAL' - no SMS/email link is sent at all; the session shows
 * up automatically on the borrower's Portal dashboard (see ListPortalSigningSessionsUseCase) and is
 * opened/authorized by their Portal login instead of a raw token. Only valid for `partyType:
 * 'BORROWER'` - co-borrowers have no Portal login (`PortalAccount.borrowerId` only ever points at a
 * Borrower, never a CoBorrower). The OTP still goes out (by email if on file, else SMS), same as
 * every other channel - see this file's own OTP-follows-channel note above. */
export type SigningLinkChannel = 'SMS' | 'EMAIL' | 'PORTAL';

export interface LoanSigningSessionProps {
  id: string;
  loanAccountId: string;
  partyType: SigningPartyType;
  coBorrowerId?: string;
  phoneNumber: string;
  channel: SigningLinkChannel;
  email?: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  otpCodeHash?: string;
  otpExpiresAt?: Date;
  otpVerifiedAt?: Date;
  createdByUserId: string;
  createdByIp?: string;
  createdAt: Date;
  documents: SigningDocumentEntry[];
}

export interface CreateLoanSigningSessionProps {
  loanAccountId: string;
  partyType: SigningPartyType;
  coBorrowerId?: string;
  phoneNumber: string;
  channel: SigningLinkChannel;
  email?: string;
  tokenHash: string;
  expiresAt: Date;
  createdByUserId: string;
  createdByIp?: string;
  documents: { generatedLoanDocumentId: string; sortIndex: number }[];
}

/**
 * 2026-07-22 (e-signature, phase 1). One SMS link → one session → every required document signed
 * in the same visit. The raw link token and OTP code never reach this class or persistence -
 * only their HMAC-SHA256 hashes are compared (see `infrastructure/signingTokenHash.ts`), mirroring
 * `RefreshToken.tokenHash`'s own scheme.
 */
export class LoanSigningSession {
  private constructor(private readonly props: LoanSigningSessionProps) {}

  static create(input: CreateLoanSigningSessionProps): LoanSigningSession {
    return new LoanSigningSession({
      id: randomUUID(),
      loanAccountId: input.loanAccountId,
      partyType: input.partyType,
      coBorrowerId: input.coBorrowerId,
      phoneNumber: input.phoneNumber,
      channel: input.channel,
      email: input.email,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdByUserId: input.createdByUserId,
      createdByIp: input.createdByIp,
      createdAt: new Date(),
      documents: input.documents.map((d) => ({
        id: randomUUID(),
        generatedLoanDocumentId: d.generatedLoanDocumentId,
        sortIndex: d.sortIndex,
      })),
    });
  }

  static reconstitute(props: LoanSigningSessionProps): LoanSigningSession {
    return new LoanSigningSession(props);
  }

  get id(): string {
    return this.props.id;
  }

  get loanAccountId(): string {
    return this.props.loanAccountId;
  }

  get partyType(): SigningPartyType {
    return this.props.partyType;
  }

  get coBorrowerId(): string | undefined {
    return this.props.coBorrowerId;
  }

  get phoneNumber(): string {
    return this.props.phoneNumber;
  }

  get channel(): SigningLinkChannel {
    return this.props.channel;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | undefined {
    return this.props.revokedAt;
  }

  get otpVerifiedAt(): Date | undefined {
    return this.props.otpVerifiedAt;
  }

  get createdByUserId(): string {
    return this.props.createdByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get documents(): readonly SigningDocumentEntry[] {
    return this.props.documents;
  }

  isExpiredOrRevoked(now = new Date()): boolean {
    return Boolean(this.props.revokedAt) || this.props.expiresAt.getTime() < now.getTime();
  }

  isOtpVerifiedFresh(now = new Date()): boolean {
    if (!this.props.otpVerifiedAt) return false;
    const reverifyDeadline = this.props.otpVerifiedAt.getTime() + OTP_REVERIFY_MINUTES * 60 * 1000;
    return now.getTime() < reverifyDeadline;
  }

  isFullySigned(): boolean {
    return this.props.documents.every((d) => Boolean(d.signedAt));
  }

  findDocument(documentId: string): SigningDocumentEntry | undefined {
    return this.props.documents.find((d) => d.id === documentId);
  }

  setOtp(otpCodeHash: string, otpExpiresAt: Date): void {
    this.props.otpCodeHash = otpCodeHash;
    this.props.otpExpiresAt = otpExpiresAt;
  }

  /** Returns `false` on a wrong code (caller decides how to respond) rather than throwing - a
   * mistyped code is an expected user error, not exceptional. Throws only for the genuinely
   * exceptional cases: no OTP was ever requested, or it expired. */
  verifyOtp(candidateHash: string, now = new Date()): boolean {
    if (!this.props.otpCodeHash || !this.props.otpExpiresAt) throw new OtpNotRequestedError();
    if (this.props.otpExpiresAt.getTime() < now.getTime()) throw new OtpExpiredError();
    if (this.props.otpCodeHash !== candidateHash) return false;
    this.props.otpVerifiedAt = now;
    this.props.otpCodeHash = undefined;
    this.props.otpExpiresAt = undefined;
    return true;
  }

  markDocumentSigned(
    documentId: string,
    signedStorageKey: string,
    signedByIp: string | undefined,
    signedUserAgent: string | undefined,
    now = new Date(),
  ): void {
    const doc = this.props.documents.find((d) => d.id === documentId);
    if (!doc) throw new NotFoundError('LoanSigningDocument', documentId);
    if (doc.signedAt) throw new DocumentAlreadySignedError(documentId);
    doc.signedAt = now;
    doc.signedStorageKey = signedStorageKey;
    doc.signedByIp = signedByIp;
    doc.signedUserAgent = signedUserAgent;
  }

  toProps(): Readonly<LoanSigningSessionProps> {
    return { ...this.props, documents: this.props.documents.map((d) => ({ ...d })) };
  }
}
