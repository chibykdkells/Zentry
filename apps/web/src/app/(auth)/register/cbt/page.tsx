import Link from 'next/link';
import { UserRole } from '@zendocx/types';
import { RegistrationForm } from '@/components/auth/registration-form';
import {
  appendTenantContextToPath,
  resolveTenantSlugForRequest,
} from '@/lib/tenant-runtime';

export default function RegisterCbtPage() {
  return (
    <RegistrationForm
      role={UserRole.CBT_CENTER}
      title="Apply as a CBT center"
      description="Set up a fulfillment account for approved CBT operations and service delivery."
      footer={
        <>
          Need a regular account instead?{' '}
          <Link
            href={appendTenantContextToPath(
              '/register',
              resolveTenantSlugForRequest(),
            )}
            className="font-semibold text-[#0D1B3E] hover:text-[#132754]"
          >
            Create an individual account
          </Link>
        </>
      }
    />
  );
}
