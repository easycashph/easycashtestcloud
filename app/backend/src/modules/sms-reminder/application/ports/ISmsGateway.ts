export interface SmsSendResult {
  /** M360's `transid` from a 201 response - stored as SmsReminderLog.providerTransId, later matched against the DLR webhook callback. */
  providerTransId: string;
}

export class SmsGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmsGatewayError';
  }
}

/** Abstraction over the SMS provider (M360/Globe today) - Repository Pattern, per CLAUDE.md
 * §Architecture, so swapping providers later never touches SendPaymentReminderSmsUseCase. */
export interface ISmsGateway {
  send(phoneNumber: string, message: string): Promise<SmsSendResult>;
}
