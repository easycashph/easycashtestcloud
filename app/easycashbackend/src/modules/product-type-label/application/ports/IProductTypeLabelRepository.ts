import type { ProductTypeLabel } from '../../domain/ProductTypeLabel';

export interface IProductTypeLabelRepository {
  findAll(): Promise<ProductTypeLabel[]>;
  findById(id: string): Promise<ProductTypeLabel | null>;
  update(id: string, label: string): Promise<ProductTypeLabel>;
}
