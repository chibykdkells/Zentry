import { Inject, Injectable } from '@nestjs/common';
import {
  ISmsProvider,
  SendSmsInput,
  SendSmsResult,
  SMS_PROVIDER,
} from '../interfaces';

@Injectable()
export class SmsService {
  constructor(
    @Inject(SMS_PROVIDER)
    private readonly provider: ISmsProvider,
  ) {}

  get providerName(): string {
    return this.provider.providerName;
  }

  sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    return this.provider.sendSms(input);
  }
}
