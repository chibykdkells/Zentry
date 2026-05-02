import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IEmailProvider, SendEmailInput, SendEmailResult } from '../interfaces';

@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  readonly providerName = 'RESEND';
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly client: Resend | null;
  private readonly defaultFromEmail: string;
  private readonly defaultFromName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY', '');
    this.defaultFromEmail = config.get<string>(
      'RESEND_FROM_EMAIL',
      'noreply@zendocx.net',
    );
    this.defaultFromName = config.get<string>('RESEND_FROM_NAME', 'ZenDocx');

    if (apiKey) {
      this.client = new Resend(apiKey);
    } else {
      this.client = null;
      this.logger.warn('RESEND_API_KEY not set — emails will be logged only');
    }
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const fromEmail = input.fromEmail ?? this.defaultFromEmail;
    const fromName = input.fromName ?? this.defaultFromName;
    const from = `${fromName} <${fromEmail}>`;

    if (!this.client) {
      this.logger.log(
        `[DEV EMAIL] to=${input.to} subject="${input.subject}"`,
      );
      return { messageId: `dev-${Date.now()}`, accepted: true };
    }

    try {
      const { data, error } = await this.client.emails.send({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      });

      if (error) {
        this.logger.error(`Resend error for ${input.to}: ${error.message}`);
        return { messageId: '', accepted: false };
      }

      return { messageId: data?.id ?? '', accepted: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend send failed for ${input.to}: ${msg}`);
      return { messageId: '', accepted: false };
    }
  }
}
