/**
 * Renamable display label for a Loan Products catalog "Product Type" grouping (e.g. "Business
 * Loan"). `canonicalKey` is the stable identifier the classification/grouping logic
 * (`productTypeClassification.ts`) keys off of and never changes; `label` is the only field an
 * MIS account can rename from Administration > System > Product Types.
 */
export interface ProductTypeLabelProps {
  id: string;
  canonicalKey: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductTypeLabel {
  private constructor(private readonly props: ProductTypeLabelProps) {}

  static fromRecord(props: ProductTypeLabelProps): ProductTypeLabel {
    return new ProductTypeLabel(props);
  }

  get id(): string {
    return this.props.id;
  }

  get canonicalKey(): string {
    return this.props.canonicalKey;
  }

  get label(): string {
    return this.props.label;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toProps(): ProductTypeLabelProps {
    return { ...this.props };
  }
}
