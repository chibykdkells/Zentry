import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider, SendSmsInput, SendSmsResult } from '../interfaces';

@Injectable()
export class TermiiSmsProvider implements ISmsProvider {
  readonly providerName = 'TERMII';
  private readonly logger = new Logger(TermiiSmsProvider.name);
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('TERMII_API_KEY', '');
    this.senderId = config.get<string>('TERMII_SENDER_ID', 'ZenDocx');
  }

  sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    if (!this.apiKey) {
      this.logger.warn(
        `TERMII_API_KEY not configured — returning mocked SMS result for ${input.to}`,
      );
    }

    return Promise.resolve({
      messageId: `termii-${Date.now()}`,
      status: 'QUEUED',
    });
  }

  get defaultSenderId(): string {
    return this.senderId;
  }
}
