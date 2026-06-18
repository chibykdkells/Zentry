import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EMAIL_PROVIDER,
  PAYMENT_PROVIDER,
  SMS_PROVIDER,
  STORAGE_PROVIDER,
  VTU_PROVIDER,
} from './interfaces';
import { FintavapayProvider } from './payment/fintavapay.provider';
import { FlutterwaveProvider } from './payment/flutterwave.provider';
import { PaymentService } from './payment/payment.service';
import { ResendEmailProvider } from './email/resend.provider';
import { EmailService } from './email/email.service';
import { ProviderOneVtuProvider } from './vtu/provider-one.provider';
import { VtuService } from './vtu/vtu.service';
import { TermiiSmsProvider } from './sms/termii.provider';
import { SmsService } from './sms/sms.service';
import { CloudinaryStorageProvider } from './storage/cloudinary.provider';
import { DiskStorageProvider } from './storage/disk.provider';
import { StorageService } from './storage/storage.service';
import { ProviderCredentialsService } from './provider-credentials.service';

@Global()
@Module({
  providers: [
    FintavapayProvider,
    FlutterwaveProvider,
    ProviderOneVtuProvider,
    TermiiSmsProvider,
    ResendEmailProvider,
    CloudinaryStorageProvider,
    DiskStorageProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        config: ConfigService,
        fintavapay: FintavapayProvider,
        flutterwave: FlutterwaveProvider,
      ) => {
        const activeProvider = config.get<string>(
          'ACTIVE_PAYMENT_PROVIDER',
          'FINTAVAPAY',
        );

        switch (activeProvider) {
          case 'FLUTTERWAVE':
            return flutterwave;
          case 'FINTAVAPAY':
          default:
            return fintavapay;
        }
      },
      inject: [
        ConfigService,
        FintavapayProvider,
        FlutterwaveProvider,
      ],
    },
    {
      provide: VTU_PROVIDER,
      useFactory: (
        config: ConfigService,
        providerOne: ProviderOneVtuProvider,
      ) => {
        const activeProvider = config.get<string>(
          'ACTIVE_VTU_PROVIDER',
          'PROVIDER_ONE',
        );

        switch (activeProvider) {
          case 'PROVIDER_ONE':
          default:
            return providerOne;
        }
      },
      inject: [ConfigService, ProviderOneVtuProvider],
    },
    {
      provide: SMS_PROVIDER,
      useFactory: (
        config: ConfigService,
        termiiProvider: TermiiSmsProvider,
      ) => {
        const activeProvider = config.get<string>(
          'ACTIVE_SMS_PROVIDER',
          'TERMII',
        );

        switch (activeProvider) {
          case 'TERMII':
          default:
            return termiiProvider;
        }
      },
      inject: [ConfigService, TermiiSmsProvider],
    },
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        config: ConfigService,
        resendProvider: ResendEmailProvider,
      ) => {
        const activeProvider = config.get<string>(
          'ACTIVE_EMAIL_PROVIDER',
          'RESEND',
        );

        switch (activeProvider) {
          case 'RESEND':
          default:
            return resendProvider;
        }
      },
      inject: [ConfigService, ResendEmailProvider],
    },
    {
      provide: STORAGE_PROVIDER,
      useFactory: (
        config: ConfigService,
        cloudinaryProvider: CloudinaryStorageProvider,
        diskProvider: DiskStorageProvider,
      ) => {
        const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME', '');
        const apiKey = config.get<string>('CLOUDINARY_API_KEY', '');
        const apiSecret = config.get<string>('CLOUDINARY_API_SECRET', '');
        const cloudinaryReady = !!(
          cloudName &&
          cloudName !== 'demo' &&
          apiKey &&
          apiSecret
        );

        const activeProvider = config.get<string>(
          'ACTIVE_STORAGE_PROVIDER',
          'CLOUDINARY',
        );

        if (activeProvider === 'DISK') return diskProvider;
        if (activeProvider === 'CLOUDINARY' && cloudinaryReady) return cloudinaryProvider;

        // Auto-fallback: Cloudinary selected but credentials absent — use disk
        return diskProvider;
      },
      inject: [ConfigService, CloudinaryStorageProvider, DiskStorageProvider],
    },
    PaymentService,
    VtuService,
    SmsService,
    EmailService,
    StorageService,
    ProviderCredentialsService,
  ],
  exports: [
    PAYMENT_PROVIDER,
    VTU_PROVIDER,
    SMS_PROVIDER,
    EMAIL_PROVIDER,
    STORAGE_PROVIDER,
    DiskStorageProvider,
    PaymentService,
    VtuService,
    SmsService,
    EmailService,
    StorageService,
    ProviderCredentialsService,
  ],
})
export class ProvidersModule {}
