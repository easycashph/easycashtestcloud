import { prisma } from '@shared/database/prismaClient';
import type {
  IChatRepository,
  ChatConversationRecord,
  ChatMessageRecord,
  ChatParticipantRecord,
  CreateChatMessageInput,
} from '../application/ports/IChatRepository';

type UserNameRow = { firstName: string; lastName: string } | null;

function fullName(user: UserNameRow): string | null {
  return user ? `${user.firstName} ${user.lastName}` : null;
}

function mapParticipant(row: {
  userId: string;
  user: { firstName: string; lastName: string };
  joinedAt: Date;
  leftAt: Date | null;
  leftReason: string | null;
}): ChatParticipantRecord {
  return {
    userId: row.userId,
    userName: `${row.user.firstName} ${row.user.lastName}`,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
    leftReason: row.leftReason as ChatParticipantRecord['leftReason'],
  };
}

function mapConversation(row: {
  id: string;
  portalAccountId: string;
  portalAccount: { email: string } | null;
  status: string;
  claimedByUserId: string | null;
  claimedByUser: UserNameRow;
  originalClaimedByUserId: string | null;
  originalClaimedByUser: UserNameRow;
  pendingTransferToUserId: string | null;
  pendingTransferToUser: UserNameRow;
  pendingTransferFromUserId: string | null;
  pendingTransferFromUser: UserNameRow;
  pendingTransferPin: string | null;
  participants: Parameters<typeof mapParticipant>[0][];
  createdAt: Date;
  claimedAt: Date | null;
  closedAt: Date | null;
}): ChatConversationRecord {
  return {
    id: row.id,
    portalAccountId: row.portalAccountId,
    portalAccountEmail: row.portalAccount?.email ?? null,
    status: row.status as ChatConversationRecord['status'],
    claimedByUserId: row.claimedByUserId,
    claimedByUserName: fullName(row.claimedByUser),
    originalClaimedByUserId: row.originalClaimedByUserId,
    originalClaimedByUserName: fullName(row.originalClaimedByUser),
    pendingTransferToUserId: row.pendingTransferToUserId,
    pendingTransferToUserName: fullName(row.pendingTransferToUser),
    pendingTransferFromUserId: row.pendingTransferFromUserId,
    pendingTransferFromUserName: fullName(row.pendingTransferFromUser),
    pendingTransferPin: row.pendingTransferPin,
    participants: row.participants.map(mapParticipant),
    createdAt: row.createdAt,
    claimedAt: row.claimedAt,
    closedAt: row.closedAt,
  };
}

const CONVERSATION_INCLUDE = {
  portalAccount: { select: { email: true } },
  claimedByUser: { select: { firstName: true, lastName: true } },
  originalClaimedByUser: { select: { firstName: true, lastName: true } },
  pendingTransferToUser: { select: { firstName: true, lastName: true } },
  pendingTransferFromUser: { select: { firstName: true, lastName: true } },
  participants: {
    orderBy: { joinedAt: 'asc' as const },
    include: { user: { select: { firstName: true, lastName: true } } },
  },
} as const;

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
      where: { portalAccountId, status: { in: ['WAITING', 'CLAIMED', 'PENDING_TRANSFER'] } },
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
   * a separate read-then-write that two simultaneous claims could both pass. Opens this user's
   * participant span (2026-08-03 user request, full trackability) right after - not part of the
   * same atomic guard since it's an audit trail, not a correctness-critical field. */
  async claimConversation(id: string, userId: string): Promise<boolean> {
    const result = await prisma.chatConversation.updateMany({
      where: { id, status: 'WAITING', claimedByUserId: null },
      data: { status: 'CLAIMED', claimedByUserId: userId, originalClaimedByUserId: userId, claimedAt: new Date() },
    });
    if (result.count === 1) {
      await prisma.chatConversationParticipant.create({ data: { conversationId: id, userId } });
    }
    return result.count === 1;
  }

  async initiateTransfer(id: string, fromUserId: string, toUserId: string, pin: string): Promise<boolean> {
    const result = await prisma.chatConversation.updateMany({
      where: { id, status: 'CLAIMED', claimedByUserId: fromUserId },
      data: {
        status: 'PENDING_TRANSFER',
        pendingTransferToUserId: toUserId,
        pendingTransferFromUserId: fromUserId,
        pendingTransferPin: pin,
      },
    });
    return result.count === 1;
  }

  /** Closes the outgoing claimant's participant span and opens a new one for the incoming
   * claimant (2026-08-03 user request) - this is what makes every hop of a multi-transfer chain
   * individually trackable, not just the first and current claimant. */
  async completeTransfer(id: string, toUserId: string, pin: string): Promise<boolean> {
    const result = await prisma.chatConversation.updateMany({
      where: { id, status: 'PENDING_TRANSFER', pendingTransferToUserId: toUserId, pendingTransferPin: pin },
      data: {
        status: 'CLAIMED',
        claimedByUserId: toUserId,
        claimedAt: new Date(),
        pendingTransferToUserId: null,
        pendingTransferFromUserId: null,
        pendingTransferPin: null,
      },
    });
    if (result.count === 1) {
      await prisma.chatConversationParticipant.updateMany({
        where: { conversationId: id, leftAt: null, userId: { not: toUserId } },
        data: { leftAt: new Date(), leftReason: 'TRANSFERRED' },
      });
      await prisma.chatConversationParticipant.create({ data: { conversationId: id, userId: toUserId } });
    }
    return result.count === 1;
  }

  async cancelTransfer(id: string, fromUserId: string): Promise<boolean> {
    const result = await prisma.chatConversation.updateMany({
      where: { id, status: 'PENDING_TRANSFER', pendingTransferFromUserId: fromUserId },
      data: {
        status: 'CLAIMED',
        pendingTransferToUserId: null,
        pendingTransferFromUserId: null,
        pendingTransferPin: null,
      },
    });
    return result.count === 1;
  }

  async closeConversation(id: string): Promise<void> {
    await prisma.chatConversation.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
    await prisma.chatConversationParticipant.updateMany({
      where: { conversationId: id, leftAt: null },
      data: { leftAt: new Date(), leftReason: 'CLOSED' },
    });
  }

  async listWaitingConversations(): Promise<ChatConversationRecord[]> {
    const rows = await prisma.chatConversation.findMany({
      where: { status: 'WAITING' },
      orderBy: { createdAt: 'asc' },
      include: CONVERSATION_INCLUDE,
    });
    return rows.map(mapConversation);
  }

  async listConversationsForUserHistory(userId: string): Promise<ChatConversationRecord[]> {
    const rows = await prisma.chatConversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: CONVERSATION_INCLUDE,
    });
    return rows.map(mapConversation);
  }

  async listIncomingTransfersForUser(userId: string): Promise<ChatConversationRecord[]> {
    const rows = await prisma.chatConversation.findMany({
      where: { status: 'PENDING_TRANSFER', pendingTransferToUserId: userId },
      orderBy: { updatedAt: 'desc' },
      include: CONVERSATION_INCLUDE,
    });
    return rows.map(mapConversation);
  }

  async listConversationsEverClaimedByUser(userId: string): Promise<ChatConversationRecord[]> {
    const rows = await prisma.chatConversation.findMany({
      where: { participants: { some: { userId } } },
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
