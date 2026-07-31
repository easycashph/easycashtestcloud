import { describe, expect, it, vi } from 'vitest';
import { LogSectionViewUseCase } from '@modules/audit/application/use-cases/LogSectionViewUseCase';

function buildDeps() {
  return { auditLogger: { log: vi.fn().mockResolvedValue(undefined) } };
}

describe('LogSectionViewUseCase', () => {
  it('defaults to VIEW_SECTION when no action is given', async () => {
    const deps = buildDeps();
    const useCase = new LogSectionViewUseCase(deps);

    await useCase.execute({ userId: 'user-1', section: 'E-signature Logs' });

    expect(deps.auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VIEW_SECTION', entityType: 'E-signature Logs', entityId: 'E-signature Logs' }),
    );
  });

  it('uses a caller-supplied action instead of VIEW_SECTION when given', async () => {
    const deps = buildDeps();
    const useCase = new LogSectionViewUseCase(deps);

    await useCase.execute({
      userId: 'user-1',
      section: 'E-signature Logs',
      action: 'OPEN_SIGNING_LOG',
      entityId: 'SML-Self_00058',
    });

    expect(deps.auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'OPEN_SIGNING_LOG', entityType: 'E-signature Logs', entityId: 'SML-Self_00058' }),
    );
  });
});
