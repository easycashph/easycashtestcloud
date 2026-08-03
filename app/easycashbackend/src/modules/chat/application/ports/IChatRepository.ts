export type ChatConversationStatus = 'WAITING' | 'CLAIMED' | 'CLOSED';
export type ChatMessageSenderType = 'PORTAL_ACCOUNT' | 'STAFF' | 'SYSTEM';

export interface ChatConversationRecord {
  id: string;
  portalAccountId: string;
  status: ChatConversationStatus;
  claimedByUserId: string | null;
  claimedByUserName: string | null;
  requiresManager: boolean;
  createdAt: Date;
  claimedAt: Date | null;
  closedAt: Date | null;
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
  /** The client's own most recent still-open (WAITING or CLAIMED) conversation, if any - resumed
   * instead of starting a second thread every time they open the chat widget. */
  findActiveConversationForPortalAccount(portalAccountId: string): Promise<ChatConversationRecord | null>;
  findConversationById(id: string): Promise<ChatConversationRecord | null>;
  /** Atomic claim: only succeeds (returns true) if the conversation was still WAITING and
   * unclaimed at the moment of the write - the real "first click wins" guarantee, not a
   * check-then-write race. */
  claimConversation(id: string, userId: string): Promise<boolean>;
  transferToManager(id: string): Promise<void>;
  closeConversation(id: string): Promise<void>;
  listWaitingConversations(requiresManager: boolean): Promise<ChatConversationRecord[]>;
  listClaimedConversationsForUser(userId: string): Promise<ChatConversationRecord[]>;
  /** Attachments are looked up separately (Attachment.ownerType='CHAT_MESSAGE', ownerId=message.id)
   * by whichever use case handles the file upload - `addMessage` never receives one directly. */
  addMessage(input: CreateChatMessageInput): Promise<ChatMessageRecord>;
  /** Re-reads a single message (with its attachment, if any by then) - used right after an
   * optional file upload following `addMessage`, so the response to the sender reflects the
   * attachment without a second round-trip from the client. */
  findMessageById(id: string): Promise<ChatMessageRecord | null>;
  listMessages(conversationId: string): Promise<ChatMessageRecord[]>;
}
