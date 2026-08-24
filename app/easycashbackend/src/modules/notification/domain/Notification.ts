import { randomUUID } from 'node:crypto';

export type NotificationType =
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_PRE_APPROVAL_READY'
  | 'APPLICATION_DECIDED'
  | 'LOAN_OVERDUE'
  | 'BULK_EXPORT_READY';

export interface NotificationProps {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  branchId: string;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationProps {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  branchId: string;
}

/**
 * Notification Center (2026-07-17 user request). Created as a side effect of real domain events
 * (see `NotificationService`), never fabricated data. Append-only except for `markRead()` - no
 * other field is ever edited after creation, same append-only shape as `LoanNote`/`AuditLog`.
 */
export class Notification {
  private constructor(private readonly props: NotificationProps) {}

  static create(input: CreateNotificationProps): Notification {
    return new Notification({
      id: randomUUID(),
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      branchId: input.branchId,
      read: false,
      readAt: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: NotificationProps): Notification {
    return new Notification(props);
  }

  markRead(): void {
    if (this.props.read) return;
    this.props.read = true;
    this.props.readAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }
  get recipientUserId(): string {
    return this.props.recipientUserId;
  }
  get type(): NotificationType {
    return this.props.type;
  }
  get title(): string {
    return this.props.title;
  }
  get body(): string | null {
    return this.props.body;
  }
  get entityType(): string | null {
    return this.props.entityType;
  }
  get entityId(): string | null {
    return this.props.entityId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get read(): boolean {
    return this.props.read;
  }
  get readAt(): Date | null {
    return this.props.readAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
