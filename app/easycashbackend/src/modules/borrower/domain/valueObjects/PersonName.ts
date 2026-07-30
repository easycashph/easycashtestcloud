import { InvalidPersonNameError } from '../errors/BorrowerDomainErrors';

/**
 * Value object shared by `Borrower` and `CoBorrower` — both are person
 * records with the same name shape (BOR-1). Kept as one VO rather than
 * duplicated fields on each entity (DRY).
 */
export class PersonName {
  private constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly middleName?: string,
  ) {}

  static of(firstName: string, lastName: string, middleName?: string): PersonName {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (trimmedFirst.length === 0) {
      throw new InvalidPersonNameError('firstName must not be empty.');
    }
    if (trimmedLast.length === 0) {
      throw new InvalidPersonNameError('lastName must not be empty.');
    }

    const trimmedMiddle = middleName?.trim();
    return new PersonName(trimmedFirst, trimmedLast, trimmedMiddle ? trimmedMiddle : undefined);
  }

  fullName(): string {
    return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
  }

  equals(other: PersonName): boolean {
    return this.firstName === other.firstName && this.lastName === other.lastName && this.middleName === other.middleName;
  }
}
