export type MisPostType = 'AUTO_ROTATION' | 'MANUAL';

export interface MisPost {
  id: string;
  type: MisPostType;
  caption: string;
  imageUrl: string;
  imageFileName: string;
  poolOrder: number | null;
  poolActive: boolean;
  isCurrentlyLive: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  withdrawn: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Preset shown in the composer (2026-08-20 user request: "mag lagay din ng preset timer na
 * 30 mins duration... para matulungan ang MIS") - matches the backend default, kept here too so
 * the form has something to show before the first keystroke. MIS can change it. */
export const DEFAULT_MANUAL_POST_DURATION_MINUTES = 30;

export const MANUAL_POST_DURATION_PRESETS: { label: string; minutes: number }[] = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '6 hours', minutes: 360 },
  { label: '12 hours', minutes: 720 },
  { label: '24 hours', minutes: 1440 },
  { label: '3 days', minutes: 4320 },
  { label: '7 days', minutes: 10080 },
];
