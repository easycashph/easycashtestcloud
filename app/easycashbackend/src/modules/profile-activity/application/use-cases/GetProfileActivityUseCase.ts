/**
 * Get Profile Activity Timeline Use Case
 *
 * Retrieves cursor-paginated activity log for a specific profile.
 * Available to all authenticated users.
 */

import type { IProfileActivityLogRepository } from '../ports/IProfileActivityLogRepository';
import type { IUserRepository } from '@modules/identity/application/ports/IUserRepository';
import type { ProfileType } from '../../domain/ProfileActivityLog';

export interface GetProfileActivityInput {
  profileType: ProfileType;
  profileId: string;
  limit?: number;
  cursor?: string;
  action?: string;
}

export interface ProfileActivityDTO {
  id: string;
  profileType: ProfileType;
  profileId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
  deletedByMisAt: Date | null;
}

export interface GetProfileActivityOutput {
  activities: ProfileActivityDTO[];
  cursor?: string;
}

export class GetProfileActivityUseCase {
  constructor(
    private readonly repository: IProfileActivityLogRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: GetProfileActivityInput): Promise<GetProfileActivityOutput> {
    const { activities, cursor } = await this.repository.findMany({
      profileType: input.profileType,
      profileId: input.profileId,
      limit: input.limit ?? 50,
      cursor: input.cursor,
      action: input.action,
    });

    const uniqueUserIds = [...new Set(activities.map((activity) => activity.userId))];
    const users = await Promise.all(uniqueUserIds.map((id) => this.userRepository.findById(id)));
    const usersById = new Map(uniqueUserIds.map((id, index) => [id, users[index]]));

    return {
      activities: activities.map((activity) => {
        const user = usersById.get(activity.userId);
        return {
          id: activity.id,
          profileType: activity.profileType,
          profileId: activity.profileId,
          user: user
            ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email }
            : { id: activity.userId, firstName: 'Unknown', lastName: 'User', email: '' },
          action: activity.action,
          details: activity.details,
          createdAt: activity.createdAt,
          deletedByMisAt: activity.deletedByMisAt,
        };
      }),
      cursor,
    };
  }
}
