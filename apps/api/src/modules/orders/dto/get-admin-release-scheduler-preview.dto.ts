export interface AdminReleaseSchedulerCandidate {
  orderId: string;
  orderNumber: string;
  releaseState:
    | 'NOT_READY'
    | 'AWAITING_WINDOW'
    | 'READY_FOR_RELEASE'
    | 'RELEASED';
  scheduledFor: Date;
  delayMs: number;
  shouldEnqueueNow: boolean;
  blockedReasons: string[];
  jobId: string;
  queueName: string;
  jobName: string;
  payload: {
    orderId: string;
    orderNumber: string;
    requesterId: string;
    assignedCbtId: string | null;
    escrowLocked: string;
    cbtCommission: string;
    platformNet: string;
  };
}

export interface AdminReleaseSchedulerPreviewData {
  queueName: string;
  jobName: string;
  summary: {
    readyCount: number;
    waitingCount: number;
    blockedCount: number;
  };
  readyCandidates: AdminReleaseSchedulerCandidate[];
  waitingCandidates: AdminReleaseSchedulerCandidate[];
  blockedCandidates: AdminReleaseSchedulerCandidate[];
}
