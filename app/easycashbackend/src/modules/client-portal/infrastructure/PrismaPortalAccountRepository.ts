import type { Prisma, PortalAccount as PrismaPortalAccountRow } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type {
  CreatePortalAccountInput,
  IPortalAccountRepository,
  PortalAccountRecord,
  UpdatePortalAccountInput,
} from '../application/ports/IPortalAccountRepository';

function toRecord(row: PrismaPortalAccountRow): PortalAccountRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    contactNumber: row.contactNumber,
    status: row.status as PortalAccountRecord['status'],
    emailVerifiedAt: row.emailVerifiedAt,
    borrowerId: row.borrowerId,
    twoFactorEnabled: row.twoFactorEnabled,
    twoFactorChannel: row.twoFactorChannel,
    mustChangePassword: row.mustChangePassword,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    suffix: row.suffix,
    gender: row.gender,
    birthDate: row.birthDate,
    placeOfBirth: row.placeOfBirth,
    nationality: row.nationality,
    civilStatus: row.civilStatus,
    homeOwnership: row.homeOwnership,
    mobilePhone1: row.mobilePhone1,
    mobilePhone2: row.mobilePhone2,
    occupation: row.occupation,
    employer: row.employer,
    monthlyIncome: row.monthlyIncome ? Number(row.monthlyIncome) : null,
    officeAddress: row.officeAddress,
    tinNumber: row.tinNumber,
    sssNumber: row.sssNumber,
    dependants: (row.dependants as PortalAccountRecord['dependants']) ?? null,
    reference1Name: row.reference1Name,
    reference1Mobile: row.reference1Mobile,
    reference2Name: row.reference2Name,
    reference2Mobile: row.reference2Mobile,
    houseUnitNumber: row.houseUnitNumber,
    street: row.street,
    barangay: row.barangay,
    cityMunicipality: row.cityMunicipality,
    province: row.province,
    zipCode: row.zipCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPortalAccountRepository implements IPortalAccountRepository {
  async create(input: CreatePortalAccountInput): Promise<PortalAccountRecord> {
    const created = await prisma.portalAccount.create({
      data: {
        email: input.email.toLowerCase().trim(),
        passwordHash: input.passwordHash,
        contactNumber: input.contactNumber,
        status: input.status,
        borrowerId: input.borrowerId,
        mustChangePassword: input.mustChangePassword,
      },
    });
    return toRecord(created);
  }

  async findByEmail(email: string): Promise<PortalAccountRecord | null> {
    const row = await prisma.portalAccount.findUnique({ where: { email: email.toLowerCase().trim() } });
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<PortalAccountRecord | null> {
    const row = await prisma.portalAccount.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByBorrowerId(borrowerId: string): Promise<PortalAccountRecord | null> {
    const row = await prisma.portalAccount.findUnique({ where: { borrowerId } });
    return row ? toRecord(row) : null;
  }

  async update(id: string, patch: UpdatePortalAccountInput): Promise<PortalAccountRecord> {
    const updated = await prisma.portalAccount.update({
      where: { id },
      data: {
        status: patch.status,
        emailVerifiedAt: patch.emailVerifiedAt,
        passwordHash: patch.passwordHash,
        borrowerId: patch.borrowerId,
        email: patch.email?.toLowerCase().trim(),
        twoFactorEnabled: patch.twoFactorEnabled,
        twoFactorChannel: patch.twoFactorChannel,
        mustChangePassword: patch.mustChangePassword,
        firstName: patch.firstName,
        middleName: patch.middleName,
        lastName: patch.lastName,
        suffix: patch.suffix,
        gender: patch.gender,
        birthDate: patch.birthDate,
        placeOfBirth: patch.placeOfBirth,
        nationality: patch.nationality,
        civilStatus: patch.civilStatus,
        homeOwnership: patch.homeOwnership,
        mobilePhone1: patch.mobilePhone1,
        mobilePhone2: patch.mobilePhone2,
        occupation: patch.occupation,
        employer: patch.employer,
        monthlyIncome: patch.monthlyIncome,
        officeAddress: patch.officeAddress,
        tinNumber: patch.tinNumber,
        sssNumber: patch.sssNumber,
        dependants: (patch.dependants as Prisma.InputJsonValue | undefined) ?? undefined,
        reference1Name: patch.reference1Name,
        reference1Mobile: patch.reference1Mobile,
        reference2Name: patch.reference2Name,
        reference2Mobile: patch.reference2Mobile,
        houseUnitNumber: patch.houseUnitNumber,
        street: patch.street,
        barangay: patch.barangay,
        cityMunicipality: patch.cityMunicipality,
        province: patch.province,
        zipCode: patch.zipCode,
      },
    });
    return toRecord(updated);
  }
}
