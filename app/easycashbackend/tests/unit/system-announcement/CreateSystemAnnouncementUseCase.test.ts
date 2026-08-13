import { describe, expect, it, vi } from 'vitest';
import { CreateSystemAnnouncementUseCase } from '@modules/system-announcement/application/use-cases/CreateSystemAnnouncementUseCase';
import { ValidationError } from '@shared/errors/DomainError';

function buildDeps() {
  const systemAnnouncementRepository = { findById: vi.fn(), findMany: vi.fn(), findActiveForAudience: vi.fn(), save: vi.fn(), delete: vi.fn() };
  return { systemAnnouncementRepository };
}

const baseInput = {
  title: 'Scheduled Maintenance',
  body: 'The system will be unavailable from 2AM to 4AM.',
  type: 'MAINTENANCE' as const,
  showOnLms: true,
  showOnPortal: true,
  expiresAt: null,
  createdByUserId: 'user-1',
};

describe('CreateSystemAnnouncementUseCase', () => {
  it('creates and saves an announcement', async () => {
    const deps = buildDeps();
    const useCase = new CreateSystemAnnouncementUseCase(deps);

    const announcement = await useCase.execute(baseInput);

    expect(announcement.toProps()).toMatchObject({
      title: 'Scheduled Maintenance',
      type: 'MAINTENANCE',
      active: true,
      createdByUserId: 'user-1',
    });
    expect(deps.systemAnnouncementRepository.save).toHaveBeenCalledWith(announcement);
  });

  it('rejects a blank title', async () => {
    const deps = buildDeps();
    const useCase = new CreateSystemAnnouncementUseCase(deps);

    await expect(useCase.execute({ ...baseInput, title: '   ' })).rejects.toThrow(ValidationError);
    expect(deps.systemAnnouncementRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a blank body', async () => {
    const deps = buildDeps();
    const useCase = new CreateSystemAnnouncementUseCase(deps);

    await expect(useCase.execute({ ...baseInput, body: '' })).rejects.toThrow(ValidationError);
  });

  it('rejects when neither audience is selected', async () => {
    const deps = buildDeps();
    const useCase = new CreateSystemAnnouncementUseCase(deps);

    await expect(useCase.execute({ ...baseInput, showOnLms: false, showOnPortal: false })).rejects.toThrow(ValidationError);
  });

  it('allows targeting only one audience', async () => {
    const deps = buildDeps();
    const useCase = new CreateSystemAnnouncementUseCase(deps);

    const announcement = await useCase.execute({ ...baseInput, showOnLms: true, showOnPortal: false });

    expect(announcement.toProps()).toMatchObject({ showOnLms: true, showOnPortal: false });
  });
});
