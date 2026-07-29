import nodemailer from 'nodemailer';
import type { IEmailGateway } from '../application/ports/IEmailGateway';
import { EmailGatewayError } from '../application/ports/IEmailGateway';

/**
 * Google Workspace SMTP - authenticates as a real mailbox (`username`), sends "From" the
 * `fromAddress` "Send As" alias configured on that mailbox (collections@easycash.ph, per the user
 * 2026-07-18) - Gmail/Workspace rejects or silently rewrites a From header that isn't either the
 * authenticated mailbox itself or one of its verified Send As aliases, so `fromAddress` MUST be a
 * real alias on `username`'s account, not an arbitrary address.
 */
export class NodemailerEmailGateway implements IEmailGateway {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly config: {
      host: string;
      port: number;
      username: string;
      password: string;
      fromAddress: string;
    },
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.username, pass: config.password },
    });
  }

  async send(to: string, subject: string, body: string, html?: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.config.fromAddress, to, subject, text: body, ...(html ? { html } : {}) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      throw new EmailGatewayError(`SMTP send failed: ${message}`);
    }
  }
}
