import { describe, expect, it } from 'vitest';
import { Address } from '@modules/borrower/domain/valueObjects/Address';

describe('Address (ADR-042 §8: Value Object, not Aggregate)', () => {
  it('holds no ownerType/ownerId — those are a persistence-layer concern only', () => {
    const address = Address.of({ street: 'Rizal St.', cityMunicipality: 'Quezon City' });
    expect((address as unknown as Record<string, unknown>).ownerType).toBeUndefined();
    expect((address as unknown as Record<string, unknown>).ownerId).toBeUndefined();
  });

  it('equals compares by value, not identity', () => {
    const a = Address.of({ street: 'Rizal St.', province: 'Metro Manila' });
    const b = Address.of({ street: 'Rizal St.', province: 'Metro Manila' });
    const c = Address.of({ street: 'Mabini St.', province: 'Metro Manila' });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('toProps round-trips the constructed shape', () => {
    const props = { street: 'Rizal St.', lengthOfStayMonths: 24 };
    expect(Address.of(props).toProps()).toEqual(props);
  });
});
