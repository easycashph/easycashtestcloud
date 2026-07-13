import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/apiClient';
import type { ProfileNote, ProfileNoteOwnerType } from '@/lib/profileNoteApiTypes';
import { formatDateTime } from '@/lib/utils';

/**
 * Real, persisted running log (`POST/GET /profile-notes`) - built generically against
 * `ProfileNoteOwnerType` (`BORROWER` | `LOAN_ACCOUNT` | `LOAN_APPLICATION`), same
 * polymorphic-owner pattern as `AttachmentsPanel`, so it can be dropped onto any of those detail
 * pages. No edit/delete: an append-only log, not a wiki. Renamed from `NotesPanel.tsx`
 * (2026-07-13) to disambiguate from the separate `loan-note` module's own, differently-capable
 * notes (loan-account-only, MIS-deletable, audit-trailed) surfaced elsewhere.
 */
export function ProfileNotesPanel({ ownerType, ownerId }: { ownerType: ProfileNoteOwnerType; ownerId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState('');

  const queryKey = ['profile-notes', ownerType, ownerId];
  const notesQuery = useQuery({
    queryKey,
    queryFn: () => apiClient.get<ProfileNote[]>(`/profile-notes?ownerType=${ownerType}&ownerId=${ownerId}`),
  });

  const createMutation = useMutation({
    mutationFn: (text: string) => apiClient.post<ProfileNote>('/profile-notes', { ownerType, ownerId, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDraft('');
    },
  });

  const notes = notesQuery.data ?? [];
  const error = createMutation.error instanceof Error ? createMutation.error.message : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" /> Notes
        </CardTitle>
        <CardDescription>Running log visible to every staff member with access to this record.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-note">Add a note</Label>
          <Textarea
            id="new-note"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a note about this record..."
            rows={3}
          />
          <Button size="sm" onClick={() => createMutation.mutate(draft.trim())} disabled={!draft.trim() || createMutation.isPending}>
            Add Note
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        <Separator />

        {notesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{note.authorName ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.text}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
