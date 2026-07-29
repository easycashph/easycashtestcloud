import * as React from 'react';
import { apiClient, fetchFileBlob, ApiError } from '@/lib/apiClient';
import type { UploadedDocument } from '@/lib/portalApiTypes';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Loan applicant avatar (2026-07-27 user request) - lets a client upload their own profile
 * picture, stored the same way as the LMS's PROFILE_PICTURE attachment (see ApplicantAvatar.tsx on
 * the internal LMS frontend), just against `ownerType=LOAN_APPLICATION` since a not-yet-linked
 * applicant has no Borrower record to attach it to. */
export function PortalAvatar({
  loanApplicationId,
  initials,
  editable = true,
}: {
  loanApplicationId: string;
  initials: string;
  editable?: boolean;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadPicture = React.useCallback(() => {
    apiClient
      .get<UploadedDocument[]>(`/portal/loan-applications/${loanApplicationId}/documents`)
      .then((documents) => {
        const picture = documents.find((d) => d.documentCategory === 'PROFILE_PICTURE');
        if (!picture) {
          setObjectUrl(null);
          return;
        }
        return fetchFileBlob(`/portal/loan-applications/${loanApplicationId}/documents/${picture.id}/download`).then((blob) => {
          setObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        });
      })
      .catch(() => {
        // Falls back to initials - not worth a dedicated error state for an avatar.
      });
  }, [loanApplicationId]);

  React.useEffect(() => {
    loadPicture();
    return () => {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadPicture]);

  const handleFileSelected = async (file: File) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Unsupported file type. Allowed: JPEG, PNG.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`);
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      await apiClient.postFile(`/portal/loan-applications/${loanApplicationId}/documents`, file, { documentCategory: 'PROFILE_PICTURE' });
      loadPicture();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload the photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {objectUrl ? <img src={objectUrl} alt="Profile picture" className="h-full w-full object-cover" /> : initials}
      </div>
      {editable && (
        <div className="space-y-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            {isUploading ? 'Uploading…' : 'Upload Profile Picture'}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
