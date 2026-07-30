/**
 * Profile Activity Log Service
 *
 * Application service for logging profile activities.
 * Used by other modules to record actions: attachments, decisions, notes, payments.
 */

import { randomUUID } from 'node:crypto';
import type { IProfileActivityLogRepository } from './ports/IProfileActivityLogRepository';
import { ProfileActivityLog, type ProfileType } from '../domain/ProfileActivityLog';

export interface LogActivityInput {
  profileType: ProfileType;
  profileId: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  visibilityRestricted?: boolean;
}

export class ProfileActivityLogService {
  constructor(private readonly repository: IProfileActivityLogRepository) {}

  /**
   * Log an activity to a profile.
   * Called by other modules after they complete an action.
   */
  async logActivity(input: LogActivityInput): Promise<ProfileActivityLog> {
    const activity = ProfileActivityLog.create(
      randomUUID(),
      input.profileType,
      input.profileId,
      input.userId,
      input.action,
      input.details,
      input.visibilityRestricted ?? false,
    );

    return this.repository.save(activity);
  }

  /**
   * Common activity types for loan applications.
   * E.g., ProfileActivityLogService.actions.attachmentCreated(attachmentId, category, fileName)
   */
  static readonly actions = {
    attachmentCreated: (attachmentId: string, documentCategory: string, fileName: string) => ({
      action: 'attachment_created',
      details: { attachmentId, documentCategory, fileName },
    }),

    attachmentDeleted: (attachmentId: string, previousCategory?: string) => ({
      action: 'attachment_deleted',
      details: { attachmentId, previousCategory },
    }),

    decisionUpdated: (
      fromStatus: string,
      toStatus: string,
      reason?: string,
      details?: Record<string, unknown>,
    ) => ({
      action: 'decision_updated',
      details: {
        fromStatus,
        toStatus,
        reason,
        ...details,
      },
    }),

    noteCreated: (noteId: string, content: string) => ({
      action: 'note_created',
      details: { noteId, content },
    }),

    noteUpdated: (noteId: string, previousContent: string, newContent: string) => ({
      action: 'note_updated',
      details: { noteId, previousContent, newContent },
    }),

    noteDeleted: (noteId: string, content: string) => ({
      action: 'note_deleted',
      details: { noteId, content },
    }),

    paymentRecorded: (
      paymentId: string,
      amount: number,
      principal: number,
      interest: number,
      fees: number,
      repaymentInstallmentId?: string,
      allocationDetails?: Record<string, unknown>,
    ) => ({
      action: 'payment_recorded',
      details: {
        paymentId,
        amount,
        principal,
        interest,
        fees,
        repaymentInstallmentId,
        allocationDetails,
      },
    }),
  };
}
