import { describe, expect, it, vi } from 'vitest';
import { CreateRoleClassUseCase } from '@modules/role-class/application/use-cases/CreateRoleClassUseCase';
import { UpdateRoleClassUseCase } from '@modules/role-class/application/use-cases/UpdateRoleClassUseCase';
import { DeleteRoleClassUseCase } from '@modules/role-class/application/use-cases/DeleteRoleClassUseCase';
import { RoleClass } from '@modules/role-class/domain/RoleClass';
import { DomainError, NotFoundError } from '@shared/errors/DomainError';

const MIS_ROLE_ID = 'role-mis';
const CRM_ROLE_ID = 'role-crm';

function makeRoleClass(overrides: Partial<Parameters<typeof RoleClass.fromRecord>[0]> = {}) {
  return RoleClass.fromRecord({
    id: 'rc-1',
    roleId: MIS_ROLE_ID,
    roleName: 'MIS',
    name: 'MIS Manager',
    userCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('CreateRoleClassUseCase', () => {
  it('rejects a duplicate name under the same Role Type', async () => {
    const existing = makeRoleClass();
    const roleClassRepository = {
      findAllRoleTypes: vi.fn().mockResolvedValue([{ id: MIS_ROLE_ID, name: 'MIS' }]),
      findAll: vi.fn().mockResolvedValue([existing]),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const useCase = new CreateRoleClassUseCase({ roleClassRepository });

    await expect(useCase.execute({ roleId: MIS_ROLE_ID, name: 'mis manager' })).rejects.toThrow(DomainError);
    expect(roleClassRepository.create).not.toHaveBeenCalled();
  });

  it('creates when the name is unique for that Role Type', async () => {
    const roleClassRepository = {
      findAllRoleTypes: vi.fn().mockResolvedValue([{ id: MIS_ROLE_ID, name: 'MIS' }]),
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      create: vi.fn().mockResolvedValue(makeRoleClass()),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const useCase = new CreateRoleClassUseCase({ roleClassRepository });

    await useCase.execute({ roleId: MIS_ROLE_ID, name: 'MIS Manager' });

    expect(roleClassRepository.create).toHaveBeenCalledWith({ roleId: MIS_ROLE_ID, name: 'MIS Manager' });
  });
});

describe('UpdateRoleClassUseCase', () => {
  it('reassigns a Role Class to a different Role Type', async () => {
    const existing = makeRoleClass();
    const roleClassRepository = {
      findAllRoleTypes: vi.fn().mockResolvedValue([
        { id: MIS_ROLE_ID, name: 'MIS' },
        { id: CRM_ROLE_ID, name: 'CRM' },
      ]),
      findAll: vi.fn().mockResolvedValue([existing]),
      findById: vi.fn().mockResolvedValue(existing),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(makeRoleClass({ roleId: CRM_ROLE_ID, roleName: 'CRM' })),
      delete: vi.fn(),
    };
    const useCase = new UpdateRoleClassUseCase({ roleClassRepository });

    const result = await useCase.execute('rc-1', { roleId: CRM_ROLE_ID });

    expect(roleClassRepository.update).toHaveBeenCalledWith('rc-1', { roleId: CRM_ROLE_ID });
    expect(result.roleId).toBe(CRM_ROLE_ID);
  });

  it('rejects renaming into a name that already exists under the target Role Type', async () => {
    const existing = makeRoleClass();
    const other = makeRoleClass({ id: 'rc-2', name: 'Senior MIS' });
    const roleClassRepository = {
      findAllRoleTypes: vi.fn().mockResolvedValue([{ id: MIS_ROLE_ID, name: 'MIS' }]),
      findAll: vi.fn().mockResolvedValue([existing, other]),
      findById: vi.fn().mockResolvedValue(existing),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const useCase = new UpdateRoleClassUseCase({ roleClassRepository });

    await expect(useCase.execute('rc-1', { name: 'Senior MIS' })).rejects.toThrow(DomainError);
    expect(roleClassRepository.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError for a Role Class that does not exist', async () => {
    const roleClassRepository = {
      findAllRoleTypes: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const useCase = new UpdateRoleClassUseCase({ roleClassRepository });

    await expect(useCase.execute('missing', { name: 'X' })).rejects.toThrow(NotFoundError);
  });
});

describe('DeleteRoleClassUseCase', () => {
  it('blocks deletion when staff are still assigned', async () => {
    const inUse = makeRoleClass({ userCount: 3 });
    const roleClassRepository = {
      findAllRoleTypes: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn().mockResolvedValue(inUse),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const useCase = new DeleteRoleClassUseCase({ roleClassRepository });

    await expect(useCase.execute('rc-1')).rejects.toThrow(DomainError);
    expect(roleClassRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes when no staff are assigned', async () => {
    const unused = makeRoleClass({ userCount: 0 });
    const roleClassRepository = {
      findAllRoleTypes: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn().mockResolvedValue(unused),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new DeleteRoleClassUseCase({ roleClassRepository });

    await useCase.execute('rc-1');

    expect(roleClassRepository.delete).toHaveBeenCalledWith('rc-1');
  });

  it('throws NotFoundError for a Role Class that does not exist', async () => {
    const roleClassRepository = {
      findAllRoleTypes: vi.fn(),
      findAll: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const useCase = new DeleteRoleClassUseCase({ roleClassRepository });

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
