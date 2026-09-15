import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, MapPinOff, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { NegativeArea } from '@/lib/negativeAreaApiTypes';
import { useRole } from '@/lib/roleContext';

/**
 * 2026-09-15 (Negative Areas admin config, user request): "gawin nating configurable" - lets MIS
 * maintain the high-risk address list that feeds LoanApplicationPreQualificationService's advisory
 * Negative Area check, without a developer editing code each time (mirrors DocumentTemplatesTab's
 * own reasoning). Wired to `GET/POST /negative-areas` and `DELETE /negative-areas/:id`
 * (`negative_area.manage`, MIS-only by default). Seeded from an internal reference spreadsheet the
 * user provided - grouped by city for display, but matching (in the pre-qualification check
 * itself) is against `areaName` text only.
 */
export function NegativeAreasTab() {
  const { canManageNegativeAreas } = useRole();
  const queryClient = useQueryClient();
  const [city, setCity] = React.useState('');
  const [areaName, setAreaName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['negative-areas'],
    queryFn: () => apiClient.get<{ items: NegativeArea[] }>('/negative-areas'),
    enabled: canManageNegativeAreas,
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post<NegativeArea>('/negative-areas', { city: city.trim(), areaName: areaName.trim() }),
    onSuccess: () => {
      setCity('');
      setAreaName('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['negative-areas'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not add this area. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/negative-areas/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['negative-areas'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not remove this area. Please try again.'),
  });

  if (!canManageNegativeAreas) {
    return <p className="text-sm text-muted-foreground">You don't have access to Negative Areas.</p>;
  }

  const items = query.data?.items ?? [];
  const groupedByCity = new Map<string, NegativeArea[]>();
  for (const item of items) {
    const group = groupedByCity.get(item.city) ?? [];
    group.push(item);
    groupedByCity.set(item.city, group);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a Negative Area</CardTitle>
          <CardDescription>
            Feeds the Loan Application pre-qualification "Negative Area" check - an applicant whose address text matches an area here
            contributes to a PREDECLINED pre-classification. Advisory only; staff still review every application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!city.trim() || !areaName.trim()) return;
              createMutation.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="negative-area-city" className="text-xs text-muted-foreground">
                City / Province
              </Label>
              <Input
                id="negative-area-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. MANILA"
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="negative-area-name" className="text-xs text-muted-foreground">
                Area / Barangay / Street
              </Label>
              <Input
                id="negative-area-name"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="e.g. Baseco, Tondo"
                className="w-64"
              />
            </div>
            <Button type="submit" disabled={createMutation.isPending || !city.trim() || !areaName.trim()}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {createMutation.isPending ? 'Adding…' : 'Add'}
            </Button>
          </form>
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPinOff className="h-4 w-4 text-muted-foreground" /> Negative Areas List
          </CardTitle>
          <CardDescription>
            {items.length} area{items.length === 1 ? '' : 's'} across {groupedByCity.size} cit{groupedByCity.size === 1 ? 'y' : 'ies'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No negative areas configured yet - add one above.</p>
          ) : (
            [...groupedByCity.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupCity, groupItems]) => (
                <div key={groupCity}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{groupCity}</p>
                  <div className="divide-y rounded-md border">
                    {groupItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span>{item.areaName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
