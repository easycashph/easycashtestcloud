import { describe, expect, it } from 'vitest';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';
import { InvalidPersonNameError } from '@modules/borrower/domain/errors/BorrowerDomainErrors';

describe('PersonName', () => {
  it('trims names and composes a full name', () => {
    const name = PersonName.of(' Juan ', ' Dela Cruz ', ' Santos ');
    expect(name.firstName).toBe('Juan');
    expect(name.lastName).toBe('Dela Cruz');
    expect(name.middleName).toBe('Santos');
    expect(name.fullName()).toBe('Juan Santos Dela Cruz');
  });

  it('omits an empty/whitespace-only middle name', () => {
    const name = PersonName.of('Juan', 'Dela Cruz', '   ');
    expect(name.middleName).toBeUndefined();
    expect(name.fullName()).toBe('Juan Dela Cruz');
  });

  it('throws InvalidPersonNameError for an empty first or last name', () => {
    expect(() => PersonName.of('', 'Dela Cruz')).toThrow(InvalidPersonNameError);
    expect(() => PersonName.of('Juan', '   ')).toThrow(InvalidPersonNameError);
  });

  it('equals compares by value', () => {
    const a = PersonName.of('Juan', 'Dela Cruz');
    const b = PersonName.of('Juan', 'Dela Cruz');
    const c = PersonName.of('Juan', 'Reyes');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
