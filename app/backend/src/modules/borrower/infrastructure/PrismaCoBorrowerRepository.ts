import { resolveClient, withTransaction } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { CoBorrower, type CoBorrowerProps } from '../domain/CoBorrower';
import { PersonName } from '../domain/valueObjects/PersonName';
import { Address } from '../domain/valueObjects/Address';
import type { ICoBorrowerRepository } from '../application/ports/ICoBorrowerRepository';

export class PrismaCoBorrowerRepository implements ICoBorrowerRepository {
  async findById(id: string, ctx?: TransactionContext): Promise<CoBorrower | null> {
    const client = resolveClient(ctx);
    const row = await client.coBorrower.findUnique({ where: { id } });
    if (!row) {
      return null;
    }

    const addressRows = await client.address.findMany({ where: { ownerType: 'CO_BORROWER', ownerId: id } });

    const props: CoBorrowerProps = {
      id: row.id,
      name: PersonName.of(row.firstName, row.lastName),
      gender: row.gender ?? undefined,
      civilStatus: row.civilStatus ?? undefined,
      birthDate: row.birthDate ?? undefined,
      phoneNumber: row.phoneNumber ?? undefined,
      emailAddress: row.emailAddress ?? undefined,
      relationship: row.relationship ?? undefined,
      legacyId: row.legacyId ?? undefined,
      addresses: addressRows.map((addressRow) =>
        Address.of({
          addressType: addressRow.addressType ?? undefined,
          houseUnitNumber: addressRow.houseUnitNumber ?? undefined,
          street: addressRow.street ?? undefined,
          barangay: addressRow.barangay ?? undefined,
          cityMunicipality: addressRow.cityMunicipality ?? undefined,
          province: addressRow.province ?? undefined,
          zipCode: addressRow.zipCode ?? undefined,
          lengthOfStayMonths: addressRow.lengthOfStayMonths ?? undefined,
          ownershipStatus: addressRow.ownershipStatus ?? undefined,
        }),
      ),
    };
    return CoBorrower.reconstitute(props);
  }

  /** Audit finding H-2 (Milestone 7.1 remediation) — see PrismaBorrowerRepository.save() for the full rationale; same self-wrapping pattern. */
  async save(coBorrower: CoBorrower, ctx?: TransactionContext): Promise<void> {
    await withTransaction(ctx, async (client) => {
      await client.coBorrower.upsert({
        where: { id: coBorrower.id },
        create: {
          id: coBorrower.id,
          firstName: coBorrower.name.firstName,
          lastName: coBorrower.name.lastName,
          gender: coBorrower.gender,
          civilStatus: coBorrower.civilStatus,
          birthDate: coBorrower.birthDate,
          phoneNumber: coBorrower.phoneNumber,
          emailAddress: coBorrower.emailAddress,
          relationship: coBorrower.relationship,
          legacyId: coBorrower.legacyId,
        },
        update: {
          firstName: coBorrower.name.firstName,
          lastName: coBorrower.name.lastName,
          gender: coBorrower.gender,
          civilStatus: coBorrower.civilStatus,
          birthDate: coBorrower.birthDate,
          phoneNumber: coBorrower.phoneNumber,
          emailAddress: coBorrower.emailAddress,
          relationship: coBorrower.relationship,
        },
      });

      const existingCount = await client.address.count({ where: { ownerType: 'CO_BORROWER', ownerId: coBorrower.id } });
      if (coBorrower.addresses.length > 0 || existingCount > 0) {
        await client.address.deleteMany({ where: { ownerType: 'CO_BORROWER', ownerId: coBorrower.id } });
        if (coBorrower.addresses.length > 0) {
          await client.address.createMany({
            data: coBorrower.addresses.map((address) => ({
              ownerType: 'CO_BORROWER' as const,
              ownerId: coBorrower.id,
              ...address.toProps(),
            })),
          });
        }
      }
    });
  }
}
