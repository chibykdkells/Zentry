export const DELIVERY_DEADLINE_QUEUE_NAME = 'delivery-deadline';
export const DELIVERY_DEADLINE_JOB_NAME = 'ENFORCE_DEADLINE';
export const DELIVERY_DEADLINE_MINUTES = 10;

export function buildDeadlineJobId(orderId: string) {
  return `deadline:${orderId}`;
}
