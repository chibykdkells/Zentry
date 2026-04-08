export const RELEASE_ESCROW_QUEUE_NAME = 'release-escrow';
export const RELEASE_ESCROW_JOB_NAME = 'RELEASE_ESCROW';

export function buildReleaseEscrowJobId(orderId: string) {
  return `release-escrow:${orderId}`;
}
