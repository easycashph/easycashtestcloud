import type { Prisma } from '@prisma/client';
import { resolveClient, withTransaction } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { Borrower, type BorrowerDependant, type BorrowerProps } from '../domain/Borrower';
import { PersonName } from '../domain/valueObjects/PersonName';
import { Address } from '../domain/valueObjects/Address';
import type { FindManyBorrowersOptions, IBorrowerRepository } from '../application/ports/IBorrowerRepository';

const BORROWER_INCLUDE = {
  incomeDetail: true,
  governmentId: true,
  identificationDocs: true,
  characterReferences: true,
} satisfies Prisma.BorrowerInclude;

type BorrowerRow = Prisma.BorrowerGetPayload<{ include: typeof BORROWER_INCLUDE }>;
type AddressRow = { addressType: string | null; houseUnitNumber: string | null; street: string | null; barangay: string | null; cityMunicipality: string | null; province: string | null; zipCode: string | null; lengthOfStayMonths: number | null; ownershipStatus: string | null };

function toAddress(row: AddressRow): Address {
  return Address.of({
    addressType: row.addressType ?? undefined,
    houseUnitNumber: row.houseUnitNumber ?? undefined,
    street: row.street ?? undefined,
    barangay: row.barangay ?? undefined,
    cityMunicipality: row.cityMunicipality ?? undefined,
    province: row.province ?? undefined,
    zipCode: row.zipCode ?? undefined,
    lengthOfStayMonths: row.lengthOfStayMonths ?? undefined,
    ownershipStatus: row.ownershipStatus ?? undefined,
  });
}

function toBorrower(row: BorrowerRow, addresses: Address[]): Borrower {
  const props: BorrowerProps = {
    id: row.id,
    branchId: row.branchId,
    assignedLoanOfficerId: row.assignedLoanOfficerId ?? undefined,
    name: PersonName.of(row.firstName, row.lastName, row.middleName ?? undefined),
    gender: row.gender ?? undefined,
    birthDate: row.birthDate ?? undefined,
    placeOfBirth: row.placeOfBirth ?? undefined,
    nationality: row.nationality ?? undefined,
    civilStatus: row.civilStatus ?? undefined,
    homeOwnership: row.homeOwnership ?? undefined,
    mobilePhone1: row.mobilePhone1 ?? undefined,
    mobilePhone2: row.mobilePhone2 ?? undefined,
    email: row.email ?? undefined,
    dependants: (row.dependants as BorrowerDependant[] | null) ?? undefined,
    note: row.note ?? undefined,
    status: row.status,
    loanCycle: row.loanCycle,
    legacyId: row.legacyId ?? undefined,
    sourceApplicationId: row.sourceApplicationId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    incomeDetail: row.incomeDetail
      ? {
          employmentType: row.incomeDetail.employmentType ?? undefined,
          employerName: row.incomeDetail.employerName ?? undefined,
          employerAddress: row.incomeDetail.employerAddress ?? undefined,
          natureOfBusiness: row.incomeDetail.natureOfBusiness ?? undefined,
          position: row.incomeDetail.position ?? undefined,
          yearsEmployed: row.incomeDetail.yearsEmployed ?? undefined,
          monthlyIncome: row.incomeDetail.monthlyIncome ? Number(row.incomeDetail.monthlyIncome) : undefined,
        }
      : undefined,
    governmentId: row.governmentId
      ? { sssNumber: row.governmentId.sssNumber ?? undefined, tinNumber: row.governmentId.tinNumber ?? undefined }
      : undefined,
    identificationDocuments: row.identificationDocs.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      issuingAuthority: doc.issuingAuthority ?? undefined,
      validUntil: doc.validUntil ?? undefined,
    })),
    characterReferences: row.characterReferences.map((ref) => ({
      id: ref.id,
      firstName: ref.firstName,
      lastName: ref.lastName,
      relationship: ref.relationship ?? undefined,
      phoneNumber: ref.phoneNumber ?? undefined,
      emailAddress: ref.emailAddress ?? undefined,
    })),
    addresses,
  };
  return Borrower.reconstitute(props);
}

/**
 * `Address` has no FK relation to `Borrower` in the schema (ADR-014
 * polymorphic ownerType/ownerId, ADR-042 §8) — it is queried and written as
 * its own table, filtered by `ownerType: 'BORROWER'`, rather than via a
 * Prisma relation include. This repository is the only place that
 * "ownerType: 'BORROWER'" filtering knowledge lives — the domain layer
 * never sees ownerType/ownerId at all.
 */
export class PrismaBorrowerRepository implements IBorrowerRepository {
  async findById(id: string, ctx?: TransactionContext): Promise<Borrower | null> {
    const client = resolveClient(ctx);
    const row = await client.borrower.findUnique({ where: { id }, include: BORROWER_INCLUDE });
    if (!row) {
      return null;
    }

    const addressRows = await client.address.findMany({ where: { ownerType: 'BORROWER', ownerId: id } });
    return toBorrower(row, addressRows.map(toAddress));
  }

  async findBySourceApplicationId(applicationId: string, ctx?: TransactionContext): Promise<Borrower | null> {
    const client = resolveClient(ctx);
    const row = await client.borrower.findUnique({ where: { sourceApplicationId: applicationId }, include: BORROWER_INCLUDE });
    if (!row) {
      return null;
    }
    const addressRows = await client.address.findMany({ where: { ownerType: 'BORROWER', ownerId: row.id } });
    return toBorrower(row, addressRows.map(toAddress));
  }

  async findManyBySourceApplicationIds(applicationIds: string[], ctx?: TransactionContext): Promise<Borrower[]> {
    if (applicationIds.length === 0) {
      return [];
    }
    const client = resolveClient(ctx);
    const rows = await client.borrower.findMany({
      where: { sourceApplicationId: { in: applicationIds } },
      include: BORROWER_INCLUDE,
    });
    if (rows.length === 0) {
      return [];
    }
    const addressRows = await client.address.findMany({
      where: { ownerType: 'BORROWER', ownerId: { in: rows.map((row) => row.id) } },
    });
    const addressesByOwnerId = new Map<string, Address[]>();
    for (const addressRow of addressRows) {
      const list = addressesByOwnerId.get(addressRow.ownerId) ?? [];
      list.push(toAddress(addressRow));
      addressesByOwnerId.set(addressRow.ownerId, list);
    }
    return rows.map((row) => toBorrower(row, addressesByOwnerId.get(row.id) ?? []));
  }

  /**
   * Milestone 8 / D-4: cursor pagination only, no search/filter/sort.
   * Batches the address lookup for the whole page in one query (`ownerId
   * IN (...)`) rather than one query per borrower, since this method — new
   * in Milestone 8 — can return up to `limit` (max 200) rows at once.
   */
  async findMany(options: FindManyBorrowersOptions, ctx?: TransactionContext): Promise<Borrower[]> {
    const client = resolveClient(ctx);
    const where: Prisma.BorrowerWhereInput = {
      ...(options.branchId ? { branchId: options.branchId } : {}),
      ...(options.search
        ? {
            OR: [
              { firstName: { contains: options.search, mode: 'insensitive' } },
              { middleName: { contains: options.search, mode: 'insensitive' } },
              { lastName: { contains: options.search, mode: 'insensitive' } },
              { email: { contains: options.search, mode: 'insensitive' } },
              { mobilePhone1: { contains: options.search, mode: 'insensitive' } },
              { mobilePhone2: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await client.borrower.findMany({
      where,
      include: BORROWER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });

    if (rows.length === 0) {
      return [];
    }

    const addressRows = await client.address.findMany({
      where: { ownerType: 'BORROWER', ownerId: { in: rows.map((row) => row.id) } },
    });
    const addressesByOwnerId = new Map<string, Address[]>();
    for (const addressRow of addressRows) {
      const list = addressesByOwnerId.get(addressRow.ownerId) ?? [];
      list.push(toAddress(addressRow));
      addressesByOwnerId.set(addressRow.ownerId, list);
    }

    return rows.map((row) => toBorrower(row, addressesByOwnerId.get(row.id) ?? []));
  }

  /**
   * Audit finding H-2 (Milestone 7.1 remediation): this method issues
   * multiple statements (the borrower upsert, then a conditional
   * address-collection replace) that must commit or roll back together.
   * `withTransaction` self-wraps in `prisma.$transaction` when no outer
   * `ctx` is supplied, and joins the caller's transaction (rather than
   * nesting one) when one is — mirroring the pattern already used by
   * `PrismaLoanProductRepository`/`PrismaLoanAccountRepository`.
   */
  async save(borrower: Borrower, ctx?: TransactionContext): Promise<void> {
    await withTransaction(ctx, async (client) => {
      await client.borrower.upsert({
        where: { id: borrower.id },
        create: {
          id: borrower.id,
          branchId: borrower.branchId,
          assignedLoanOfficerId: borrower.assignedLoanOfficerId,
          firstName: borrower.name.firstName,
          lastName: borrower.name.lastName,
          middleName: borrower.name.middleName,
          gender: borrower.gender,
          birthDate: borrower.birthDate,
          placeOfBirth: borrower.placeOfBirth,
          nationality: borrower.nationality,
          civilStatus: borrower.civilStatus,
          homeOwnership: borrower.homeOwnership,
          mobilePhone1: borrower.mobilePhone1,
          mobilePhone2: borrower.mobilePhone2,
          email: borrower.email,
          dependants: (borrower.dependants as Prisma.InputJsonValue | undefined) ?? undefined,
          note: borrower.note,
          status: borrower.status,
          loanCycle: borrower.loanCycle,
          legacyId: borrower.legacyId,
          sourceApplicationId: borrower.sourceApplicationId,
          createdAt: borrower.createdAt,
          updatedAt: borrower.updatedAt,
          incomeDetail: borrower.incomeDetail ? { create: borrower.incomeDetail } : undefined,
          governmentId: borrower.governmentId ? { create: borrower.governmentId } : undefined,
          characterReferences:
            borrower.characterReferences.length > 0
              ? { create: borrower.characterReferences.map(({ id: _id, ...rest }) => rest) }
              : undefined,
        },
        update: {
          assignedLoanOfficerId: borrower.assignedLoanOfficerId,
          firstName: borrower.name.firstName,
          lastName: borrower.name.lastName,
          middleName: borrower.name.middleName,
          gender: borrower.gender,
          birthDate: borrower.birthDate,
          placeOfBirth: borrower.placeOfBirth,
          nationality: borrower.nationality,
          civilStatus: borrower.civilStatus,
          homeOwnership: borrower.homeOwnership,
          mobilePhone1: borrower.mobilePhone1,
          mobilePhone2: borrower.mobilePhone2,
          email: borrower.email,
          dependants: (borrower.dependants as Prisma.InputJsonValue | undefined) ?? undefined,
          note: borrower.note,
          status: borrower.status,
          loanCycle: borrower.loanCycle,
          updatedAt: borrower.updatedAt,
          incomeDetail: borrower.incomeDetail
            ? { upsert: { create: borrower.incomeDetail, update: borrower.incomeDetail } }
            : undefined,
          governmentId: borrower.governmentId
            ? { upsert: { create: borrower.governmentId, update: borrower.governmentId } }
            : undefined,
        },
      });

      // Small, bounded collections (ADR-042 §5) — replaced wholesale on
      // every save rather than diffed, which is correct (and simple) at
      // the scale these collections actually reach per borrower. Revisit
      // only if a future use case needs partial/incremental updates to
      // one document among many without resending the full set.
      const existingCount = await client.address.count({ where: { ownerType: 'BORROWER', ownerId: borrower.id } });
      if (borrower.addresses.length > 0 || existingCount > 0) {
        await client.address.deleteMany({ where: { ownerType: 'BORROWER', ownerId: borrower.id } });
        if (borrower.addresses.length > 0) {
          await client.address.createMany({
            data: borrower.addresses.map((address) => ({ ownerType: 'BORROWER' as const, ownerId: borrower.id, ...address.toProps() })),
          });
        }
      }
    });
  }
}
