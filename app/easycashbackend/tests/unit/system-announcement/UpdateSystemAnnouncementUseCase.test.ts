import { describe, expect, it, vi } from 'vitest';
import { UpdateSystemAnnouncementUseCase } from '@modules/system-announcement/application/use-cases/UpdateSystemAnnouncementUseCase';
import { SystemAnnouncement } from '@modules/system-announcement/domain/SystemAnnouncement';
import { NotFoundError, ValidationError } from '@shared/errors/DomainError';

function buildAnnouncement() {
  return SystemAnnouncement.create({
    title: 'Scheduled Maintenance',
    body: 'Downtime tonight.',
    type: 'MAINTENANCE',
    showOnLms: true,
    showOnPortal: true,
    expiresAt: null,
    createdByUserId: 'user-1',
  });
}

function buildDeps(announcement: SystemAnnouncement | null) {
  const systemAnnouncementRepository = {
    findById: vi.fn().mockResolvedValue(announcement),
    findMany: vi.fn(),
    findActiveForAudience: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  return { systemAnnouncementRepository };
}

describe('UpdateSystemAnnouncementUseCase', () => {
  it('deactivates an announcement (the admin list "Deactivate" action)', async () => {
    const announcement = buildAnnouncement();
    const deps = buildDeps(announcement);
    const useCase = new UpdateSystemAnnouncementUseCase(deps);

    const result = await useCase.execute(announcement.id, { active: false });

    expect(result.toProps().active).toBe(false);
    expect(deps.systemAnnouncementRepository.save).toHaveBeenCalledWith(announcement);
  });

  it('throws NotFoundError for an unknown id', async () => {
    const deps = buildDeps(null);
    const useCase = new UpdateSystemAnnouncementUseCase(deps);

    await expect(useCase.execute('missing', { active: false })).rejects.toThrow(NotFoundError);
  });

  it('rejects turning off both audiences at once', async () => {
    const announcement = buildAnnouncement();
    const deps = buildDeps(announcement);
    const useCase = new UpdateSystemAnnouncementUseCase(deps);

    await expect(useCase.execute(announcement.id, { showOnLms: false, showOnPortal: false })).rejects.toThrow(ValidationError);
  });

  it('allows switching audience from both to Portal-only', async () => {
    const announcement = buildAnnouncement();
    const deps = buildDeps(announcement);
    const useCase = new UpdateSystemAnnouncementUseCase(deps);

    const result = await useCase.execute(announcement.id, { showOnLms: false });

    expect(result.toProps()).toMatchObject({ showOnLms: false, showOnPortal: true });
  });

  it('clears an expiry when patched with expiresAt: null', async () => {
    const announcement = SystemAnnouncement.create({
      title: 'X',
      body: 'Y',
      type: 'GENERAL',
      showOnLms: true,
      showOnPortal: true,
      expiresAt: new Date('2026-01-01'),
      createdByUserId: 'user-1',
    });
    const deps = buildDeps(announcement);
    const useCase = new UpdateSystemAnnouncementUseCase(deps);

    const result = await useCase.execute(announcement.id, { expiresAt: null });

    expect(result.toProps().expiresAt).toBeNull();
  });
});
