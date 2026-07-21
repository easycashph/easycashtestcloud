import { randomUUID } from 'node:crypto';
import { LoanProductVersion } from './LoanProductVersion';
import { DuplicateVersionNumberError, InvalidVersionActivationError } from './errors/LoanProductDomainErrors';

export interface LoanProductProps {
  id: string;
  code: string;
  name: string;
  description?: string;
  /** BSP Circular 1133 / SEC MC 3 classification — see schema.prisma's own doc comment on this column. */
  isUnsecuredGeneralPurpose: boolean;
  createdAt: Date;
  updatedAt: Date;
  versions: LoanProductVersion[];
}

export interface CreateLoanProductProps {
  code: string;
  name: string;
  description?: string;
}

/**
 * Aggregate root (ADR-042 §4). Owns its `LoanProductVersion[]` as its
 * consistency boundary specifically so LPV-2 ("at most one Active version
 * per product") — a cross-child invariant — can be enforced atomically in
 * exactly one place: `activateVersion()` below. No other code path may
 * flip a version's `isActive` flag.
 */
export class LoanProduct {
  private constructor(private readonly props: LoanProductProps) {}

  static create(input: CreateLoanProductProps): LoanProduct {
    const now = new Date();
    return new LoanProduct({
      id: randomUUID(),
      code: input.code,
      name: input.name,
      description: input.description,
      // Never guessed at creation time — defaults to false ("not yet confirmed unsecured/
      // general-purpose") until a compliance review explicitly confirms it (see schema.prisma).
      isUnsecuredGeneralPurpose: false,
      createdAt: now,
      updatedAt: now,
      versions: [],
    });
  }

  static reconstitute(props: LoanProductProps): LoanProduct {
    return new LoanProduct(props);
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

  get description(): string | undefined {
    return this.props.description;
  }

  get isUnsecuredGeneralPurpose(): boolean {
    return this.props.isUnsecuredGeneralPurpose;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Returns a shallow copy, not the internal array reference — defense in
   * depth alongside H-1's immutability fix on `LoanProductVersion` itself:
   * even a caller that bypasses TypeScript's `readonly` via a cast cannot
   * splice/replace entries in the array this aggregate actually holds.
   */
  get versions(): readonly LoanProductVersion[] {
    return [...this.props.versions];
  }

  getActiveVersion(): LoanProductVersion | undefined {
    return this.props.versions.find((version) => version.isActive);
  }

  /** LPV-2 enforced here in memory (the DB partial unique index is a backstop, not a substitute — see ADR-042 §4). */
  addVersion(version: LoanProductVersion): void {
    if (version.loanProductId !== this.props.id) {
      throw new InvalidVersionActivationError('version does not belong to this loan product.');
    }
    if (this.props.versions.some((existing) => existing.versionNumber === version.versionNumber)) {
      throw new DuplicateVersionNumberError(version.versionNumber);
    }
    this.props.versions.push(version);
    this.props.updatedAt = new Date();
  }

  /**
   * Activates `versionId`, deactivating whichever version is currently
   * active, as one operation — the only sanctioned path to change LPV-2's
   * "which version is Active" state (ADR-042 §4).
   *
   * Audit finding H-1 (Milestone 7.1 remediation): rather than mutating
   * the existing `LoanProductVersion` instances in place (which is what
   * made the previous `_setActive()` method exploitable from outside this
   * class), this REPLACES `this.props.versions` with a new array built
   * from `version.withActive(...)` — an immutable "with" operation that
   * never touches the instance it's called on. This is the only place in
   * the codebase that reassigns `this.props.versions`, which is what
   * actually keeps LPV-2 enforceable in one place now.
   */
  activateVersion(versionId: string): void {
    const target = this.props.versions.find((version) => version.id === versionId);
    if (!target) {
      throw new InvalidVersionActivationError(`version "${versionId}" does not belong to this loan product.`);
    }
    if (target.isActive) {
      return; // Already active — activating it again is a no-op, not an error.
    }

    this.props.versions = this.props.versions.map((version) => {
      if (version.id === versionId) {
        return version.withActive(true);
      }
      if (version.isActive) {
        return version.withActive(false);
      }
      return version;
    });
    this.props.updatedAt = new Date();
  }
}
