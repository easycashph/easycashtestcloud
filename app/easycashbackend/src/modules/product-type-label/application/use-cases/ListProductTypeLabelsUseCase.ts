import type { ProductTypeLabel } from '../../domain/ProductTypeLabel';
import type { IProductTypeLabelRepository } from '../ports/IProductTypeLabelRepository';

export class ListProductTypeLabelsUseCase {
  constructor(private readonly deps: { productTypeLabelRepository: IProductTypeLabelRepository }) {}

  async execute(): Promise<ProductTypeLabel[]> {
    return this.deps.productTypeLabelRepository.findAll();
  }
}
