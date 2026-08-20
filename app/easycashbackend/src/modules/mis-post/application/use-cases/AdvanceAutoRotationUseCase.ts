import type { IMisPostRepository } from '../ports/IMisPostRepository';

/**
 * Advances the AUTO_ROTATION pool by exactly one step (2026-08-20 user request: "1 active post
 * lang per day... 24 hours ipapakita, kapag lumipas na, panibagong automatic post"). Run once
 * every 24 hours by `misPostRotationScheduler.ts`. Sequential, wraps around (user-confirmed):
 * finds the currently-live pool item's `poolOrder`, picks the next active pool item after it (by
 * `poolOrder`), or wraps back to the first if there is none - then flips the live flag from the
 * old item to the new one. If nothing is currently live (first run, or the live item was disabled
 * out of the pool), just lights up the first pool item.
 */
export class AdvanceAutoRotationUseCase {
  constructor(private readonly deps: { misPostRepository: IMisPostRepository }) {}

  async execute(): Promise<void> {
    const pool = await this.deps.misPostRepository.findAutoRotationPool();
    if (pool.length === 0) return;

    const current = await this.deps.misPostRepository.findCurrentLiveAutoPost();
    const currentIndex = current ? pool.findIndex((p) => p.id === current.id) : -1;
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % pool.length;

    if (current && current.id !== pool[nextIndex]!.id) {
      current.setIsCurrentlyLive(false);
      await this.deps.misPostRepository.save(current);
    }

    if (!current || current.id !== pool[nextIndex]!.id) {
      pool[nextIndex]!.setIsCurrentlyLive(true);
      await this.deps.misPostRepository.save(pool[nextIndex]!);
    }
  }
}
