export interface DocumentTemplateProps {
  id: string;
  code: string;
  name: string;
  isRequired: boolean;
  sortIndex: number;
  requiresBorrowerSignature: boolean;
  requiresCoBorrowerSignature: boolean;
}

/**
 * ADR-051 §1/§3: one of the 11 loan document types in scope. Reference data only — rows are
 * seeded (`prisma/seed.ts`), never created through a use case, so this class has no `create()`,
 * only `reconstitute()`.
 */
export class DocumentTemplate {
  private constructor(private readonly props: DocumentTemplateProps) {}

  static reconstitute(props: DocumentTemplateProps): DocumentTemplate {
    return new DocumentTemplate(props);
  }

  get id(): string {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get name(): string {
    return this.props.name;
  }

  get isRequired(): boolean {
    return this.props.isRequired;
  }

  get sortIndex(): number {
    return this.props.sortIndex;
  }

  get requiresBorrowerSignature(): boolean {
    return this.props.requiresBorrowerSignature;
  }

  get requiresCoBorrowerSignature(): boolean {
    return this.props.requiresCoBorrowerSignature;
  }
}
