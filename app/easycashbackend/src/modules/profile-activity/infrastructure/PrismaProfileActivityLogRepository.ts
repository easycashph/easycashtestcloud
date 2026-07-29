/**
 * Prisma Implementation of Profile Activity Log Repository
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@shared/database/prismaClient';
import { ProfileActivityLog } from '../domain/ProfileActivityLog';
import type {
  FindManyProfileActivityLogsOptions,
  IProfileActivityLogRepository,
} from '../application/ports/IProfileActivityLogRepository';

export class PrismaProfileActivityLogRepository implements IProfileActivityLogRepository {
  async save(activity: ProfileActivityLog): Promise<ProfileActivityLog> {
    const record = await prisma.profileActivityLog.create({
      data: {
        id: activity.id || randomUUID(),
        profileType: activity.profileType,
        profileId: activity.profileId,
        userId: activity.userId,
        action: activity.action,
        // Serialize to JSON and back to ensure Prisma's JSON type is satisfied
        details: JSON.parse(JSON.stringify(activity.details)),
        visibilityRestricted: activity.visibilityRestricted,
        createdAt: activity.createdAt,
      },
    });

    return ProfileActivityLog.fromRecord({
      id: record.id,
      profileType: record.profileType as 'LOAN_APPLICATION' | 'BORROWER' | 'LOAN_ACCOUNT',
      profileId: record.profileId,
      userId: record.userId,
      action: record.action,
      details: record.details as Record<string, unknown>,
      visibilityRestricted: record.visibilityRestricted,
      createdAt: record.createdAt,
      deletedByMisAt: record.deletedByMisAt,
    });
  }

  async findMany(
    options: FindManyProfileActivityLogsOptions,
  ): Promise<{ activities: ProfileActivityLog[]; cursor?: string }> {
    const records = await prisma.profileActivityLog.findMany({
      where: {
        profileType: options.profileType,
        profileId: options.profileId,
        action: options.action,
        deletedByMisAt: null, // Exclude soft-deleted records by default
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit + 1, // Fetch one extra to determine if there's a next page
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });

    const hasMore = records.length > options.limit;
    const activities = records.slice(0, options.limit);

    return {
      activities: activities.map((record) =>
        ProfileActivityLog.fromRecord({
          id: record.id,
          profileType: record.profileType as 'LOAN_APPLICATION' | 'BORROWER' | 'LOAN_ACCOUNT',
          profileId: record.profileId,
          userId: record.userId,
          action: record.action,
          details: record.details as Record<string, unknown>,
          visibilityRestricted: record.visibilityRestricted,
          createdAt: record.createdAt,
          deletedByMisAt: record.deletedByMisAt,
        }),
      ),
      cursor: hasMore ? activities[activities.length - 1]?.id : undefined,
    };
  }

  async findById(id: string): Promise<ProfileActivityLog | null> {
    const record = await prisma.profileActivityLog.findUnique({
      where: { id },
    });

    if (!record || record.deletedByMisAt) {
      return null;
    }

    return ProfileActivityLog.fromRecord({
      id: record.id,
      profileType: record.profileType as 'LOAN_APPLICATION' | 'BORROWER' | 'LOAN_ACCOUNT',
      profileId: record.profileId,
      userId: record.userId,
      action: record.action,
      details: record.details as Record<string, unknown>,
      visibilityRestricted: record.visibilityRestricted,
      createdAt: record.createdAt,
      deletedByMisAt: record.deletedByMisAt,
    });
  }

  async softDeleteById(id: string): Promise<ProfileActivityLog> {
    const record = await prisma.profileActivityLog.update({
      where: { id },
      data: { deletedByMisAt: new Date() },
    });

    return ProfileActivityLog.fromRecord({
      id: record.id,
      profileType: record.profileType as 'LOAN_APPLICATION' | 'BORROWER' | 'LOAN_ACCOUNT',
      profileId: record.profileId,
      userId: record.userId,
      action: record.action,
      details: record.details as Record<string, unknown>,
      visibilityRestricted: record.visibilityRestricted,
      createdAt: record.createdAt,
      deletedByMisAt: record.deletedByMisAt,
    });
  }
}
