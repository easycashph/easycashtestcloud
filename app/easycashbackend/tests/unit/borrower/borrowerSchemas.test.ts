import { describe, expect, it } from 'vitest';
import { createBorrowerSchema, createCoBorrowerSchema } from '@modules/borrower/interface/http/borrowerSchemas';

describe('createBorrowerSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createBorrowerSchema.safeParse({ branchId: 'branch-1', firstName: 'Juan', lastName: 'Dela Cruz' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing branchId', () => {
    const result = createBorrowerSchema.safeParse({ firstName: 'Juan', lastName: 'Dela Cruz' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty firstName', () => {
    const result = createBorrowerSchema.safeParse({ branchId: 'branch-1', firstName: '', lastName: 'Dela Cruz' });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = createBorrowerSchema.safeParse({
      branchId: 'branch-1',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('coerces a birthDate string into a Date', () => {
    const result = createBorrowerSchema.safeParse({
      branchId: 'branch-1',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      birthDate: '1990-01-01',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.birthDate).toBeInstanceOf(Date);
  });
});

describe('createCoBorrowerSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createCoBorrowerSchema.safeParse({ firstName: 'Maria', lastName: 'Santos' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing lastName', () => {
    const result = createCoBorrowerSchema.safeParse({ firstName: 'Maria' });
    expect(result.success).toBe(false);
  });
});
