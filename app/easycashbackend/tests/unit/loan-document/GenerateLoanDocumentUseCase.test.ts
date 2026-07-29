import { describe, expect, it, vi } from 'vitest';
import { GenerateLoanDocumentUseCase } from '@modules/loan-document/application/use-cases/GenerateLoanDocumentUseCase';
import { DocumentTemplateNotApplicableError, LoanNotYetApprovedError } from '@modules/loan-document/domain/errors/LoanDocumentDomainErrors';
import { DocumentTemplate } from '@modules/loan-document/domain/DocumentTemplate';
import { LoanAccount } from '@modules/loan-account/domain/LoanAccount';
import { Money } from '@shared/domain/Money';
import { Percentage } from '@shared/domain/Percentage';
import { NotFoundError } from '@shared/errors/DomainError';

function buildApprovedLoan(): LoanAccount {
  const loan = LoanAccount.create({
    loanCode: 'LN-0001',
    borrowerId: 'borrower-1',
    loanProductVersionId: 'version-1',
    branchId: 'branch-1',
    principalAmount: Money.of('10000.00'),
    interestRate: Percentage.of('2.5'),
    installmentCount: 6,
    firstRepaymentDate: new Date('2026-08-15'),
  });
  loan.approve('approver-1');
  return loan;
}

function buildDeps() {
  return {
    loanAccountRepository: { findById: vi.fn(), findByLoanCode: vi.fn(), findMany: vi.fn(), save: vi.fn() },
    loanProductRepository: { findById: vi.fn(), findByCode: vi.fn(), findMany: vi.fn(), findVersionById: vi.fn(), save: vi.fn() },
    documentTemplateRepository: { findById: vi.fn(), findByCode: vi.fn(), findRequired: vi.fn(), findConditionalForLoanProduct: vi.fn() },
    generatedLoanDocumentRepository: { create: vi.fn(), findById: vi.fn(), findLatestPerTemplateForLoanAccount: vi.fn() },
    mergeDataResolver: { resolve: vi.fn().mockResolvedValue({ BorrowerName: 'Juan Dela Cruz' }) },
    documentFiller: { fill: vi.fn().mockResolvedValue(Buffer.from('docx-bytes')) },
    docxToPdfConverter: { convert: vi.fn().mockResolvedValue(Buffer.from('pdf-bytes')) },
    fileStorage: { save: vi.fn(), read: vi.fn() },
  };
}

const requiredTemplate = DocumentTemplate.reconstitute({ id: 'tmpl-required', code: 'DISCLOSURE_STATEMENT', name: 'Disclosure Statement', isRequired: true, sortIndex: 1 });
const conditionalTemplate = DocumentTemplate.reconstitute({ id: 'tmpl-conditional', code: 'MANULIFE', name: 'Manulife', isRequired: false, sortIndex: 11 });

describe('GenerateLoanDocumentUseCase (ADR-051)', () => {
  it('throws NotFoundError when the loan account does not exist', async () => {
    const deps = buildDeps();
    deps.loanAccountRepository.findById.mockResolvedValue(null);
    const useCase = new GenerateLoanDocumentUseCase(deps);

    await expect(useCase.execute('missing-loan', 'DISCLOSURE_STATEMENT', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('throws LoanNotYetApprovedError when the loan is still PENDING_APPROVAL', async () => {
    const deps = buildDeps();
    const pendingLoan = LoanAccount.create({
      loanCode: 'LN-0002',
      borrowerId: 'borrower-1',
      loanProductVersionId: 'version-1',
      branchId: 'branch-1',
      principalAmount: Money.of('10000.00'),
      interestRate: Percentage.of('2.5'),
      installmentCount: 6,
      firstRepaymentDate: new Date('2026-08-15'),
    });
    deps.loanAccountRepository.findById.mockResolvedValue(pendingLoan);
    const useCase = new GenerateLoanDocumentUseCase(deps);

    await expect(useCase.execute(pendingLoan.id, 'DISCLOSURE_STATEMENT', 'user-1')).rejects.toThrow(LoanNotYetApprovedError);
    expect(deps.documentFiller.fill).not.toHaveBeenCalled();
  });

  it('throws DocumentTemplateNotApplicableError for a conditional template not linked to the loan\'s product', async () => {
    const deps = buildDeps();
    const loan = buildApprovedLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.documentTemplateRepository.findByCode.mockResolvedValue(conditionalTemplate);
    deps.loanProductRepository.findVersionById.mockResolvedValue({ loanProductId: 'product-1' });
    deps.documentTemplateRepository.findConditionalForLoanProduct.mockResolvedValue([]); // not linked
    const useCase = new GenerateLoanDocumentUseCase(deps);

    await expect(useCase.execute(loan.id, 'MANULIFE', 'user-1')).rejects.toThrow(DocumentTemplateNotApplicableError);
    expect(deps.documentFiller.fill).not.toHaveBeenCalled();
  });

  it('generates, converts, stores, and records a required document for an approved loan', async () => {
    const deps = buildDeps();
    const loan = buildApprovedLoan();
    deps.loanAccountRepository.findById.mockResolvedValue(loan);
    deps.documentTemplateRepository.findByCode.mockResolvedValue(requiredTemplate);
    const useCase = new GenerateLoanDocumentUseCase(deps);

    const result = await useCase.execute(loan.id, 'DISCLOSURE_STATEMENT', 'user-1');

    expect(deps.mergeDataResolver.resolve).toHaveBeenCalledWith(loan.id);
    expect(deps.documentFiller.fill).toHaveBeenCalledWith('DISCLOSURE_STATEMENT', { BorrowerName: 'Juan Dela Cruz' });
    expect(deps.docxToPdfConverter.convert).toHaveBeenCalledWith(Buffer.from('docx-bytes'));
    expect(deps.fileStorage.save).toHaveBeenCalledWith(expect.stringContaining(`loan-documents/${loan.id}/DISCLOSURE_STATEMENT-`), Buffer.from('pdf-bytes'));
    expect(deps.generatedLoanDocumentRepository.create).toHaveBeenCalledWith(result);
    expect(result.loanAccountId).toBe(loan.id);
    expect(result.documentTemplateId).toBe(requiredTemplate.id);
    expect(result.generatedByUserId).toBe('user-1');
  });
});
