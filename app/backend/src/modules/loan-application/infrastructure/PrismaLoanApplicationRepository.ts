import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { LoanApplication, type LoanApplicationProps } from '../domain/LoanApplication';
import type { FindManyLoanApplicationsOptions, ILoanApplicationRepository } from '../application/ports/ILoanApplicationRepository';

type LoanApplicationRow = Prisma.LoanApplicationGetPayload<Record<string, never>>;
type PrismaWriteClient = PrismaClient | Prisma.TransactionClient;

function toDomain(row: LoanApplicationRow): LoanApplication {
  const props: LoanApplicationProps = {
    id: row.id,
    branchId: row.branchId,
    applicantName: row.applicantName,
    age: row.age ?? undefined,
    address: row.address ?? undefined,
    monthlyIncome: row.monthlyIncome ? Number(row.monthlyIncome) : undefined,
    employer: row.employer ?? undefined,
    propertiesOwned: row.propertiesOwned,
    creditScore: row.creditScore ?? undefined,
    coBorrowerName: row.coBorrowerName ?? undefined,
    mobilePhone: row.mobilePhone ?? undefined,
    email: row.email ?? undefined,
    referralSource: row.referralSource ?? undefined,
    accountType: row.accountType ?? undefined,
    loanPurpose: row.loanPurpose ?? undefined,
    requestedCategory: row.requestedCategory,
    requestedAmount: Number(row.requestedAmount),
    requestedTermMonths: row.requestedTermMonths,
    submittedDocuments: row.submittedDocuments,
    encodedByUserId: row.encodedByUserId ?? undefined,
    status: row.status,
    distanceFromBranchKm: row.distanceFromBranchKm ? Number(row.distanceFromBranchKm) : undefined,
    assignedLoanProductVersionId: row.assignedLoanProductVersionId ?? undefined,
    reviewedByUserId: row.reviewedByUserId ?? undefined,
    reviewedAt: row.reviewedAt ?? undefined,
    decisionNote: row.decisionNote ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return LoanApplication.reconstitute(props);
}

async function write(client: PrismaWriteClient, application: LoanApplication): Promise<void> {
  const p = application.toProps();
  await client.loanApplication.upsert({
    where: { id: p.id },
    create: {
      id: p.id,
      branchId: p.branchId,
      applicantName: p.applicantName,
      age: p.age,
      address: p.address,
      monthlyIncome: p.monthlyIncome,
      employer: p.employer,
      propertiesOwned: p.propertiesOwned,
      creditScore: p.creditScore,
      coBorrowerName: p.coBorrowerName,
      mobilePhone: p.mobilePhone,
      email: p.email,
      referralSource: p.referralSource,
      accountType: p.accountType,
      loanPurpose: p.loanPurpose,
      requestedCategory: p.requestedCategory,
      requestedAmount: p.requestedAmount,
      requestedTermMonths: p.requestedTermMonths,
      submittedDocuments: p.submittedDocuments,
      encodedByUserId: p.encodedByUserId,
      status: p.status,
      distanceFromBranchKm: p.distanceFromBranchKm,
      assignedLoanProductVersionId: p.assignedLoanProductVersionId,
      reviewedByUserId: p.reviewedByUserId,
      reviewedAt: p.reviewedAt,
      decisionNote: p.decisionNote,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    },
    update: {
      status: p.status,
      distanceFromBranchKm: p.distanceFromBranchKm,
      assignedLoanProductVersionId: p.assignedLoanProductVersionId,
      reviewedByUserId: p.reviewedByUserId,
      reviewedAt: p.reviewedAt,
      decisionNote: p.decisionNote,
      // Previously missing here — a latent gap where nothing could ever persist a change to these
      // three fields on an existing row (only present in `create` above), found while adding
      // `updateApplicantFinancials()` (the Detail page's AI Risk Management Summary).
      monthlyIncome: p.monthlyIncome,
      creditScore: p.creditScore,
      propertiesOwned: p.propertiesOwned,
      updatedAt: p.updatedAt,
    },
  });
}

export class PrismaLoanApplicationRepository implements ILoanApplicationRepository {
  async findById(id: string, ctx?: TransactionContext): Promise<LoanApplication | null> {
    const client = resolveClient(ctx);
    const row = await client.loanApplication.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  /** Milestone 9.2 / mirrors PrismaBorrowerRepository.findMany: cursor pagination only, no search/filter beyond branch. */
  async findMany(options: FindManyLoanApplicationsOptions, ctx?: TransactionContext): Promise<LoanApplication[]> {
    const client = resolveClient(ctx);
    const rows = await client.loanApplication.findMany({
      where: {
        ...(options.branchId ? { branchId: options.branchId } : {}),
        ...(options.search ? { applicantName: { contains: options.search, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomain);
  }

  async save(application: LoanApplication, ctx?: TransactionContext): Promise<void> {
    const client = ctx ? resolveClient(ctx) : prisma;
    await write(client, application);
  }
}
