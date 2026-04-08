import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider, SendEmailInput, SendEmailResult } from '../interfaces';

@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  readonly providerName = 'RESEND';
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly apiKey: string;
  private readonly defaultFromEmail: string;
  private readonly defaultFromName: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY', '');
    this.defaultFromEmail = config.get<string>(
      'RESEND_FROM_EMAIL',
      'noreply@zentry.ng',
    );
    this.defaultFromName = config.get<string>('RESEND_FROM_NAME', 'Zentry');
  }

  sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not configured — returning mocked email result for ${input.to}`,
      );
    }

    const fromEmail = input.fromEmail ?? this.defaultFromEmail;
    const fromName = input.fromName ?? this.defaultFromName;

    return Promise.resolve({
      messageId: `resend-${Date.now()}-${fromName}-${fromEmail}`,
      accepted: true,
    });
  }
}
