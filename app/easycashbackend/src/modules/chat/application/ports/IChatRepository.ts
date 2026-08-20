export type ChatConversationStatus = 'WAITING' | 'CLAIMED' | 'PENDING_TRANSFER' | 'CLOSED';
export type ChatMessageSenderType = 'PORTAL_ACCOUNT' | 'STAFF' | 'SYSTEM';

/** 2026-08-03 (user request: "gusto ko maging trackable talaga ang chat logs") - one span per
 * staff member who has ever handled this conversation, in order. `leftAt`/`leftReason` are null
 * for the current claimant's still-open span. */
export interface ChatParticipantRecord {
  userId: string;
  userName: string;
  joinedAt: Date;
  leftAt: Date | null;
  leftReason: 'TRANSFERRED' | 'CLOSED' | null;
}

export interface ChatConversationRecord {
  id: string;
  portalAccountId: string;
  /** 2026-08-03 (user request) - lets "My Chats" group conversations by client instead of a flat
   * list, so backtracking through chat history for a specific person isn't confusing. */
  portalAccountEmail: string | null;
  status: ChatConversationStatus;
  claimedByUserId: string | null;
  claimedByUserName: string | null;
  originalClaimedByUserId: string | null;
  originalClaimedByUserName: string | null;
  pendingTransferToUserId: string | null;
  pendingTransferToUserName: string | null;
  pendingTransferFromUserId: string | null;
  pendingTransferFromUserName: string | null;
  /** Deliberately plaintext - see the Prisma model's own doc comment for why. Only ever included
   * in a response to the two people who are supposed to see it (the initiating officer, and the
   * intended recipient) - use cases are responsible for that filtering, not this record shape. */
  pendingTransferPin: string | null;
  /** Full hand-off chain, oldest first - the real fix for "only first+current claimant are
   * trackable" once a conversation has been transferred more than once. */
  participants: ChatParticipantRecord[];
  createdAt: Date;
  claimedAt: Date | null;
  closedAt: Date | null;
  /** BPO-style UX (2026-08-20) - see the Prisma model's own doc comment for why these are
   * watermarks/heartbeats rather than per-message rows or a boolean. */
  portalLastReadAt: Date | null;
  staffLastReadAt: Date | null;
  portalTypingAt: Date | null;
  staffTypingAt: Date | null;
  rating: number | null;
  ratingComment: string | null;
  ratedAt: Date | null;
}

export type ChatAgentStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';

export interface ChatAgentPresenceRecord {
  userId: string;
  userName: string;
  status: ChatAgentStatus;
  updatedAt: Date;
}

export interface ChatCannedResponseRecord {
  id: string;
  title: string;
  body: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageAttachmentRecord {
  id: string;
  fileName: string;
}

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  senderType: ChatMessageSenderType;
  senderUserId: string | null;
  senderUserName: string | null;
  body: string | null;
  attachment: ChatMessageAttachmentRecord | null;
  createdAt: Date;
}

export interface CreateChatMessageInput {
  conversationId: string;
  senderType: ChatMessageSenderType;
  senderUserId?: string;
  body?: string;
}

export interface IChatRepository {
  createConversation(portalAccountId: string): Promise<ChatConversationRecord>;
  /** The client's own most recent still-open (WAITING/CLAIMED/PENDING_TRANSFER) conversation, if
   * any - resumed instead of starting a second thread every time they open the chat widget. */
  findActiveConversationForPortalAccount(portalAccountId: string): Promise<ChatConversationRecord | null>;
  findConversationById(id: string): Promise<ChatConversationRecord | null>;
  /** Atomic claim: only succeeds (returns true) if the conversation was still WAITING and
   * unclaimed at the moment of the write - the real "first click wins" guarantee, not a
   * check-then-write race. Also stamps `originalClaimedByUserId` (first claim only). */
  claimConversation(id: string, userId: string): Promise<boolean>;
  /** Atomic: only succeeds if the conversation is still CLAIMED by `fromUserId` at the moment of
   * the write. Sets status to PENDING_TRANSFER and records the target + PIN. */
  initiateTransfer(id: string, fromUserId: string, toUserId: string, pin: string): Promise<boolean>;
  /** Atomic: only succeeds if the conversation is PENDING_TRANSFER, addressed to `toUserId`, and
   * `pin` matches exactly - the actual "confirm the handoff" gate. On success, `toUserId` becomes
   * the new claimedByUserId and the pending fields are cleared. */
  completeTransfer(id: string, toUserId: string, pin: string): Promise<boolean>;
  /** Lets the initiating officer back out before the other side confirms (e.g. wrong person
   * picked) - clears the pending fields and returns to CLAIMED under `fromUserId`. */
  cancelTransfer(id: string, fromUserId: string): Promise<boolean>;
  closeConversation(id: string): Promise<void>;
  listWaitingConversations(): Promise<ChatConversationRecord[]>;
  /** "My Chats" - every conversation this user has EVER been a participant on (see
   * ChatConversationParticipant), current claim (actionable) or a past hand-off (read-only
   * history) - covers every hop of a multi-transfer chain, not just first+current claimant. */
  listConversationsForUserHistory(userId: string): Promise<ChatConversationRecord[]>;
  /** Conversations pending a transfer TO this user, awaiting their PIN confirmation. */
  listIncomingTransfersForUser(userId: string): Promise<ChatConversationRecord[]>;
  /** MIS oversight (2026-07-31 user request) - every conversation this user has ever been a
   * participant on, any status (including CLOSED). Same underlying query as
   * listConversationsForUserHistory - kept as a separate method since callers differ (self vs.
   * MIS-about-someone-else) even though the data access is identical. */
  listConversationsEverClaimedByUser(userId: string): Promise<ChatConversationRecord[]>;
  /** Attachments are looked up separately (Attachment.ownerType='CHAT_MESSAGE', ownerId=message.id)
   * by whichever use case handles the file upload - `addMessage` never receives one directly. */
  addMessage(input: CreateChatMessageInput): Promise<ChatMessageRecord>;
  /** Re-reads a single message (with its attachment, if any by then) - used right after an
   * optional file upload following `addMessage`, so the response to the sender reflects the
   * attachment without a second round-trip from the client. */
  findMessageById(id: string): Promise<ChatMessageRecord | null>;
  listMessages(conversationId: string): Promise<ChatMessageRecord[]>;

  /** BPO-style UX (2026-08-20 user request) - read receipts, typing indicator, queue position,
   * CSAT rating, agent presence, canned responses. */
  markReadByPortal(conversationId: string): Promise<void>;
  markReadByStaff(conversationId: string): Promise<void>;
  setPortalTyping(conversationId: string): Promise<void>;
  setStaffTyping(conversationId: string): Promise<void>;
  /** Count of still-WAITING conversations created strictly before this one - the portal widget's
   * "N ahead of you" queue position. 0 once this conversation is no longer WAITING itself. */
  countWaitingAheadOf(conversationId: string): Promise<number>;
  submitRating(conversationId: string, rating: number, comment: string | null): Promise<void>;

  upsertAgentPresence(userId: string, status: ChatAgentStatus): Promise<void>;
  /** Presence for every user who currently has ANY presence row - callers filter to who they
   * actually need (e.g. a conversation's claimant) themselves. */
  listAgentPresence(): Promise<ChatAgentPresenceRecord[]>;
  /** Single-user lookup - null if that user has never set a presence status (treated as OFFLINE
   * by callers). Used to show "your officer is online" on the Portal widget without exposing the
   * full staff presence list to a client. */
  getAgentPresence(userId: string): Promise<ChatAgentStatus | null>;

  listCannedResponses(): Promise<ChatCannedResponseRecord[]>;
  createCannedResponse(title: string, body: string, createdByUserId: string): Promise<ChatCannedResponseRecord>;
  updateCannedResponse(id: string, title: string, body: string): Promise<ChatCannedResponseRecord>;
  deleteCannedResponse(id: string): Promise<void>;
}
