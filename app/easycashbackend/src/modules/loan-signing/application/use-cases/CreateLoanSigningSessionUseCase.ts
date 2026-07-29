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
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import { LoanSigningSession, type SigningPartyType, type SigningLinkChannel } from '../../domain/LoanSigningSession';
import {
  NoCoBorrowerLinkedError,
  NoDocumentsForPartyError,
  NoEmailOnFileError,
  NoPhoneNumberOnFileError,
  NoRequiredDocumentTemplatesError,
} from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import type { ISigningNotificationLogRepository } from '../ports/ISigningNotificationLogRepository';
import { generateSigningToken, hashSigningSecret } from '../../infrastructure/signingTokenHash';

const SESSION_TTL_DAYS = 7;

/**
 * 2026-07-28 (user-requested) - HTML version of the signing-link email, with a styled button
 * instead of a raw pasted URL. Inline styles only (email clients strip `<style>` blocks and don't
 * support flexbox/grid) - table-free since the content is simple enough not to need it. The
 * plain-text `body` passed alongside this to `IEmailGateway.send()` remains the fallback for
 * clients that don't render HTML.
 */
function buildSigningEmailHtml(params: { partyLabel: string; documentCount: number; signingUrl: string; ttlDays: number }): string {
  return `<div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
  <p style="font-size: 16px; line-height: 1.6;">Hi! Please review and sign ${params.documentCount} loan document(s)${params.partyLabel} for your Easycash loan.</p>
  <p style="text-align: center; margin: 32px 0;">
    <a href="${params.signingUrl}" style="display: inline-block; padding: 14px 28px; background-color: #0f766e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">Review and Sign Documents</a>
  </p>
  <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">This link expires in ${params.ttlDays} days. If the button above doesn't work, copy and paste this address into your browser:<br />${params.signingUrl}</p>
  <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">Easycash Lending Company Inc.</p>
</div>`;
}

export type { SigningLinkChannel };

export interface CreateLoanSigningSessionUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  generateLoanDocumentUseCase: GenerateLoanDocumentUseCase;
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  signingNotificationLogRepository: ISigningNotificationLogRepository;
  borrowerRepository: IBorrowerRepository;
  coBorrowerRepository: ICoBorrowerRepository;
  loanApplicationRepository: ILoanApplicationRepository;
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
 * address AND the phone number are auto-read from the party's profile, NOT staff-entered -
 * `phoneNumber` is ignored when supplied for an EMAIL-channel send. The OTP (`RequestSigningOtpUseCase`)
 * follows this SAME channel (see `SigningLinkChannel`'s own doc comment in the domain module) -
 * the phone number is still captured here even for EMAIL so the session record keeps it for audit
 * purposes, but it is no longer used to deliver the OTP for an EMAIL-channel session.
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

    // 2026-07-29 (user request): the two "Deed of Assignment" templates are mutually exclusive per
    // loan - whichever party the surrendered ATM/allotment account actually belongs to (captured on
    // the originating LoanApplication's Underwriting review, `MitigationDetails.accountOwner`, and
    // required there whenever any other mitigation field is filled and a co-borrower is present)
    // determines which one applies, not simply which batch is being sent. When `accountOwner` is
    // unset (no co-borrower, or mitigation section never used), default to Borrower's Deed of
    // Assignment applying - the pre-existing behavior for every loan without this new field.
    let mitigationAccountOwner: 'BORROWER' | 'CO_BORROWER' | undefined;
    if (loanAccount.sourceApplicationId) {
      const sourceApplication = await this.deps.loanApplicationRepository.findById(loanAccount.sourceApplicationId);
      mitigationAccountOwner = sourceApplication?.reviewReport?.mitigation?.accountOwner;
    }

    const applicableTemplates = [...requiredTemplates, ...conditionalTemplates]
      .filter((t) => (partyType === 'CO_BORROWER' ? t.requiresCoBorrowerSignature : t.requiresBorrowerSignature))
      .filter((t) => t.code !== 'DEED_OF_ASSIGNMENT_CO_BORROWER' || mitigationAccountOwner === 'CO_BORROWER')
      .filter((t) => t.code !== 'DEED_OF_ASSIGNMENT_BORROWER' || mitigationAccountOwner !== 'CO_BORROWER')
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
      channel,
      email: recipientEmail,
      tokenHash,
      expiresAt,
      createdByUserId,
      createdByIp,
      documents,
    });
    await this.deps.loanSigningSessionRepository.create(session);

    const signingUrl = `${env.CORS_ORIGIN}/sign/${rawToken}`;
    const partyLabel = partyType === 'CO_BORROWER' ? ' (co-borrower)' : '';
    // 2026-07-28 (user-picked wording, option 3): "Hi! Please review and sign..." - used for both
    // the SMS message and the plain-text email fallback, kept identical across channels.
    const messageBody = `Hi! Please review and sign ${documents.length} loan document(s)${partyLabel} for your Easycash loan: ${signingUrl} - valid for ${SESSION_TTL_DAYS} days.`;
    if (channel === 'EMAIL') {
      await this.deps.emailGateway.send(
        recipientEmail!,
        'Easycash: Please review and sign your loan document(s)',
        messageBody,
        buildSigningEmailHtml({ partyLabel, documentCount: documents.length, signingUrl, ttlDays: SESSION_TTL_DAYS }),
      );
    } else {
      await this.deps.smsGateway.send(recipientPhoneNumber, messageBody);
    }

    // 2026-07-29 (user request): "may OTP sms and email log ba tayo?" - log every LINK send so
    // there's a permanent, queryable record of when/how each link was delivered (see
    // SigningNotificationLog's own doc comment). Best-effort - a logging failure must never block
    // the actual send the client is waiting on.
    await this.deps.signingNotificationLogRepository
      .create({
        loanSigningSessionId: session.id,
        loanAccountId,
        type: 'LINK',
        partyType,
        channel,
        recipient: channel === 'EMAIL' ? recipientEmail! : recipientPhoneNumber,
      })
      .catch(() => undefined);

    return { session, rawToken };
  }
}
