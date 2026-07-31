import * as React from 'react';

/**
 * 2026-07-31 (user request): "My Profile", "Security", and editing a loan application now open as
 * a Dialog on top of whatever page the applicant is already on (Dashboard, or the header nav from
 * anywhere) instead of navigating away to a separate page. A single Context+Provider so the header
 * (rendered on every authenticated page) and the Dashboard's "Edit" button can open the same
 * dialog regardless of which page they're mounted on - see PortalDialogHost, the single place that
 * actually renders the Dialog.
 */
type PortalDialogState = { type: 'profile' } | { type: 'security' } | { type: 'application'; id: string } | null;

interface PortalDialogContextValue {
  dialog: PortalDialogState;
  openProfileDialog: () => void;
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
      openProfileDialog: () => setDialog({ type: 'profile' }),
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
