import { randomUUID } from 'node:crypto';

/** Client-facing milestones only - not every intermediate staff review stage. Started with the 2
 * loan application decision types (user's explicit choice, 2026-07-24); the 3 LOAN_ACCOUNT_* types
 * added 2026-08-14 (user request) for the separate LoanAccount lifecycle (booking/disbursing/
 * rejecting a LoanAccount from an approved application - see ApproveLoanUseCase/
 * ActivateLoanUseCase/RejectLoanUseCase), which previously had no portal notification at all. */
export type PortalNotificationType =
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_DECLINED'
  | 'LOAN_ACCOUNT_APPROVED'
  | 'LOAN_ACCOUNT_DISBURSED'
  | 'LOAN_ACCOUNT_REJECTED';

export interface PortalNotificationProps {
  id: string;
  portalAccountId: string;
  type: PortalNotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreatePortalNotificationProps {
  portalAccountId: string;
  type: PortalNotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * Easycash Portal Notification Center (2026-07-24 user request) - mirrors the staff-facing
 * Notification entity's shape exactly (app/backend/src/modules/notification/domain/Notification.ts),
 * scoped to a PortalAccount instead of a staff User. Append-only except for `markRead()`.
 */
export class PortalNotification {
  private constructor(private readonly props: PortalNotificationProps) {}

  static create(input: CreatePortalNotificationProps): PortalNotification {
    return new PortalNotification({
      id: randomUUID(),
      portalAccountId: input.portalAccountId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      read: false,
      readAt: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: PortalNotificationProps): PortalNotification {
    return new PortalNotification(props);
  }

  markRead(): void {
    if (this.props.read) return;
    this.props.read = true;
    this.props.readAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }
  get portalAccountId(): string {
    return this.props.portalAccountId;
  }
  get type(): PortalNotificationType {
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
