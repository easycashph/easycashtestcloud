import * as React from 'react';

/**
 * 2026-07-31 (user request): "My Profile", "Security", and editing a loan application opened as a
 * Dialog on top of whatever page the applicant is already on (Dashboard, or the header nav from
 * anywhere) instead of navigating away to a separate page.
 *
 * 2026-09-14 (client portal UX pass, user request: "Do NOT use a pop-up/modal for My Profile...
 * must be a dedicated page"): the `profile` dialog type is gone - My Profile is a real `/profile`
 * route now (see PortalHeader.tsx). Security and per-application editing keep the original dialog
 * behavior; this Context+Provider still exists for those.
 */
type PortalDialogState = { type: 'security' } | { type: 'application'; id: string } | null;

interface PortalDialogContextValue {
  dialog: PortalDialogState;
  openSecurityDialog: () => void;
  openApplicationDialog: (id: string) => void;
  closeDialog: () => void;
}

const PortalDialogContext = React.createContext<PortalDialogContextValue | undefined>(undefined);

export function PortalDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = React.useState<PortalDialogState>(null);

  const value = React.useMemo<PortalDialogContextValue>(
    () => ({
      dialog,
      openSecurityDialog: () => setDialog({ type: 'security' }),
      openApplicationDialog: (id: string) => setDialog({ type: 'application', id }),
      closeDialog: () => setDialog(null),
    }),
    [dialog],
  );

  return <PortalDialogContext.Provider value={value}>{children}</PortalDialogContext.Provider>;
}

export function usePortalDialogs(): PortalDialogContextValue {
  const ctx = React.useContext(PortalDialogContext);
  if (!ctx) throw new Error('usePortalDialogs must be used within a PortalDialogProvider');
  return ctx;
}
