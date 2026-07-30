import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { assertBranchAccess, resolveBranchFilter, resolveBranchScope, resolveWriteBranchId } from '@shared/http/branchScope';
import { ForbiddenError } from '@shared/errors/DomainError';
import { UnauthorizedError } from '@modules/identity/application/errors/AuthErrors';

function buildRequest(roles: string[], branchId = 'branch-1'): Request {
  return { authUser: { sub: 'user-1', email: 'a@b.com', roles, branchId, jti: 'jti-1' } } as unknown as Request;
}

describe('resolveBranchScope (Milestone 8.1 remediation, H-1)', () => {
  it('marks MIS as global', () => {
    expect(resolveBranchScope(buildRequest(['MIS'], 'branch-1'))).toEqual({ branchId: 'branch-1', isGlobal: true });
  });

  it('marks every other confirmed role as branch-scoped', () => {
    for (const role of ['Loan Operation Manager', 'CRM', 'Finance', 'Accounting', 'Collection Officer']) {
      expect(resolveBranchScope(buildRequest([role], 'branch-1')).isGlobal).toBe(false);
    }
  });

  it('is global if ANY of the user\'s roles is MIS', () => {
    expect(resolveBranchScope(buildRequest(['CRM', 'MIS'])).isGlobal).toBe(true);
  });

  it('throws UnauthorizedError when req.authUser is missing', () => {
    expect(() => resolveBranchScope({} as Request)).toThrow(UnauthorizedError);
  });
});

describe('assertBranchAccess', () => {
  it('allows access to a matching branch for a scoped user', () => {
    expect(() => assertBranchAccess({ branchId: 'branch-1', isGlobal: false }, 'branch-1')).not.toThrow();
  });

  it('throws ForbiddenError for a different branch, scoped user', () => {
    expect(() => assertBranchAccess({ branchId: 'branch-1', isGlobal: false }, 'branch-2')).toThrow(ForbiddenError);
  });

  it('allows access to any branch for a global user', () => {
    expect(() => assertBranchAccess({ branchId: 'branch-1', isGlobal: true }, 'branch-2')).not.toThrow();
  });
});

describe('resolveBranchFilter', () => {
  it('returns undefined (no filter) for a global user', () => {
    expect(resolveBranchFilter({ branchId: 'branch-1', isGlobal: true })).toBeUndefined();
  });

  it('returns the own branchId for a scoped user', () => {
    expect(resolveBranchFilter({ branchId: 'branch-1', isGlobal: false })).toBe('branch-1');
  });
});

describe('resolveWriteBranchId', () => {
  it('ignores the requested branchId for a scoped user — always uses their own', () => {
    expect(resolveWriteBranchId({ branchId: 'branch-1', isGlobal: false }, 'branch-2')).toBe('branch-1');
  });

  it('trusts the requested branchId for a global user', () => {
    expect(resolveWriteBranchId({ branchId: 'branch-1', isGlobal: true }, 'branch-2')).toBe('branch-2');
  });
});
