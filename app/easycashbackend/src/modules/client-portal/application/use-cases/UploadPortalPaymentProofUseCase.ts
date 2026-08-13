import type { IPortalAccountRepository } from '../ports/IPortalAccountRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { AttachmentRecord } from '@modules/document/application/ports/IAttachmentRepository';
import type { UploadAttachmentUseCase } from '@modules/document/application/use-cases/UploadAttachmentUseCase';
import { PortalNoActiveLoanAccountError } from '../../domain/errors/PortalAuthErrors';

/** Mirrors the LMS's own open-loan definition (see GetPortalNextPaymentDueUseCase's identical
 * constant/doc comment). */
const OPEN_LOAN_ACCOUNT_STATUSES = new Set(['ACTIVE', 'ACTIVE_IN_ARREARS']);

export interface UploadPortalPaymentProofInput {
  portalAccountId: string;
  fileName: string;
  fileType: string;
  data: Buffer;
}

export interface UploadPortalPaymentProofUseCaseDeps {
  portalAccountRepository: IPortalAccountRepository;
  loanAccountRepository: ILoanAccountRepository;
  uploadAttachmentUseCase: UploadAttachmentUseCase;
}

/**
 * Lets a linked Portal client upload a receipt/screenshot for a Bank Transfer payment they made to
 * Easycash's official bank account (2026-08-14 user request - replaces the "email
 * collections@easycash.ph" instruction on the landing page's Ways to Pay card with an in-app
 * upload staff can see directly on the Loan Account's Attachments panel).
 *
 * Deliberately takes no `loanAccountId` from the caller - by business rule a client has at most one
 * open loan account at a time (2026-08-14 user confirmation), so this always resolves it server-side
 * rather than trusting a client-supplied id. If more than one open loan account somehow exists (data
 * anomaly, not the expected case), the most recently activated one is used - a deterministic choice,
 * not a guess.
 */
export class UploadPortalPaymentProofUseCase {
  constructor(private readonly deps: UploadPortalPaymentProofUseCaseDeps) {}

  async execute(input: UploadPortalPaymentProofInput): Promise<AttachmentRecord> {
    const account = await this.deps.portalAccountRepository.findById(input.portalAccountId);
    if (!account?.borrowerId) {
      throw new PortalNoActiveLoanAccountError();
    }

    const loanAccounts = await this.deps.loanAccountRepository.findMany({ borrowerId: account.borrowerId, limit: 200 });
    const openLoanAccounts = loanAccounts.filter((loanAccount) => OPEN_LOAN_ACCOUNT_STATUSES.has(loanAccount.status));
    if (openLoanAccounts.length === 0) {
      throw new PortalNoActiveLoanAccountError();
    }

    const target = openLoanAccounts.reduce((mostRecent, candidate) => {
      const candidateTime = candidate.activatedAt?.getTime() ?? 0;
      const mostRecentTime = mostRecent.activatedAt?.getTime() ?? 0;
      return candidateTime > mostRecentTime ? candidate : mostRecent;
    });

    return this.deps.uploadAttachmentUseCase.execute({
      ownerType: 'LOAN_ACCOUNT',
      ownerId: target.id,
      fileName: input.fileName,
      fileType: input.fileType,
      data: input.data,
      documentCategory: 'PAYMENT_PROOF',
      uploadedByUserId: null,
    });
  }
}
