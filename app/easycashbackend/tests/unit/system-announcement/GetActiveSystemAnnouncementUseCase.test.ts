import { describe, expect, it, vi } from 'vitest';
import { GetActiveSystemAnnouncementUseCase } from '@modules/system-announcement/application/use-cases/GetActiveSystemAnnouncementUseCase';
import { SystemAnnouncement } from '@modules/system-announcement/domain/SystemAnnouncement';

describe('GetActiveSystemAnnouncementUseCase', () => {
  it('passes the requested audience through to the repository', async () => {
    const announcement = SystemAnnouncement.create({
      title: 'X',
      body: 'Y',
      type: 'NEWS',
      showOnLms: true,
      showOnPortal: false,
      expiresAt: null,
      createdByUserId: 'user-1',
    });
    const systemAnnouncementRepository = { findById: vi.fn(), findMany: vi.fn(), findActiveForAudience: vi.fn().mockResolvedValue(announcement), save: vi.fn(), delete: vi.fn() };
    const useCase = new GetActiveSystemAnnouncementUseCase({ systemAnnouncementRepository });

    const result = await useCase.execute('LMS');

    expect(systemAnnouncementRepository.findActiveForAudience).toHaveBeenCalledWith('LMS', expect.any(Date));
    expect(result).toBe(announcement);
  });

  it('returns null when nothing is currently active for the audience', async () => {
    const systemAnnouncementRepository = { findById: vi.fn(), findMany: vi.fn(), findActiveForAudience: vi.fn().mockResolvedValue(null), save: vi.fn(), delete: vi.fn() };
    const useCase = new GetActiveSystemAnnouncementUseCase({ systemAnnouncementRepository });

    const result = await useCase.execute('PORTAL');

    expect(result).toBeNull();
  });
});
