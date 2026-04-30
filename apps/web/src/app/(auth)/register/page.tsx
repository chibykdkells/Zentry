import Link from 'next/link';
import { UserRole } from '@zendocx/types';
import { RegistrationForm } from '@/components/auth/registration-form';
import { appendTenantContextToPath, resolveTenantSlugForRequest } from '@/lib/tenant-runtime';

export default function RegisterPage() {
  return (
    <RegistrationForm
      role={UserRole.INDIVIDUAL}
      title="Create your account"
      description="Open a personal ZenDocx account for government services, identity support, and wallet-based payments."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href={appendTenantContextToPath('/login', resolveTenantSlugForRequest())}
            className="font-semibold text-[#0D1B3E] hover:text-[#132754]"
          >
            Sign in
          </Link>
        </>
      }
    />
  );
}
