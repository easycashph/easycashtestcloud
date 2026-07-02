export interface AddressProps {
  addressType?: string;
  houseUnitNumber?: string;
  street?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  zipCode?: string;
  lengthOfStayMonths?: number;
  ownershipStatus?: string;
}

/**
 * Value object (ADR-042 §8) — deliberately NOT an aggregate or entity. An
 * address has no independent business identity: nothing looks it up by its
 * own id, and it is always replaced as a whole, never edited field-by-field
 * as an independently-tracked record. Owned wholesale by whichever
 * aggregate holds it (`Borrower.addresses` / `CoBorrower.addresses`) —
 * `ownerType`/`ownerId` are a persistence-layer concern for locating the
 * owning aggregate's rows and are intentionally absent from this VO's own
 * shape.
 *
 * No field-level validation is imposed beyond structural typing — none of
 * these fields have a documented format rule in PROJECT_RULES.md, and
 * inventing one would violate CLAUDE.md's "never invent business rules."
 */
export class Address {
  private constructor(private readonly props: Readonly<AddressProps>) {}

  static of(props: AddressProps): Address {
    return new Address({ ...props });
  }

  get addressType(): string | undefined {
    return this.props.addressType;
  }

  get houseUnitNumber(): string | undefined {
    return this.props.houseUnitNumber;
  }

  get street(): string | undefined {
    return this.props.street;
  }

  get barangay(): string | undefined {
    return this.props.barangay;
  }

  get cityMunicipality(): string | undefined {
    return this.props.cityMunicipality;
  }

  get province(): string | undefined {
    return this.props.province;
  }

  get zipCode(): string | undefined {
    return this.props.zipCode;
  }

  get lengthOfStayMonths(): number | undefined {
    return this.props.lengthOfStayMonths;
  }

  get ownershipStatus(): string | undefined {
    return this.props.ownershipStatus;
  }

  equals(other: Address): boolean {
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }

  toProps(): Readonly<AddressProps> {
    return this.props;
  }
}
