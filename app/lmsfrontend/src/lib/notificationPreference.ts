import type { NotificationType } from './notificationApiTypes';

/**
 * Settings > Notifications (2026-07-17 user request) - which notification types each officer
 * wants to see in the bell dropdown/badge. Muted types are still created and stored server-side
 * (so switching this back on later still shows history) - this only affects what's displayed and
 * counted toward the unread badge on this device/account, same "personal display preference, not
 * server state" pattern as `landingPagePreference.ts`.
 */
export const NOTIFICATION_TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'APPLICATION_SUBMITTED', label: 'New loan application submitted' },
  { value: 'APPLICATION_PRE_APPROVAL_READY', label: 'Application ready for final approval' },
  { value: 'APPLICATION_DECIDED', label: 'Your encoded application was approved/declined' },
  { value: 'LOAN_OVERDUE', label: 'Loan account became overdue' },
];

const ALL_TYPES = NOTIFICATION_TYPE_OPTIONS.map((o) => o.value);
const KEY_PREFIX = 'easycash-preview-muted-notification-types';
const ANON_SCOPE = 'anon';

function storageKey(userId: string | null): string {
  return `${KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}

export function readMutedTypes(userId: string | null): NotificationType[] {
  const stored = window.localStorage.getItem(storageKey(userId));
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((t): t is NotificationType => ALL_TYPES.includes(t)) : [];
  } catch {
    return [];
  }
}

export function writeMutedTypes(userId: string | null, types: NotificationType[]): void {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(types));
}
