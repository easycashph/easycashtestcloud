export type SystemAnnouncementType = 'MAINTENANCE' | 'NEWS' | 'GENERAL';

export interface SystemAnnouncement {
  id: string;
  title: string;
  body: string;
  type: SystemAnnouncementType;
  showOnLms: boolean;
  showOnPortal: boolean;
  active: boolean;
  expiresAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSystemAnnouncementInput {
  title: string;
  body: string;
  type: SystemAnnouncementType;
  showOnLms: boolean;
  showOnPortal: boolean;
  expiresAt: string | null;
}

export interface UpdateSystemAnnouncementInput {
  title?: string;
  body?: string;
  type?: SystemAnnouncementType;
  showOnLms?: boolean;
  showOnPortal?: boolean;
  active?: boolean;
  expiresAt?: string | null;
}

/** Starter content MIS can pick from instead of writing every announcement from scratch - still
 * fully editable before posting ("Custom" leaves both fields blank). Not stored server-side -
 * purely a frontend convenience, same spirit as a form's placeholder text. */
export const ANNOUNCEMENT_TEMPLATES: { label: string; type: SystemAnnouncementType; title: string; body: string }[] = [
  {
    label: 'Scheduled Maintenance',
    type: 'MAINTENANCE',
    title: 'Scheduled Maintenance',
    body: 'We will be performing scheduled maintenance on [DATE] from [START TIME] to [END TIME]. The system may be temporarily unavailable during this period. We apologize for the inconvenience.',
  },
  {
    label: 'Emergency Maintenance',
    type: 'MAINTENANCE',
    title: 'Emergency Maintenance In Progress',
    body: 'We are currently performing emergency maintenance to resolve a technical issue. We expect service to be restored shortly. Thank you for your patience.',
  },
  {
    label: 'Maintenance Completed',
    type: 'NEWS',
    title: 'Maintenance Completed',
    body: 'Scheduled maintenance has been completed and the system is back to normal. Thank you for your patience.',
  },
  {
    label: 'Network/Internet Advisory',
    type: 'MAINTENANCE',
    title: 'Network Connectivity Advisory',
    body: 'We are currently experiencing network connectivity issues that may affect system access. Our team is working to resolve this as quickly as possible.',
  },
  {
    label: 'Feature Update',
    type: 'NEWS',
    title: "We've Made Some Updates",
    body: "We've just released updates to improve your experience. If you notice anything unusual, please refresh your browser or contact support.",
  },
  {
    label: 'Custom',
    type: 'GENERAL',
    title: '',
    body: '',
  },
];
