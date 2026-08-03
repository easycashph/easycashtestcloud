import { DomainError } from '@shared/errors/DomainError';

/** Same shape whether the conversation truly doesn't exist or simply belongs to someone else -
 * never lets a caller probe for other people's conversation ids. */
export class ChatConversationNotFoundError extends DomainError {
  constructor() {
    super('CHAT_CONVERSATION_NOT_FOUND', 'Conversation not found.', undefined, 404);
    this.name = 'ChatConversationNotFoundError';
  }
}

export class ChatConversationNotClaimableError extends DomainError {
  constructor() {
    super('CHAT_CONVERSATION_NOT_CLAIMABLE', 'This conversation was already claimed by someone else.', undefined, 409);
    this.name = 'ChatConversationNotClaimableError';
  }
}

export class ChatNotEligibleError extends DomainError {
  constructor() {
    super('CHAT_NOT_ELIGIBLE', 'Your role is not eligible to handle chat requests.', undefined, 403);
    this.name = 'ChatNotEligibleError';
  }
}

export class ChatConversationClosedError extends DomainError {
  constructor() {
    super('CHAT_CONVERSATION_CLOSED', 'This conversation is closed.', undefined, 400);
    this.name = 'ChatConversationClosedError';
  }
}

export class ChatNotClaimantError extends DomainError {
  constructor() {
    super('CHAT_NOT_CLAIMANT', 'Only the staff member who claimed this conversation can do that.', undefined, 403);
    this.name = 'ChatNotClaimantError';
  }
}
