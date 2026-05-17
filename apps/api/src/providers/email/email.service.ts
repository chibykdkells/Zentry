import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EMAIL_PROVIDER,
  IEmailProvider,
  SendEmailInput,
  SendEmailResult,
} from '../interfaces';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly provider: IEmailProvider,
  ) {}

  get providerName(): string {
    return this.provider.providerName;
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const primaryResult = await this.provider.sendEmail(input);

    if (primaryResult.accepted || !input.fromEmail) {
      return primaryResult;
    }

    const fallbackInput: SendEmailInput = {
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      fromName: input.fromName,
    };

    this.logger.warn(
      `Retrying email to ${input.to} with default sender after custom sender "${input.fromEmail}" failed: ${primaryResult.errorMessage ?? 'unknown error'}`,
    );

    const fallbackResult = await this.provider.sendEmail(fallbackInput);

    if (!fallbackResult.accepted) {
      this.logger.error(
        `Fallback email send failed for ${input.to}: ${fallbackResult.errorMessage ?? 'unknown error'}`,
      );
    }

    return fallbackResult;
  }
}
