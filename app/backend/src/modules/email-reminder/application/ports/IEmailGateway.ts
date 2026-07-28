export class EmailGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailGatewayError';
  }
}

/** Abstraction over the email provider (Google Workspace SMTP today) - Repository Pattern, per
 * CLAUDE.md §Architecture, so swapping providers later never touches the use case.
 *
 * `html`, when supplied, is sent as a multipart alternative alongside `body` (still required as
 * the plain-text fallback for clients that don't render HTML) - optional so every existing
 * plain-text-only caller (payment/portal reminders) is unaffected. */
export interface IEmailGateway {
  send(to: string, subject: string, body: string, html?: string): Promise<void>;
}
