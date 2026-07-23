import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { LoanApplication, type DependantEntry, type LoanApplicationProps, type ReviewReport } from '../domain/LoanApplication';
import type { FindManyLoanApplicationsOptions, ILoanApplicationRepository } from '../application/ports/ILoanApplicationRepository';

type LoanApplicationRow = Prisma.LoanApplicationGetPayload<Record<string, never>>;
type PrismaWriteClient = PrismaClient | Prisma.TransactionClient;

function toDomain(row: LoanApplicationRow): LoanApplication {
  const props: LoanApplicationProps = {
    id: row.id,
    branchId: row.branchId,
    borrowerId: row.borrowerId ?? undefined,
    portalAccountId: row.portalAccountId ?? undefined,
    applicantName: row.applicantName,
    age: row.age ?? undefined,
    gender: row.gender ?? undefined,
    civilStatus: row.civilStatus ?? undefined,
    birthDate: row.birthDate ?? undefined,
    placeOfBirth: row.placeOfBirth ?? undefined,
    nationality: row.nationality ?? undefined,
    homeOwnership: row.homeOwnership ?? undefined,
    address: row.address ?? undefined,
    houseUnitNumber: row.houseUnitNumber ?? undefined,
    street: row.street ?? undefined,
    barangay: row.barangay ?? undefined,
    cityMunicipality: row.cityMunicipality ?? undefined,
    province: row.province ?? undefined,
    zipCode: row.zipCode ?? undefined,
    previousAddressSameAsPresent: row.previousAddressSameAsPresent,
    previousAddress: row.previousAddress ?? undefined,
    previousHouseUnitNumber: row.previousHouseUnitNumber ?? undefined,
    previousStreet: row.previousStreet ?? undefined,
    previousBarangay: row.previousBarangay ?? undefined,
    previousCityMunicipality: row.previousCityMunicipality ?? undefined,
    previousProvince: row.previousProvince ?? undefined,
    previousZipCode: row.previousZipCode ?? undefined,
    monthlyIncome: row.monthlyIncome ? Number(row.monthlyIncome) : undefined,
    employer: row.employer ?? undefined,
    occupation: row.occupation ?? undefined,
    officeAddress: row.officeAddress ?? undefined,
    tinNumber: row.tinNumber ?? undefined,
    sssNumber: row.sssNumber ?? undefined,
    propertiesOwned: row.propertiesOwned,
    creditScore: row.creditScore ?? undefined,
    coBorrowerName: row.coBorrowerName ?? undefined,
    coBorrowerEmployer: row.coBorrowerEmployer ?? undefined,
    coBorrowerContactNumber: row.coBorrowerContactNumber ?? undefined,
    coBorrowerEmail: row.coBorrowerEmail ?? undefined,
    coBorrowerAddress: row.coBorrowerAddress ?? undefined,
    mobilePhone: row.mobilePhone ?? undefined,
    email: row.email ?? undefined,
    dependants: (row.dependants as DependantEntry[] | null) ?? undefined,
    reference1Name: row.reference1Name ?? undefined,
    reference1Mobile: row.reference1Mobile ?? undefined,
    reference2Name: row.reference2Name ?? undefined,
    reference2Mobile: row.reference2Mobile ?? undefined,
    note: row.note ?? undefined,
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
    reviewStartedByUserId: row.reviewStartedByUserId ?? undefined,
    reviewStartedAt: row.reviewStartedAt ?? undefined,
    reviewReport: (row.reviewReport as ReviewReport | null) ?? undefined,
    preApprovedByUserId: row.preApprovedByUserId ?? undefined,
    preApprovedAt: row.preApprovedAt ?? undefined,
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
      borrowerId: p.borrowerId,
      portalAccountId: p.portalAccountId,
      applicantName: p.applicantName,
      age: p.age,
      gender: p.gender,
      civilStatus: p.civilStatus,
      birthDate: p.birthDate,
      placeOfBirth: p.placeOfBirth,
      nationality: p.nationality,
      homeOwnership: p.homeOwnership,
      address: p.address,
      houseUnitNumber: p.houseUnitNumber,
      street: p.street,
      barangay: p.barangay,
      cityMunicipality: p.cityMunicipality,
      province: p.province,
      zipCode: p.zipCode,
      previousAddressSameAsPresent: p.previousAddressSameAsPresent,
      previousAddress: p.previousAddress,
      previousHouseUnitNumber: p.previousHouseUnitNumber,
      previousStreet: p.previousStreet,
      previousBarangay: p.previousBarangay,
      previousCityMunicipality: p.previousCityMunicipality,
      previousProvince: p.previousProvince,
      previousZipCode: p.previousZipCode,
      monthlyIncome: p.monthlyIncome,
      employer: p.employer,
      occupation: p.occupation,
      officeAddress: p.officeAddress,
      tinNumber: p.tinNumber,
      sssNumber: p.sssNumber,
      propertiesOwned: p.propertiesOwned,
      creditScore: p.creditScore,
      coBorrowerName: p.coBorrowerName,
      coBorrowerEmployer: p.coBorrowerEmployer,
      coBorrowerContactNumber: p.coBorrowerContactNumber,
      coBorrowerEmail: p.coBorrowerEmail,
      coBorrowerAddress: p.coBorrowerAddress,
      mobilePhone: p.mobilePhone,
      email: p.email,
      dependants: p.dependants as Prisma.InputJsonValue | undefined,
      reference1Name: p.reference1Name,
      reference1Mobile: p.reference1Mobile,
      reference2Name: p.reference2Name,
      reference2Mobile: p.reference2Mobile,
      note: p.note,
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
      reviewStartedByUserId: p.reviewStartedByUserId,
      reviewStartedAt: p.reviewStartedAt,
      reviewReport: p.reviewReport as Prisma.InputJsonValue | undefined,
      preApprovedByUserId: p.preApprovedByUserId,
      preApprovedAt: p.preApprovedAt,
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
      reviewStartedByUserId: p.reviewStartedByUserId,
      reviewStartedAt: p.reviewStartedAt,
      reviewReport: p.reviewReport as Prisma.InputJsonValue | undefined,
      preApprovedByUserId: p.preApprovedByUserId,
      preApprovedAt: p.preApprovedAt,
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
        ...(options.status ? { status: options.status } : {}),
        ...(options.requestedCategory ? { requestedCategory: options.requestedCategory } : {}),
        ...(options.search ? { applicantName: { contains: options.search, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    return rows.map(toDomain);
  }

  /** Used by CreateLoanApplicationUseCase's duplicate-in-flight-application check (a client
   * cannot have two loan applications going at once) - see that use case's own doc comment. */
  async findByBorrowerId(borrowerId: string, ctx?: TransactionContext): Promise<LoanApplication[]> {
    const client = resolveClient(ctx);
    const rows = await client.loanApplication.findMany({ where: { borrowerId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toDomain);
  }

  /** Used by the Easycash Portal's "My Applications" list (ListPortalLoanApplicationsUseCase). */
  async findByPortalAccountId(portalAccountId: string, ctx?: TransactionContext): Promise<LoanApplication[]> {
    const client = resolveClient(ctx);
    const rows = await client.loanApplication.findMany({ where: { portalAccountId }, orderBy: { createdAt: 'desc' } });
    return rows.map(toDomain);
  }

  async save(application: LoanApplication, ctx?: TransactionContext): Promise<void> {
    const client = ctx ? resolveClient(ctx) : prisma;
    await write(client, application);
  }
}
