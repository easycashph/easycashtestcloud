import { prisma } from '@shared/database/prismaClient';
import type {
  CreatePortalAccountInput,
  IPortalAccountRepository,
  PortalAccountRecord,
  UpdatePortalAccountInput,
} from '../application/ports/IPortalAccountRepository';

function toRecord(row: {
  id: string;
  email: string;
  passwordHash: string;
  contactNumber: string | null;
  status: string;
  emailVerifiedAt: Date | null;
  borrowerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PortalAccountRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    contactNumber: row.contactNumber,
    status: row.status as PortalAccountRecord['status'],
    emailVerifiedAt: row.emailVerifiedAt,
    borrowerId: row.borrowerId,
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

  async update(id: string, patch: UpdatePortalAccountInput): Promise<PortalAccountRecord> {
    const updated = await prisma.portalAccount.update({
      where: { id },
      data: {
        status: patch.status,
        emailVerifiedAt: patch.emailVerifiedAt,
        passwordHash: patch.passwordHash,
        borrowerId: patch.borrowerId,
        email: patch.email?.toLowerCase().trim(),
      },
    });
    return toRecord(updated);
  }
}
