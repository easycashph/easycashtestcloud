const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Value object for a validated, normalized email address. Framework-free —
 * no Prisma or Express imports (Clean Architecture: domain layer has no
 * outward dependencies).
 */
export class Email {
  private constructor(public readonly value: string) {}

  /**
   * Audit finding H-02: casing normalization with NO format validation —
   * for callers that just need consistent casing (e.g. a repository
   * defensively normalizing before a lookup/write) without re-validating
   * a value that was already validated at an input boundary. `create()`
   * below is the one place that also validates; every other normalization
   * point in the codebase should call this, not re-implement
   * `trim().toLowerCase()` locally.
   */
  static normalize(raw: string): string {
    return raw.trim().toLowerCase();
  }

  static create(raw: string): Email | null {
    const normalized = Email.normalize(raw);
    if (!EMAIL_PATTERN.test(normalized)) {
      return null;
    }
    return new Email(normalized);
  }

  toString(): string {
    return this.value;
  }
}
