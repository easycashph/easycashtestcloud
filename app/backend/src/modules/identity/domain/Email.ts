const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Value object for a validated, normalized email address. Framework-free —
 * no Prisma or Express imports (Clean Architecture: domain layer has no
 * outward dependencies).
 */
export class Email {
  private constructor(public readonly value: string) {}

  static create(raw: string): Email | null {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      return null;
    }
    return new Email(normalized);
  }

  toString(): string {
    return this.value;
  }
}
