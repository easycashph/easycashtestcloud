/**
 * Password strength policy — Milestone 6 plan §4 / §Assumptions #2.
 *
 * A security-engineering default (minimum length, no forced composition
 * rules — current NIST guidance favors length over forced special-
 * character/uppercase requirements), NOT a lending business rule, so it
 * is not sourced from PROJECT_RULES.md. Flagged for business/security
 * confirmation in the Milestone 6 plan; adjust MIN_LENGTH here if that
 * confirmation changes the requirement.
 */
const MIN_LENGTH = 12;

export type PasswordPolicyViolation = 'TOO_SHORT';

export class PasswordPolicy {
  static validate(password: string): PasswordPolicyViolation[] {
    const violations: PasswordPolicyViolation[] = [];
    if (password.length < MIN_LENGTH) {
      violations.push('TOO_SHORT');
    }
    return violations;
  }

  static isValid(password: string): boolean {
    return PasswordPolicy.validate(password).length === 0;
  }

  static readonly MIN_LENGTH = MIN_LENGTH;
}
