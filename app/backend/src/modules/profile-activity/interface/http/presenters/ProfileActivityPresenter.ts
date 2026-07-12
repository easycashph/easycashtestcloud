/**
 * Profile Activity Presenter
 *
 * Formats domain/application data for HTTP responses.
 * Includes user details fetched from the identity module.
 */

import type { ProfileActivityLog } from '../../../domain/ProfileActivityLog';

export interface UserDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ProfileActivityHTTPResponse {
  id: string;
  profileType: string;
  profileId: string;
  user: UserDTO;
  action: string;
  details: Record<string, unknown>;
  createdAt: string; // ISO 8601
  deletedByMisAt: string | null;
  formattedAction: string; // Human-readable action label
}

export class ProfileActivityPresenter {
  /**
   * Format a domain ProfileActivityLog for HTTP response.
   * @param activity Domain object
   * @param user User details from identity module
   */
  static toHTTP(activity: ProfileActivityLog, user: UserDTO): ProfileActivityHTTPResponse {
    return {
      id: activity.id,
      profileType: activity.profileType,
      profileId: activity.profileId,
      user,
      action: activity.action,
      details: activity.details,
      createdAt: activity.createdAt.toISOString(),
      deletedByMisAt: activity.deletedByMisAt?.toISOString() ?? null,
      formattedAction: this.formatActionLabel(activity.action, activity.details),
    };
  }

  /**
   * Convert action enum to human-readable label.
   */
  static formatActionLabel(action: string, details: Record<string, unknown>): string {
    switch (action) {
      case 'attachment_created':
        return `Uploaded ${details.documentCategory ?? 'document'}`;
      case 'attachment_deleted':
        return `Deleted ${details.previousCategory ?? 'document'}`;
      case 'decision_updated': {
        const { fromStatus, toStatus } = details;
        return `Decision updated: ${fromStatus} → ${toStatus}`;
      }
      case 'note_created':
        return 'Added note';
      case 'note_updated':
        return 'Updated note';
      case 'note_deleted':
        return 'Deleted note';
      case 'payment_recorded': {
        const amount = details.amount ? `₱${details.amount}` : 'payment';
        return `Recorded ${amount}`;
      }
      case 'profile_updated':
        return 'Updated profile details';
      case 'product_assigned':
        return 'Assigned loan product';
      case 'financials_updated':
        return 'Updated financial details';
      default:
        return action;
    }
  }
}
