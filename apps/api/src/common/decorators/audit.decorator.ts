import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit_metadata';

export type AuditLookupStrategy =
  | 'current_user'
  | 'response_user'
  | 'body_email';

export interface AuditMetadata {
  action: string;
  entity: string;
  lookup?: AuditLookupStrategy;
  mergeExisting?: boolean;
  captureRequestFields?: string[];
}

export const Audit = (metadata: AuditMetadata) =>
  SetMetadata(AUDIT_METADATA_KEY, metadata);
