import type { ProductTypeLabel } from '../../../domain/ProductTypeLabel';

export interface ProductTypeLabelHTTPResponse {
  id: string;
  canonicalKey: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export function presentProductTypeLabel(productTypeLabel: ProductTypeLabel): ProductTypeLabelHTTPResponse {
  const props = productTypeLabel.toProps();
  return {
    id: props.id,
    canonicalKey: props.canonicalKey,
    label: props.label,
    createdAt: props.createdAt.toISOString(),
    updatedAt: props.updatedAt.toISOString(),
  };
}
