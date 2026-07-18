export class EmailGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailGatewayError';
  }
}

/** Abstraction over the email provider (Google Workspace SMTP today) - Repository Pattern, per
 * CLAUDE.md §Architecture, so swapping providers later never touches the use case. */
export interface IEmailGateway {
  send(to: string, subject: string, body: string): Promise<void>;
}
