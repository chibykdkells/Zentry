'use client';

import { AdminWithdrawalReview } from '@/components/admin/admin-withdrawal-review';
import { PageHeader } from '@/components/shared/page-header';

export default function TenantWithdrawalsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Withdrawal requests"
        description="Review, approve, and process withdrawal requests from CBT centers and other users on your platform."
      />
      <AdminWithdrawalReview />
    </div>
  );
}
