import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiClient, fetchFileBlob } from '@/lib/apiClient';
import type { Attachment, AttachmentOwnerType } from '@/lib/documentApiTypes';

/**
 * Renders an owner's uploaded Profile Picture attachment (if any) in place of initials - shared
 * across the loan applications list/detail page and the Client Profile page (2026-07-14, extended
 * from `ownerType="LOAN_APPLICATION"`-only to also cover `"BORROWER"`). The download endpoint
 * requires a Bearer auth header, so a plain `<img src>` can't hit it directly - fetched as a blob
 * (same pattern as `AttachmentPreviewModal`) and rendered via an object URL.
 */
export function ApplicantAvatar({
  ownerType,
  ownerId,
  initials,
  className,
  fallbackClassName,
}: {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  initials: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const attachmentsQuery = useQuery({
    queryKey: ['attachments', ownerType, ownerId],
    queryFn: () => apiClient.get<Attachment[]>(`/attachments?ownerType=${ownerType}&ownerId=${ownerId}`),
  });
  const profilePicture = attachmentsQuery.data?.find((a) => a.documentCategory === 'PROFILE_PICTURE') ?? null;
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profilePicture) {
      setObjectUrl(null);
      return;
    }
    let cancelled = false;
    let localUrl: string | null = null;
    fetchFileBlob(`/attachments/${profilePicture.id}/download`)
      .then((blob) => {
        if (cancelled) return;
        localUrl = URL.createObjectURL(blob);
        setObjectUrl(localUrl);
      })
      .catch(() => {
        // Falls back to initials below - not worth a dedicated error state for an avatar.
      });
    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [profilePicture?.id]);

  return (
    <Avatar className={className ?? 'h-10 w-10'}>
      {objectUrl && <AvatarImage src={objectUrl} alt="Applicant profile picture" />}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
}
