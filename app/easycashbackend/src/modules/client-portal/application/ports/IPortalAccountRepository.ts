export type PortalAccountStatus = 'PENDING_VERIFICATION' | 'ACTIVE';

/** Pre-application profile fields (2026-07-30) - see schema.prisma's PortalAccount doc comment.
 * Shared between the record shape and the update-patch shape since every field here is optional
 * and independently settable. */
export interface PortalAccountProfileFields {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  suffix: string | null;
  gender: string | null;
  birthDate: Date | null;
  placeOfBirth: string | null;
  nationality: string | null;
  civilStatus: string | null;
  homeOwnership: string | null;
  mobilePhone1: string | null;
  mobilePhone2: string | null;
  occupation: string | null;
  employer: string | null;
  monthlyIncome: number | null;
  houseUnitNumber: string | null;
  street: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  zipCode: string | null;
}

export interface PortalAccountRecord extends PortalAccountProfileFields {
  id: string;
  email: string;
  passwordHash: string;
  contactNumber: string | null;
  status: PortalAccountStatus;
  emailVerifiedAt: Date | null;
  borrowerId: string | null;
  twoFactorEnabled: boolean;
  twoFactorChannel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePortalAccountInput {
  email: string;
  passwordHash: string;
  contactNumber?: string;
}

export interface UpdatePortalAccountInput extends Partial<PortalAccountProfileFields> {
  status?: PortalAccountStatus;
  emailVerifiedAt?: Date;
  passwordHash?: string;
  borrowerId?: string | null;
  email?: string;
  twoFactorEnabled?: boolean;
  twoFactorChannel?: string | null;
}

export interface IPortalAccountRepository {
  create(input: CreatePortalAccountInput): Promise<PortalAccountRecord>;
  findByEmail(email: string): Promise<PortalAccountRecord | null>;
  findById(id: string): Promise<PortalAccountRecord | null>;
  update(id: string, patch: UpdatePortalAccountInput): Promise<PortalAccountRecord>;
}
