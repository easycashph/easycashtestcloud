export type NotificationType = 'APPLICATION_SUBMITTED' | 'APPLICATION_PRE_APPROVAL_READY' | 'APPLICATION_DECIDED' | 'LOAN_OVERDUE';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ListNotificationsResponse {
  items: Notification[];
  nextCursor: string | null;
  unreadCount: number;
}
