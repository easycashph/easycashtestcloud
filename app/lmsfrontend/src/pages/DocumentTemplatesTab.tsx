import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { DocumentTemplateAdminResponse } from '@/lib/loanApiTypes';
import { cn } from '@/lib/utils';

/**
 * 2026-08-09 (Document Templates admin config, user request): "gawin nating configurable" - lets
 * MIS toggle a document template between Required (applies to every loan) and Conditional
 * (applies only to Loan Products explicitly mapped to it), and edit that mapping, without a
 * developer re-editing `prisma/seed.ts` each time (exactly what happened for QUIT_CLAIM and
 * ACKNOWLEDGEMENT_RECEIPT this same session). Structurally mirrors `RolesPermissionsTab.tsx`'s
 * fetch-once / local-draft / save-mutation shape. Wired to `GET /document-templates/admin`,
 * `PATCH /document-templates/:id/required`, `PUT /document-templates/:id/product-mappings`
 * (`document_template.manage`, MIS-only by default).
 */
export function DocumentTemplatesTab() {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [mappingTemplateId, setMappingTemplateId] = React.useState<string | null>(null);
  const [draftProductIds, setDraftProductIds] = React.useState<Set<string> | null>(null);
  const [productSearch, setProductSearch] = React.useState('');

  const query = useQuery({
    queryKey: ['document-templates-admin'],
    queryFn: () => apiClient.get<DocumentTemplateAdminResponse>('/document-templates/admin'),
  });

  const templates = query.data?.templates ?? [];
  const loanProducts = query.data?.loanProducts ?? [];
  const mappings = query.data?.mappings ?? [];
  const mappingTemplate = templates.find((t) => t.id === mappingTemplateId) ?? null;

  const mappedProductIdsFor = (templateId: string) =>
    new Set(mappings.filter((m) => m.documentTemplateId === templateId).map((m) => m.loanProductId));

  const activeProductIds = draftProductIds ?? (mappingTemplateId ? mappedProductIdsFor(mappingTemplateId) : new Set<string>());
  const isDirty =
    draftProductIds !== null &&
    mappingTemplateId !== null &&
    (() => {
      const saved = mappedProductIdsFor(mappingTemplateId);
      return draftProductIds.size !== saved.size || [...draftProductIds].some((id) => !saved.has(id));
    })();

  const requiredMutation = useMutation({
    mutationFn: ({ templateId, isRequired }: { templateId: string; isRequired: boolean }) =>
      apiClient.patch<DocumentTemplateAdminResponse>(`/document-templates/${templateId}/required`, { isRequired }),
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['document-templates-admin'], data);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update this template.'),
  });

  const openMapping = (templateId: string) => {
    setError(null);
    setProductSearch('');
    setDraftProductIds(null);
    setMappingTemplateId(templateId);
  };
  const closeMapping = () => {
    setMappingTemplateId(null);
    setDraftProductIds(null);
  };

  const toggleProduct = (productId: string, checked: boolean) => {
    const next = new Set(activeProductIds);
    if (checked) next.add(productId);
    else next.delete(productId);
    setDraftProductIds(next);
  };

  const saveMappingMutation = useMutation({
    mutationFn: () => {
      if (!mappingTemplateId) return Promise.reject(new Error('No template selected'));
      return apiClient.patch<DocumentTemplateAdminResponse>(`/document-templates/${mappingTemplateId}/product-mappings`, {
        loanProductIds: [...activeProductIds],
      });
    },
    onSuccess: (data) => {
      setError(null);
      queryClient.setQueryData(['document-templates-admin'], data);
      closeMapping();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save the product mapping.'),
  });

  const filteredProducts = loanProducts.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    return !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  if (query.isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (query.isError) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" /> Could not load document templates.
      </div>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Document Templates
          </CardTitle>
          <CardDescription>
            Toggle a template between Required (every loan) and Conditional (only the Loan Products you pick).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="mx-4 mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <div className="border-t">
            {templates.map((template, i) => {
              const mappedCount = mappedProductIdsFor(template.id).size;
              return (
                <div key={template.id} className={cn('flex items-center justify-between gap-3 px-4 py-3', i > 0 && 'border-t')}>
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.code}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {template.isRequired ? (
                      <span className="text-xs text-muted-foreground">Applies to every loan</span>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => openMapping(template.id)}>
                        {mappedCount === 0 ? 'No products mapped' : `Edit ${mappedCount} product${mappedCount === 1 ? '' : 's'}`}
                      </Button>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{template.isRequired ? 'Required' : 'Conditional'}</span>
                      <Switch
                        checked={template.isRequired}
                        onCheckedChange={(checked) => requiredMutation.mutate({ templateId: template.id, isRequired: checked })}
                        disabled={requiredMutation.isPending}
                        aria-label={`${template.name} required`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={mappingTemplateId !== null} onOpenChange={(open) => !open && !saveMappingMutation.isPending && closeMapping()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{mappingTemplate?.name} — applicable Loan Products</DialogTitle>
            <DialogDescription>
              Only checked products will generate and send this document. Unchecked products skip it entirely.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search loan products"
              className="pl-9"
            />
          </div>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            {filteredProducts.map((product, i) => (
              <label
                key={product.id}
                className={cn('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm', i > 0 && 'border-t')}
              >
                <input
                  type="checkbox"
                  checked={activeProductIds.has(product.id)}
                  onChange={(e) => toggleProduct(product.id, e.target.checked)}
                />
                <span>{product.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{product.code}</span>
              </label>
            ))}
            {filteredProducts.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No products match "{productSearch}".</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeMapping} disabled={saveMappingMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => saveMappingMutation.mutate()} disabled={!isDirty || saveMappingMutation.isPending}>
              {saveMappingMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
