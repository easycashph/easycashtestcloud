import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireRole } from '@shared/middleware/requireRole';
import { ForbiddenError } from '@shared/errors/DomainError';
import { UnauthorizedError } from '@modules/identity/application/errors/AuthErrors';

function buildRequest(roles?: string[]): Request {
  return {
    authUser: roles ? { sub: 'user-1', email: 'a@b.com', roles, branchId: 'branch-1', jti: 'jti-1' } : undefined,
  } as unknown as Request;
}

describe('requireRole (Milestone 8 / ADR-043: minimal role guard, no permission matrix)', () => {
  it('calls next() with no error when the user has one of the allowed roles', () => {
    const req = buildRequest(['CRM', 'Finance']);
    const next = vi.fn();

    requireRole('MIS', 'Finance')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ForbiddenError) when the user has none of the allowed roles', () => {
    const req = buildRequest(['Collection Officer']);
    const next = vi.fn();

    requireRole('MIS', 'Loan Operation Manager')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next(UnauthorizedError) if requireAuth never ran (no req.authUser)', () => {
    const req = buildRequest(undefined);
    const next = vi.fn();

    requireRole('MIS')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rejects when the allow-list is empty (no role can ever satisfy it)', () => {
    const req = buildRequest(['MIS']);
    const next = vi.fn();

    requireRole()(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
