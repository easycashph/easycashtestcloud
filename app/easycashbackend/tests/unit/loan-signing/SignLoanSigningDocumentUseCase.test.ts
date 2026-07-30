import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignLoanSigningDocumentUseCase } from '@modules/loan-signing/application/use-cases/SignLoanSigningDocumentUseCase';
import { LoanSigningSession, type SigningPartyType } from '@modules/loan-signing/domain/LoanSigningSession';
import { hashSigningSecret } from '@modules/loan-signing/infrastructure/signingTokenHash';

const RAW_TOKEN = 'raw-token-123';
const GENERATED_DOC_ID = 'gen-doc-1';

function buildSession(opts: {
  partyType: SigningPartyType;
  documentSignedAt?: Date;
  documentSignedStorageKey?: string;
  otpVerifiedAt?: Date;
}) {
  const base = LoanSigningSession.create({
    loanAccountId: 'loan-1',
    partyType: opts.partyType,
    phoneNumber: '09171234567',
    channel: 'SMS',
    tokenHash: hashSigningSecret(RAW_TOKEN),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdByUserId: 'staff-1',
    documents: [{ generatedLoanDocumentId: GENERATED_DOC_ID, sortIndex: 1 }],
  });
  const props = base.toProps();
  return LoanSigningSession.reconstitute({
    ...props,
    otpVerifiedAt: opts.otpVerifiedAt ?? new Date(),
    documents: props.documents.map((d) => ({
      ...d,
      signedAt: opts.documentSignedAt,
      signedStorageKey: opts.documentSignedStorageKey,
    })),
  });
}

function buildDeps() {
  const loanSigningSessionRepository = {
    findByTokenHash: vi.fn(),
    findManyByLoanAccountId: vi.fn(),
    save: vi.fn(),
  };
  const loanAccountRepository = { findById: vi.fn().mockResolvedValue({ id: 'loan-1', borrowerId: 'borrower-1' }) };
  const borrowerRepository = { findById: vi.fn().mockResolvedValue({ name: { fullName: () => 'Juan Dela Cruz' } }) };
  const coBorrowerRepository = { findById: vi.fn().mockResolvedValue({ name: { fullName: () => 'Maria Dela Cruz' } }) };
  const generatedLoanDocumentRepository = {
    findById: vi.fn().mockResolvedValue({ id: GENERATED_DOC_ID, documentTemplateId: 'tmpl-1', storageKey: 'original.pdf' }),
  };
  const documentTemplateRepository = { findById: vi.fn().mockResolvedValue({ code: 'PROMISSORY_NOTE' }) };
  const fileStorage = {
    read: vi.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const signatureStamper = { stamp: vi.fn().mockResolvedValue(Buffer.from('stamped-pdf-bytes')) };
  return {
    loanSigningSessionRepository,
    loanAccountRepository,
    borrowerRepository,
    coBorrowerRepository,
    generatedLoanDocumentRepository,
    documentTemplateRepository,
    fileStorage,
    signatureStamper,
  };
}

describe('SignLoanSigningDocumentUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stamps onto the OPPOSITE party\'s already-signed PDF, not the pristine original, when one exists', async () => {
    const deps = buildDeps();
    const coBorrowerSigned = buildSession({
      partyType: 'CO_BORROWER',
      documentSignedAt: new Date('2026-07-29T10:00:00Z'),
      documentSignedStorageKey: 'co-borrower-signed.pdf',
    });
    const borrowerSigning = buildSession({ partyType: 'BORROWER' });
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(borrowerSigning);
    deps.loanSigningSessionRepository.findManyByLoanAccountId.mockResolvedValue([coBorrowerSigned, borrowerSigning]);

    const useCase = new SignLoanSigningDocumentUseCase(deps);
    await useCase.execute({
      rawToken: RAW_TOKEN,
      signingDocumentId: borrowerSigning.documents[0].id,
      consentChecked: true,
      signatureImagePng: 'data:image/png;base64,AAAA',
    });

    expect(deps.fileStorage.read).toHaveBeenCalledWith('co-borrower-signed.pdf');
  });

  it('real bug regression: does NOT stamp onto the SAME party\'s own prior signed PDF from a different session', async () => {
    // 2026-07-29: an earlier BORROWER session already signed this same document (e.g. a prior test
    // sitting). A brand new BORROWER session signing the same document must start from the PRISTINE
    // original, never from that earlier same-party signed copy - otherwise the new signature stamps
    // on top of the old one, doubling the audit text and signature ink at the same position.
    const deps = buildDeps();
    const earlierBorrowerSigned = buildSession({
      partyType: 'BORROWER',
      documentSignedAt: new Date('2026-07-29T09:00:00Z'),
      documentSignedStorageKey: 'stale-borrower-signed.pdf',
    });
    const newBorrowerSigning = buildSession({ partyType: 'BORROWER' });
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(newBorrowerSigning);
    deps.loanSigningSessionRepository.findManyByLoanAccountId.mockResolvedValue([earlierBorrowerSigned, newBorrowerSigning]);

    const useCase = new SignLoanSigningDocumentUseCase(deps);
    await useCase.execute({
      rawToken: RAW_TOKEN,
      signingDocumentId: newBorrowerSigning.documents[0].id,
      consentChecked: true,
      signatureImagePng: 'data:image/png;base64,AAAA',
    });

    expect(deps.fileStorage.read).toHaveBeenCalledWith('original.pdf');
    expect(deps.fileStorage.read).not.toHaveBeenCalledWith('stale-borrower-signed.pdf');
  });

  it('falls back to the pristine original when no other session has signed this document yet', async () => {
    const deps = buildDeps();
    const signing = buildSession({ partyType: 'BORROWER' });
    deps.loanSigningSessionRepository.findByTokenHash.mockResolvedValue(signing);
    deps.loanSigningSessionRepository.findManyByLoanAccountId.mockResolvedValue([signing]);

    const useCase = new SignLoanSigningDocumentUseCase(deps);
    await useCase.execute({
      rawToken: RAW_TOKEN,
      signingDocumentId: signing.documents[0].id,
      consentChecked: true,
      signatureImagePng: 'data:image/png;base64,AAAA',
    });

    expect(deps.fileStorage.read).toHaveBeenCalledWith('original.pdf');
  });
});
