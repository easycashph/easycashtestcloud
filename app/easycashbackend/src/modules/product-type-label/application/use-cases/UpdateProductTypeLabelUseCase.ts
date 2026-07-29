import { DomainError, ValidationError, NotFoundError } from '@shared/errors/DomainError';
import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';
import type { ProductTypeLabel } from '../../domain/ProductTypeLabel';
import type { IProductTypeLabelRepository } from '../ports/IProductTypeLabelRepository';

export class UpdateProductTypeLabelUseCase {
  constructor(private readonly deps: { productTypeLabelRepository: IProductTypeLabelRepository; auditLogger?: IAuditLogger }) {}

  async execute(id: string, label: string, updatedByUserId?: string): Promise<ProductTypeLabel> {
    const trimmed = label.trim();
    if (!trimmed) {
      throw new ValidationError('Label is required.');
    }

    const existing = await this.deps.productTypeLabelRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('ProductTypeLabel', id);
    }

    const all = await this.deps.productTypeLabelRepository.findAll();
    const duplicate = all.some((pt) => pt.id !== id && pt.label.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      throw new DomainError('DUPLICATE_PRODUCT_TYPE_LABEL', `"${trimmed}" is already used by another Product Type.`, undefined, 409);
    }

    const updated = await this.deps.productTypeLabelRepository.update(id, trimmed);

    if (this.deps.auditLogger && updatedByUserId) {
      await this.deps.auditLogger.log({
        userId: updatedByUserId,
        action: 'UPDATE_PRODUCT_TYPE_LABEL',
        entityType: 'ProductTypeLabel',
        entityId: id,
        previousValue: { label: existing.label },
        newValue: { label: updated.label },
      });
    }

    return updated;
  }
}
