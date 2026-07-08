import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

async function main() {
  const counts = {
    loanProducts: await prisma.loanProduct.count(),
    loanProductVersions: await prisma.loanProductVersion.count(),
    penaltyRules: await prisma.penaltyRule.count(),
    borrowers: await prisma.borrower.count(),
    borrowerIncomeDetails: await prisma.borrowerIncomeDetail.count(),
    borrowerGovernmentIds: await prisma.borrowerGovernmentId.count(),
    addresses: await prisma.address.count(),
    identificationDocuments: await prisma.identificationDocument.count(),
    characterReferences: await prisma.characterReference.count(),
    loanAccounts: await prisma.loanAccount.count(),
    coBorrowers: await prisma.coBorrower.count(),
    loanAccountCoBorrowers: await prisma.loanAccountCoBorrower.count(),
    loanTransactions: await prisma.loanTransaction.count(),
    attachments: await prisma.attachment.count(),
  };
  console.log(JSON.stringify(counts, null, 2));

  const loanStatusBreakdown = await prisma.loanAccount.groupBy({ by: ['status'], _count: true });
  console.log('LoanAccount status breakdown:', JSON.stringify(loanStatusBreakdown, null, 2));

  const txnTypeBreakdown = await prisma.loanTransaction.groupBy({ by: ['type'], _count: true });
  console.log('LoanTransaction type breakdown:', JSON.stringify(txnTypeBreakdown, null, 2));

  await prisma.$disconnect();
}

main();
