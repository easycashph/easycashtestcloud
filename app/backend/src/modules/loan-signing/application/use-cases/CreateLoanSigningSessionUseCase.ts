import { NotFoundError, ValidationError } from '@shared/errors/DomainError';
import { env } from '@shared/config/env';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { IDocumentTemplateRepository } from '@modules/loan-document/application/ports/IDocumentTemplateRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import type { GenerateLoanDocumentUseCase } from '@modules/loan-document/application/use-cases/GenerateLoanDocumentUseCase';
import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import type { IEmailGateway } from '@modules/email-reminder/application/ports/IEmailGateway';
import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';
import { LoanSigningSession, type SigningPartyType } from '../../domain/LoanSigningSession';
import {
  NoCoBorrowerLinkedError,
  NoDocumentsForPartyError,
  NoEmailOnFileError,
  NoPhoneNumberOnFileError,
  NoRequiredDocumentTemplatesError,
} from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import { generateSigningToken, hashSigningSecret } from '../../infrastructure/signingTokenHash';

const SESSION_TTL_DAYS = 7;

/** 2026-07-28 - which channel delivers the signing link. OTP verification always stays on SMS
 * regardless (it's a plain numeric code, unaffected by the link-filtering that motivated this
 * channel choice in the first place) - only the initial link-send needs an alternative. */
export type SigningLinkChannel = 'SMS' | 'EMAIL';

export interface CreateLoanSigningSessionUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  generateLoanDocumentUseCase: GenerateLoanDocumentUseCase;
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  borrowerRepository: IBorrowerRepository;
  coBorrowerRepository: ICoBorrowerRepository;
  smsGateway: ISmsGateway;
  emailGateway: IEmailGateway;
}

/**
 * 2026-07-22 (e-signature). Batches every applicable `DocumentTemplate` - REQUIRED plus whichever
 * CONDITIONAL templates are mapped to this loan account's specific product (via
 * `DocumentTemplateMapping`) - into one signing session, filtered to whichever party this batch is
 * for (2026-07-25: `partyType` - `requiresBorrowerSignature`/`requiresCoBorrowerSignature` on each
 * template decides membership; a template needing both parties appears in BOTH batches, using the
 * SAME underlying `GeneratedLoanDocument`, so the co-borrower's signature lands on the SAME PDF the
 * borrower already signed - see `SignLoanSigningDocumentUseCase`). Generates any document that
 * doesn't already have a `GeneratedLoanDocument` on file yet (reuses the same
 * `GenerateLoanDocumentUseCase` the Documents tab's "Generate" button calls), then sends a single
 * SMS with the signing link - one link, one OTP verification, every document in the batch signed
 * in the same visit.
 *
 * For a CO_BORROWER batch, `phoneNumber` is staff-entered in the same box/flow as BORROWER
 * (2026-07-25 revised user decision) - only the SIGNER'S IDENTITY (the `CoBorrower` profile linked
 * to this loan's borrower, used for the audit trail's name and the `coBorrowerId` FK) is required
 * to already exist; the phone number itself is never read from that profile, so staff can send to
 * an updated/different number without first editing the CoBorrower record.
 *
 * 2026-07-28 (email delivery channel): `channel` picks which channel delivers the INITIAL LINK -
 * added after confirming some Smart-network numbers silently filter/drop link-containing SMS (a
 * plain-text SMS to the same number went through fine). For `channel: 'EMAIL'`, both the email
 * address AND the phone number (still needed for OTP - see `SigningLinkChannel`'s own doc comment)
 * are auto-read from the party's profile, NOT staff-entered - `phoneNumber` is ignored when
 * supplied for an EMAIL-channel send.
 */
export class CreateLoanSigningSessionUseCase {
  constructor(private readonly deps: CreateLoanSigningSessionUseCaseDeps) {}

  async execute(
    loanAccountId: string,
    phoneNumber: string | undefined,
    createdByUserId: string,
    createdByIp: string | undefined,
    partyType: SigningPartyType = 'BORROWER',
    channel: SigningLinkChannel = 'SMS',
  ): Promise<{ session: LoanSigningSession; rawToken: string }> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', loanAccountId);

    let coBorrowerId: string | undefined;
    let coBorrowerEmail: string | undefined;
    let coBorrowerPhone: string | undefined;
    if (partyType === 'CO_BORROWER') {
      // 2026-07-28 bug fix: two DIFFERENT, non-overlapping linkage mechanisms exist in the live
      // data, and this previously checked only one of them. (1) `LoanAccountCoBorrower` - the
      // per-loan join (`loanAccount.coBorrowerIds`) - every CP12-migrated co-borrower uses ONLY
      // this; their `CoBorrower.borrowerId` is null. (2) `CoBorrower.borrowerId` - the direct
      // per-Borrower FK (ADR-015, "visible on every one of the client's loans") -
      // `CreateCoBorrowerUseCase` sets ONLY this, never touching the join table. Checking just
      // `findByBorrowerId` (the original code) meant every migrated loan's co-borrower was
      // invisible here; checking just the join would miss every co-borrower added via the newer
      // per-Borrower flow. Check the loan-level join first (more specific to this exact loan),
      // then fall back to the per-Borrower FK.
      const firstCoBorrowerId = loanAccount.coBorrowerIds[0];
      const coBorrower = firstCoBorrowerId
        ? await this.deps.coBorrowerRepository.findById(firstCoBorrowerId)
        : (await this.deps.coBorrowerRepository.findByBorrowerId(loanAccount.borrowerId))[0];
      if (!coBorrower) throw new NoCoBorrowerLinkedError();
      coBorrowerId = coBorrower.id;
      coBorrowerEmail = coBorrower.emailAddress;
      coBorrowerPhone = coBorrower.phoneNumber ?? undefined;
    }

    let recipientPhoneNumber: string;
    let recipientEmail: string | undefined;
    if (channel === 'EMAIL') {
      if (partyType === 'CO_BORROWER') {
        recipientEmail = coBorrowerEmail;
        recipientPhoneNumber = coBorrowerPhone ?? '';
      } else {
        const borrower = await this.deps.borrowerRepository.findById(loanAccount.borrowerId);
        if (!borrower) throw new NotFoundError('Borrower', loanAccount.borrowerId);
        recipientEmail = borrower.email;
        recipientPhoneNumber = borrower.mobilePhone1 ?? '';
      }
      if (!recipientEmail) throw new NoEmailOnFileError(partyType);
      if (!recipientPhoneNumber) throw new NoPhoneNumberOnFileError(partyType);
    } else {
      if (!phoneNumber) throw new ValidationError('phoneNumber is required for an SMS-channel signing session.');
      recipientPhoneNumber = phoneNumber;
    }

    const requiredTemplates = await this.deps.documentTemplateRepository.findRequired();
    if (requiredTemplates.length === 0) throw new NoRequiredDocumentTemplatesError();

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(loanAccount.loanProductVersionId);
    const conditionalTemplates = loanProductVersion
      ? await this.deps.documentTemplateRepository.findConditionalForLoanProduct(loanProductVersion.loanProductId)
      : [];

    const applicableTemplates = [...requiredTemplates, ...conditionalTemplates]
      .filter((t) => (partyType === 'CO_BORROWER' ? t.requiresCoBorrowerSignature : t.requiresBorrowerSignature))
      .sort((a, b) => a.sortIndex - b.sortIndex);
    if (applicableTemplates.length === 0) throw new NoDocumentsForPartyError(partyType);

    const latestPerTemplate = await this.deps.generatedLoanDocumentRepository.findLatestPerTemplateForLoanAccount(loanAccountId);
    const latestByTemplateId = new Map(latestPerTemplate.map((d) => [d.documentTemplateId, d]));

    const documents: { generatedLoanDocumentId: string; sortIndex: number }[] = [];
    for (const template of applicableTemplates) {
      const existing = latestByTemplateId.get(template.id);
      const generatedLoanDocumentId = existing
        ? existing.id
        : (await this.deps.generateLoanDocumentUseCase.execute(loanAccountId, template.code, createdByUserId)).id;
      documents.push({ generatedLoanDocumentId, sortIndex: template.sortIndex });
    }

    const rawToken = generateSigningToken();
    const tokenHash = hashSigningSecret(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const session = LoanSigningSession.create({
      loanAccountId,
      partyType,
      coBorrowerId,
      phoneNumber: recipientPhoneNumber,
      tokenHash,
      expiresAt,
      createdByUserId,
      createdByIp,
      documents,
    });
    await this.deps.loanSigningSessionRepository.create(session);

    const signingUrl = `${env.CORS_ORIGIN}/sign/${rawToken}`;
    const partyLabel = partyType === 'CO_BORROWER' ? ' (co-borrower)' : '';
    if (channel === 'EMAIL') {
      await this.deps.emailGateway.send(
        recipientEmail!,
        'Easycash: Please review and sign your loan document(s)',
        `Please review and sign your loan document(s)${partyLabel} (${documents.length} in total) here: ${signingUrl} - link expires in ${SESSION_TTL_DAYS} days.`,
      );
    } else {
      await this.deps.smsGateway.send(
        recipientPhoneNumber,
        `Easycash: Please review and sign your loan document(s)${partyLabel} (${documents.length} in total) here: ${signingUrl} - link expires in ${SESSION_TTL_DAYS} days.`,
      );
    }

    return { session, rawToken };
  }
}
