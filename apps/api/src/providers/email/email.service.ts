import { Inject, Injectable } from '@nestjs/common';
import {
  EMAIL_PROVIDER,
  IEmailProvider,
  SendEmailInput,
  SendEmailResult,
} from '../interfaces';

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly provider: IEmailProvider,
  ) {}

  get providerName(): string {
    return this.provider.providerName;
  }

  sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    return this.provider.sendEmail(input);
  }
}
