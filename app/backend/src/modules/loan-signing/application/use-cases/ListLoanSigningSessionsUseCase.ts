import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import type { IDocumentTemplateRepository } from '@modules/loan-document/application/ports/IDocumentTemplateRepository';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';

export interface StaffSigningSessionDocumentView {
  id: string;
  name: string;
  signed: boolean;
}

export interface StaffSigningSessionView {
  id: string;
  loanAccountId: string;
  partyType: 'BORROWER' | 'CO_BORROWER';
  phoneNumber: string;
  expiresAt: string;
  revokedAt: string | null;
  otpVerifiedAt: string | null;
  createdAt: string;
  totalDocuments: number;
  signedDocuments: number;
  fullySigned: boolean;
  documents: StaffSigningSessionDocumentView[];
}

export interface ListLoanSigningSessionsUseCaseDeps {
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
}

/** Staff-side (authenticated) status list for the "E-signature" panel - newest first. Resolves
 * each document's template name (mirroring the public `GetLoanSigningSessionUseCase`'s own lookup)
 * so the panel can show a "View signed document" link per document, not just an aggregate count. */
export class ListLoanSigningSessionsUseCase {
  constructor(private readonly deps: ListLoanSigningSessionsUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<StaffSigningSessionView[]> {
    const sessions = await this.deps.loanSigningSessionRepository.findManyByLoanAccountId(loanAccountId);

    const views: StaffSigningSessionView[] = [];
    for (const session of sessions) {
      const p = session.toProps();
      const documents: StaffSigningSessionDocumentView[] = [];
      for (const entry of [...p.documents].sort((a, b) => a.sortIndex - b.sortIndex)) {
        const generatedDoc = await this.deps.generatedLoanDocumentRepository.findById(entry.generatedLoanDocumentId);
        const template = generatedDoc ? await this.deps.documentTemplateRepository.findById(generatedDoc.documentTemplateId) : null;
        documents.push({ id: entry.id, name: template?.name ?? 'Document', signed: Boolean(entry.signedAt) });
      }

      views.push({
        id: p.id,
        loanAccountId: p.loanAccountId,
        partyType: p.partyType,
        phoneNumber: p.phoneNumber,
        expiresAt: p.expiresAt.toISOString(),
        revokedAt: p.revokedAt?.toISOString() ?? null,
        otpVerifiedAt: p.otpVerifiedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        totalDocuments: documents.length,
        signedDocuments: documents.filter((d) => d.signed).length,
        fullySigned: documents.every((d) => d.signed),
        documents,
      });
    }
    return views;
  }
}
