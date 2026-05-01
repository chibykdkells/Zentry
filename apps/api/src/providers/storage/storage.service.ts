import { Inject, Injectable } from '@nestjs/common';
import {
  IStorageProvider,
  STORAGE_PROVIDER,
  UploadFileInput,
  UploadFileResult,
} from '../interfaces';

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: IStorageProvider,
  ) {}

  get providerName(): string {
    return this.provider.providerName;
  }

  uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    return this.provider.uploadFile(input);
  }

  deleteFile(publicId: string): Promise<void> {
    return this.provider.deleteFile(publicId);
  }

  getSignedUrl(publicId: string, expiresInSeconds: number): string {
    return this.provider.getSignedUrl(publicId, expiresInSeconds);
  }
}
