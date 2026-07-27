export type PortalAccountStatus = 'PENDING_VERIFICATION' | 'ACTIVE';

export interface PortalAccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  contactNumber: string | null;
  status: PortalAccountStatus;
  emailVerifiedAt: Date | null;
  borrowerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePortalAccountInput {
  email: string;
  passwordHash: string;
  contactNumber?: string;
}

export interface UpdatePortalAccountInput {
  status?: PortalAccountStatus;
  emailVerifiedAt?: Date;
  passwordHash?: string;
  borrowerId?: string | null;
  email?: string;
}

export interface IPortalAccountRepository {
  create(input: CreatePortalAccountInput): Promise<PortalAccountRecord>;
  findByEmail(email: string): Promise<PortalAccountRecord | null>;
  findById(id: string): Promise<PortalAccountRecord | null>;
  update(id: string, patch: UpdatePortalAccountInput): Promise<PortalAccountRecord>;
}
