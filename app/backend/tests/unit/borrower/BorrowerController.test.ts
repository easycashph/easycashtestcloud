import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { BorrowerController } from '@modules/borrower/interface/http/borrowerController';
import { Borrower } from '@modules/borrower/domain/Borrower';
import { CoBorrower } from '@modules/borrower/domain/CoBorrower';
import { PersonName } from '@modules/borrower/domain/valueObjects/PersonName';

/**
 * Controller unit tests (Milestone 8 testing strategy): call controller
 * methods directly with mock req/res/next and mocked use-case
 * dependencies — no Express, no supertest, no DB. Mirrors how use-case
 * tests already mock repository ports; runs everywhere in this
 * DB-less environment.
 */
function buildResponse() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
  return res as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function buildDeps() {
  return {
    createBorrowerUseCase: { execute: vi.fn() },
    getBorrowerUseCase: { execute: vi.fn() },
    listBorrowersUseCase: { execute: vi.fn() },
    createCoBorrowerUseCase: { execute: vi.fn() },
    getCoBorrowerUseCase: { execute: vi.fn() },
  } as never as ConstructorParameters<typeof BorrowerController>[0];
}

describe('BorrowerController (thin — no business logic; presenters used, never manual serialization)', () => {
  it('create() returns 201 with the presented borrower', async () => {
    const deps = buildDeps();
    const borrower = Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz') });
    (deps.createBorrowerUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(borrower);
    const controller = new BorrowerController(deps);
    const req = { body: { branchId: 'branch-1', firstName: 'Juan', lastName: 'Dela Cruz' } } as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: borrower.id, firstName: 'Juan' }));
    // Money/Percentage/Date never leak raw — Borrower has none, but Date fields must be ISO strings, not Date instances.
    const responseBody = res.json.mock.calls[0]?.[0];
    expect(typeof responseBody.createdAt).toBe('string');
    expect(next).not.toHaveBeenCalled();
  });

  it('create() forwards a thrown error to next() rather than throwing', async () => {
    const deps = buildDeps();
    const error = new Error('boom');
    (deps.createBorrowerUseCase.execute as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new BorrowerController(deps);
    const req = { body: {} } as Request;
    const res = buildResponse();
    const next = vi.fn();

    await controller.create(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('get() returns 200 with the presented borrower for the requested id', async () => {
    const deps = buildDeps();
    const borrower = Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz') });
    (deps.getBorrowerUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(borrower);
    const controller = new BorrowerController(deps);
    const req = { params: { id: borrower.id } } as unknown as Request;
    const res = buildResponse();

    await controller.get(req, res, vi.fn());

    expect(deps.getBorrowerUseCase.execute).toHaveBeenCalledWith(borrower.id);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('list() returns the paginated envelope { items, nextCursor }', async () => {
    const deps = buildDeps();
    const borrowers = [Borrower.create({ branchId: 'branch-1', name: PersonName.of('Juan', 'Dela Cruz') })];
    (deps.listBorrowersUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(borrowers);
    const controller = new BorrowerController(deps);
    const req = { query: { limit: '1' } } as unknown as Request;
    const res = buildResponse();

    await controller.list(req, res, vi.fn());

    expect(deps.listBorrowersUseCase.execute).toHaveBeenCalledWith({ limit: 1, cursor: undefined });
    const body = res.json.mock.calls[0]?.[0];
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe(borrowers[0]!.id); // full page (1 item, limit 1) -> nextCursor set
  });

  it('createCoBorrower() returns 201 with the presented co-borrower', async () => {
    const deps = buildDeps();
    const coBorrower = CoBorrower.create({ name: PersonName.of('Maria', 'Santos') });
    (deps.createCoBorrowerUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(coBorrower);
    const controller = new BorrowerController(deps);
    const req = { body: { firstName: 'Maria', lastName: 'Santos' } } as Request;
    const res = buildResponse();

    await controller.createCoBorrower(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: coBorrower.id }));
  });

  it('getCoBorrower() returns 200 with the presented co-borrower', async () => {
    const deps = buildDeps();
    const coBorrower = CoBorrower.create({ name: PersonName.of('Maria', 'Santos') });
    (deps.getCoBorrowerUseCase.execute as ReturnType<typeof vi.fn>).mockResolvedValue(coBorrower);
    const controller = new BorrowerController(deps);
    const req = { params: { id: coBorrower.id } } as unknown as Request;
    const res = buildResponse();

    await controller.getCoBorrower(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
