export interface ProductTypeLabel {
  id: string;
  canonicalKey: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListProductTypeLabelsResponse {
  productTypeLabels: ProductTypeLabel[];
}
