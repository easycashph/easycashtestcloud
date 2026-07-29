import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { ListProductTypeLabelsResponse, ProductTypeLabel } from '@/lib/productTypeLabelApiTypes';

/**
 * Renamable display labels for `productTypeClassification.ts`'s canonical Product Types
 * (2026-07-20 user request) - fetched once and cached; every consumer falls back to the canonical
 * key itself if the label hasn't loaded yet (or has no override row), so a slow/failed request
 * never breaks the Product Type pickers, only leaves them showing the un-renamed default text.
 */
export function useProductTypeLabels() {
  return useQuery({
    queryKey: ['product-type-labels'],
    queryFn: () => apiClient.get<ListProductTypeLabelsResponse>('/product-type-labels'),
    staleTime: 5 * 60 * 1000,
  });
}

/** Looks up the renamed display label for a canonical Product Type key - falls back to the key itself (e.g. "Other", or before the labels have loaded). */
export function productTypeLabel(labels: ProductTypeLabel[] | undefined, canonicalKey: string): string {
  return labels?.find((l) => l.canonicalKey === canonicalKey)?.label ?? canonicalKey;
}
