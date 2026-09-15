import * as React from 'react';
import { Camera, Upload } from 'lucide-react';
import { apiClient, fetchFileBlob, ApiError } from '@/lib/apiClient';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const SIZE_CLASSES: Record<'md' | 'lg', string> = {
  md: 'h-14 w-14 text-sm',
  lg: 'h-24 w-24 text-xl sm:h-28 sm:w-28',
};

/**
 * Account-level profile photo (2026-09-14 user request: "make profile picture mandatory") -
 * uploads to `/portal/profile/photo`, owned directly by the PortalAccount
 * (`AttachmentOwnerType.PORTAL_ACCOUNT`), independent of any loan application.
 *
 * Deliberately a separate component from `PortalAvatar.tsx`, not a shared one with an optional
 * prop: `PortalAvatar` is scoped to one specific `loanApplicationId` and only exists once a client
 * has submitted an application, which is exactly the gap this component fills - a first-login
 * client with no application yet still needs somewhere to upload a required photo. Once uploaded
 * here it's the client's one account-wide photo regardless of how many applications they later
 * submit.
 *
 * 2026-09-14 (client portal UX pass, user request: "option to upload or take a photo") - "Upload
 * Photo" is a plain file input (gallery/file picker on every platform).
 *
 * 2026-09-15 (user request: "the take a photo button is like upload button, it should allow
 * access to camera and take a photo") - "Take Photo" now opens a real live camera preview via
 * `getUserMedia`/`<video>` + a Capture button that grabs the current frame onto a `<canvas>`, on
 * every platform (desktop webcam included) rather than relying on `<input capture>`, which only
 * ever opens the OS's own camera app on some mobile browsers and is indistinguishable from a
 * plain file picker everywhere else (exactly the bug reported). Falls back to the old
 * `capture="user"` file input only if `getUserMedia` itself is unavailable/denied/errors (an
 * unsupported browser, or a context that isn't HTTPS/localhost) - so an applicant is never fully
 * blocked from taking a photo just because the live-preview path failed. `size="lg"` is the
 * dedicated My Profile page's prominent display; the default (`"md"`) matches the first-login
 * onboarding gate's original size.
 */
export function PortalProfilePhoto({
  initials,
  size = 'md',
  onUploaded,
}: {
  initials: string;
  size?: 'md' | 'lg';
  /** Fires after a successful upload so the parent (the onboarding gate) can recompute whether
   * the profile is now complete without a full page reload. */
  onUploaded?: () => void;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = React.useState<boolean | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  // Live camera capture (2026-09-15 user request) - `stream` holds the active getUserMedia stream
  // while the camera dialog is open; `cameraError` is scoped separately from `error` (the
  // upload-failure message) so a denied/unavailable camera doesn't get silently overwritten by,
  // or overwrite, an unrelated upload error.
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const loadPhoto = React.useCallback(() => {
    fetchFileBlob('/portal/profile/photo')
      .then((blob) => {
        setObjectUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setHasPhoto(true);
      })
      .catch(() => {
        // 404 (no photo yet) falls back to initials - not worth a dedicated error state.
        setHasPhoto(false);
      });
  }, []);

  React.useEffect(() => {
    loadPhoto();
    return () => {
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadPhoto]);

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
      await apiClient.postFile('/portal/profile/photo', file);
      loadPhoto();
      onUploaded?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload the photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Attaches the live stream to the <video> element once both exist (the element only mounts
  // once the camera dialog opens, after `stream` may already be set).
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // Always stop the camera's underlying hardware track on unmount, not just on an explicit
  // Cancel/Capture - otherwise a component unmount while the dialog is open (e.g. navigating away)
  // would leave the camera light on.
  React.useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const closeCamera = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setIsCameraOpen(false);
    setCameraError(null);
  };

  const openCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setStream(mediaStream);
    } catch {
      // Denied permission, no camera present, or an unsupported/non-secure context - fall back to
      // the OS's own camera app via the hidden capture input rather than leaving the applicant
      // stuck with no way to take a photo at all.
      setIsCameraOpen(false);
      cameraInputRef.current?.click();
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Could not capture a photo. Please try again.');
          return;
        }
        closeCamera();
        void handleFileSelected(new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <div className="flex items-center gap-4">
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary ${SIZE_CLASSES[size]}`}>
        {objectUrl ? <img src={objectUrl} alt="Profile photo" className="h-full w-full object-cover" /> : initials}
      </div>
      <div className="space-y-1.5">
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
        {/* Same accept/handler as the plain input above - only the camera-opening `capture`
            attribute differs (see this component's own doc comment). */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {isUploading ? 'Uploading…' : hasPhoto ? 'Change Photo' : 'Upload Photo'}
          </button>
          <button
            type="button"
            onClick={() => void openCamera()}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            Take Photo
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <Dialog open={isCameraOpen} onClose={closeCamera} title="Take a Photo">
        <div className="space-y-4">
          {cameraError ? (
            <p className="text-sm text-destructive">{cameraError}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-square w-full scale-x-[-1] rounded-xl bg-black object-cover"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeCamera}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCapture} disabled={!stream || Boolean(cameraError)}>
              <Camera className="h-4 w-4" />
              Capture
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
