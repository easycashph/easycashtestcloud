import { prisma } from '@shared/database/prismaClient';
import type {
  IChatRepository,
  ChatConversationRecord,
  ChatMessageRecord,
  CreateChatMessageInput,
} from '../application/ports/IChatRepository';

function mapConversation(row: {
  id: string;
  portalAccountId: string;
  status: string;
  claimedByUserId: string | null;
  claimedByUser: { firstName: string; lastName: string } | null;
  requiresManager: boolean;
  createdAt: Date;
  claimedAt: Date | null;
  closedAt: Date | null;
}): ChatConversationRecord {
  return {
    id: row.id,
    portalAccountId: row.portalAccountId,
    status: row.status as ChatConversationRecord['status'],
    claimedByUserId: row.claimedByUserId,
    claimedByUserName: row.claimedByUser ? `${row.claimedByUser.firstName} ${row.claimedByUser.lastName}` : null,
    requiresManager: row.requiresManager,
    createdAt: row.createdAt,
    claimedAt: row.claimedAt,
    closedAt: row.closedAt,
  };
}

const CONVERSATION_INCLUDE = { claimedByUser: { select: { firstName: true, lastName: true } } } as const;

async function mapMessage(row: {
  id: string;
  conversationId: string;
  senderType: string;
  senderUserId: string | null;
  senderUser: { firstName: string; lastName: string } | null;
  body: string | null;
  createdAt: Date;
}): Promise<ChatMessageRecord> {
  const attachment = await prisma.attachment.findFirst({
    where: { ownerType: 'CHAT_MESSAGE', ownerId: row.id },
    select: { id: true, fileName: true },
  });
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderType: row.senderType as ChatMessageRecord['senderType'],
    senderUserId: row.senderUserId,
    senderUserName: row.senderUser ? `${row.senderUser.firstName} ${row.senderUser.lastName}` : null,
    body: row.body,
    attachment: attachment ? { id: attachment.id, fileName: attachment.fileName } : null,
    createdAt: row.createdAt,
  };
}

const MESSAGE_INCLUDE = { senderUser: { select: { firstName: true, lastName: true } } } as const;

export class PrismaChatRepository implements IChatRepository {
  async createConversation(portalAccountId: string): Promise<ChatConversationRecord> {
    const row = await prisma.chatConversation.create({
      data: { portalAccountId },
      include: CONVERSATION_INCLUDE,
    });
    return mapConversation(row);
  }

  async findActiveConversationForPortalAccount(portalAccountId: string): Promise<ChatConversationRecord | null> {
    const row = await prisma.chatConversation.findFirst({
      where: { portalAccountId, status: { in: ['WAITING', 'CLAIMED'] } },
      orderBy: { createdAt: 'desc' },
      include: CONVERSATION_INCLUDE,
    });
    return row ? mapConversation(row) : null;
  }

  async findConversationById(id: string): Promise<ChatConversationRecord | null> {
    const row = await prisma.chatConversation.findUnique({ where: { id }, include: CONVERSATION_INCLUDE });
    return row ? mapConversation(row) : null;
  }

  /** The real "first click wins" guarantee: a conditional UPDATE that only affects a row still
   * WAITING/unclaimed. `updateMany`'s count tells the caller whether THIS call won the race, not
   * a separate read-then-write that two simultaneous claims could both pass. */
  async claimConversation(id: string, userId: string): Promise<boolean> {
    const result = await prisma.chatConversation.updateMany({
      where: { id, status: 'WAITING', claimedByUserId: null },
      data: { status: 'CLAIMED', claimedByUserId: userId, claimedAt: new Date() },
    });
    return result.count === 1;
  }

  async transferToManager(id: string): Promise<void> {
    await prisma.chatConversation.update({
      where: { id },
      data: { status: 'WAITING', claimedByUserId: null, claimedAt: null, requiresManager: true },
    });
  }

  async closeConversation(id: string): Promise<void> {
    await prisma.chatConversation.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
  }

  async listWaitingConversations(requiresManager: boolean): Promise<ChatConversationRecord[]> {
    // A manager's queue includes both plain and transferred-up requests - see
    // ChatEligibility.ts's doc comment on why a manager is a superset of the general claim pool.
    const where = requiresManager ? { status: 'WAITING' as const } : { status: 'WAITING' as const, requiresManager: false };
    const rows = await prisma.chatConversation.findMany({ where, orderBy: { createdAt: 'asc' }, include: CONVERSATION_INCLUDE });
    return rows.map(mapConversation);
  }

  async listClaimedConversationsForUser(userId: string): Promise<ChatConversationRecord[]> {
    const rows = await prisma.chatConversation.findMany({
      where: { claimedByUserId: userId, status: 'CLAIMED' },
      orderBy: { claimedAt: 'desc' },
      include: CONVERSATION_INCLUDE,
    });
    return rows.map(mapConversation);
  }

  async listConversationsEverClaimedByUser(userId: string): Promise<ChatConversationRecord[]> {
    // Scoped to conversations still bearing this user's claimedByUserId - a transfer clears it
    // (see transferToManager), so a conversation later handed off loses this trace here; that
    // history still lives in the conversation's own SYSTEM messages if opened another way.
    const rows = await prisma.chatConversation.findMany({
      where: { claimedByUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: CONVERSATION_INCLUDE,
    });
    return rows.map(mapConversation);
  }

  async addMessage(input: CreateChatMessageInput): Promise<ChatMessageRecord> {
    const row = await prisma.chatMessage.create({
      data: {
        conversationId: input.conversationId,
        senderType: input.senderType,
        senderUserId: input.senderUserId,
        body: input.body,
      },
      include: MESSAGE_INCLUDE,
    });
    await prisma.chatConversation.update({ where: { id: input.conversationId }, data: { updatedAt: new Date() } });
    return mapMessage(row);
  }

  async findMessageById(id: string): Promise<ChatMessageRecord | null> {
    const row = await prisma.chatMessage.findUnique({ where: { id }, include: MESSAGE_INCLUDE });
    return row ? mapMessage(row) : null;
  }

  async listMessages(conversationId: string): Promise<ChatMessageRecord[]> {
    const rows = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: MESSAGE_INCLUDE,
    });
    return Promise.all(rows.map(mapMessage));
  }
}
