export type ReleasePreviewStepType =
  | 'ESCROW_RELEASE'
  | 'CBT_COMMISSION'
  | 'PLATFORM_COMMISSION';

export interface AdminOrderReleasePreviewStep {
  type: ReleasePreviewStepType;
  amount: string;
  summary: string;
}

export interface AdminOrderReleasePreviewData {
  orderId: string;
  orderNumber: string;
  releaseState:
    | 'NOT_READY'
    | 'AWAITING_WINDOW'
    | 'READY_FOR_RELEASE'
    | 'RELEASED';
  canPrepareRelease: boolean;
  blockedReasons: string[];
  timing: {
    completedAt: Date | null;
    disputeWindowExpiresAt: Date | null;
    escrowReleasedAt: Date | null;
  };
  actors: {
    requesterEmail: string;
    assignedCbtEmail: string | null;
    assignedCbtName: string | null;
  };
  amounts: {
    escrowLocked: string;
    cbtCommission: string;
    platformNet: string;
  };
  job: {
    queueName: string;
    jobName: string;
    jobId: string;
    scheduledFor: Date;
    delayMs: number;
    shouldEnqueueNow: boolean;
  };
  steps: AdminOrderReleasePreviewStep[];
}
