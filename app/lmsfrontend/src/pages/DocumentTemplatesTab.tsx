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

interface TemplateDraft {
  isRequired: boolean;
  requiresBorrowerSignature: boolean;
  requiresCoBorrowerSignature: boolean;
}

/**
 * 2026-08-09 (Document Templates admin config, user request): "gawin nating configurable" - lets
 * MIS toggle a document template between Required (applies to every loan) and Conditional
 * (applies only to Loan Products explicitly mapped to it), and edit that mapping, without a
 * developer re-editing `prisma/seed.ts` each time (exactly what happened for QUIT_CLAIM and
 * ACKNOWLEDGEMENT_RECEIPT this same session). Wired to `GET /document-templates/admin`,
 * `PATCH /document-templates/:id/required`, `PATCH /document-templates/:id/signature-requirements`,
 * `PUT /document-templates/:id/product-mappings` (`document_template.manage`, MIS-only by default).
 *
 * 2026-08-20 (user request): the Required/Conditional and Borrower/Co-Borrower signature toggles
 * used to save instantly on every click - no undo, no review step. Converted to the same
 * draft-then-"Save changes" shape `RolesPermissionsTab.tsx` already uses (and the Product Mapping
 * dialog below already used) for consistency and to stop an accidental toggle click from
 * immediately changing which documents a loan requires. Draft state is keyed per template (a Map,
 * not a single value) since every template's row is visible and editable at once here, unlike
 * Roles & Permissions' one-role-at-a-time view.
 */
export function DocumentTemplatesTab() {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  const [mappingTemplateId, setMappingTemplateId] = React.useState<string | null>(null);
  const [draftProductIds, setDraftProductIds] = React.useState<Set<string> | null>(null);
  const [productSearch, setProductSearch] = React.useState('');
  const [draftByTemplateId, setDraftByTemplateId] = React.useState<Map<string, TemplateDraft>>(new Map());
  const [savingTemplateId, setSavingTemplateId] = React.useState<string | null>(null);

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

  const draftFor = (templateId: string): TemplateDraft | undefined => draftByTemplateId.get(templateId);
  const setDraftField = (templateId: string, field: keyof TemplateDraft, value: boolean) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setDraftByTemplateId((prev) => {
      const next = new Map(prev);
      const base = next.get(templateId) ?? {
        isRequired: template.isRequired,
        requiresBorrowerSignature: template.requiresBorrowerSignature,
        requiresCoBorrowerSignature: template.requiresCoBorrowerSignature,
      };
      next.set(templateId, { ...base, [field]: value });
      return next;
    });
  };
  const isTemplateDirty = (templateId: string): boolean => {
    const draft = draftByTemplateId.get(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (!draft || !template) return false;
    return (
      draft.isRequired !== template.isRequired ||
      draft.requiresBorrowerSignature !== template.requiresBorrowerSignature ||
      draft.requiresCoBorrowerSignature !== template.requiresCoBorrowerSignature
    );
  };
  const discardTemplateDraft = (templateId: string) => {
    setDraftByTemplateId((prev) => {
      const next = new Map(prev);
      next.delete(templateId);
      return next;
    });
  };

  const requiredMutation = useMutation({
    mutationFn: ({ templateId, isRequired }: { templateId: string; isRequired: boolean }) =>
      apiClient.patch<DocumentTemplateAdminResponse>(`/document-templates/${templateId}/required`, { isRequired }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update this template.'),
  });

  // 2026-08-09 (user request): independent of Required/Conditional - which party(ies) must sign
  // this template once generated, decides which e-signature batch(es) it's included in.
  const signatureMutation = useMutation({
    mutationFn: ({
      templateId,
      requiresBorrowerSignature,
      requiresCoBorrowerSignature,
    }: {
      templateId: string;
      requiresBorrowerSignature: boolean;
      requiresCoBorrowerSignature: boolean;
    }) =>
      apiClient.patch<DocumentTemplateAdminResponse>(`/document-templates/${templateId}/signature-requirements`, {
        requiresBorrowerSignature,
        requiresCoBorrowerSignature,
      }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update signature requirements.'),
  });

  // 2026-08-20 (user request): fires whichever of the two PATCH calls this template's draft
  // actually changed, then clears its draft on success - a row-level counterpart to
  // RolesPermissionsTab.tsx's single saveMutation.
  const saveTemplate = async (templateId: string) => {
    const draft = draftByTemplateId.get(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (!draft || !template) return;
    setError(null);
    setSavingTemplateId(templateId);
    try {
      let latest: DocumentTemplateAdminResponse | null = null;
      if (draft.isRequired !== template.isRequired) {
        latest = await requiredMutation.mutateAsync({ templateId, isRequired: draft.isRequired });
      }
      if (
        draft.requiresBorrowerSignature !== template.requiresBorrowerSignature ||
        draft.requiresCoBorrowerSignature !== template.requiresCoBorrowerSignature
      ) {
        latest = await signatureMutation.mutateAsync({
          templateId,
          requiresBorrowerSignature: draft.requiresBorrowerSignature,
          requiresCoBorrowerSignature: draft.requiresCoBorrowerSignature,
        });
      }
      if (latest) queryClient.setQueryData(['document-templates-admin'], latest);
      discardTemplateDraft(templateId);
    } catch {
      // Individual mutations already set `error` via their own onError - nothing further to do,
      // the draft stays intact so the attempted change isn't silently lost.
    } finally {
      setSavingTemplateId(null);
    }
  };

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
            Toggle a template between Required (every loan) and Conditional (only the Loan Products you pick), and
            which party(ies) must sign it once generated.
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
              const draft = draftFor(template.id);
              const isRequired = draft?.isRequired ?? template.isRequired;
              const requiresBorrowerSignature = draft?.requiresBorrowerSignature ?? template.requiresBorrowerSignature;
              const requiresCoBorrowerSignature = draft?.requiresCoBorrowerSignature ?? template.requiresCoBorrowerSignature;
              const dirty = isTemplateDirty(template.id);
              const isSaving = savingTemplateId === template.id;
              return (
                <div key={template.id} className={cn('space-y-2.5 px-4 py-3', i > 0 && 'border-t')}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.code}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {isRequired ? (
                        <span className="text-xs text-muted-foreground">Applies to every loan</span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => openMapping(template.id)}>
                          {mappedCount === 0 ? 'No products mapped' : `Edit ${mappedCount} product${mappedCount === 1 ? '' : 's'}`}
                        </Button>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{isRequired ? 'Required' : 'Conditional'}</span>
                        <Switch
                          checked={isRequired}
                          onCheckedChange={(checked) => setDraftField(template.id, 'isRequired', checked)}
                          disabled={isSaving}
                          aria-label={`${template.name} required`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 border-t border-dashed pt-2.5">
                    <span className="text-xs text-muted-foreground">Signed by:</span>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={requiresBorrowerSignature}
                        onCheckedChange={(checked) => setDraftField(template.id, 'requiresBorrowerSignature', checked)}
                        disabled={isSaving}
                        aria-label={`${template.name} requires borrower signature`}
                      />
                      Borrower
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={requiresCoBorrowerSignature}
                        onCheckedChange={(checked) => setDraftField(template.id, 'requiresCoBorrowerSignature', checked)}
                        disabled={isSaving}
                        aria-label={`${template.name} requires co-borrower signature`}
                      />
                      Co-Borrower
                    </label>
                    {dirty && (
                      <div className="ml-auto flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => discardTemplateDraft(template.id)} disabled={isSaving}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => saveTemplate(template.id)} disabled={isSaving}>
                          {isSaving ? 'Saving…' : 'Save changes'}
                        </Button>
                      </div>
                    )}
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
