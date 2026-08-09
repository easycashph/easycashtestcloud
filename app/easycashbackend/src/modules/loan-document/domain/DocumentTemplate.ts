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
 * ADR-051 §1/§3: one of the loan document types in scope. Reference data — rows are seeded
 * (`prisma/seed.ts`), never created through a use case (still no `create()`; a genuinely new
 * template needs a new `.docx` file on disk, a developer-only step). 2026-08-09 (Document
 * Templates admin config, user request): `setRequired()` added so MIS can toggle an existing
 * template between Required/Conditional without a code change.
 */
export class DocumentTemplate {
  private constructor(private readonly props: DocumentTemplateProps) {}

  static reconstitute(props: DocumentTemplateProps): DocumentTemplate {
    return new DocumentTemplate(props);
  }

  /** 2026-08-09 (Document Templates admin config): Required applies to every loan and never has a `DocumentTemplateMapping` row - callers must clear this template's mappings in the same transaction when flipping to `true` (see `UpdateDocumentTemplateRequiredUseCase`). */
  setRequired(isRequired: boolean): void {
    this.props.isRequired = isRequired;
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
