import Link from 'next/link';
import { UserRole } from '@zentry/types';
import { RegistrationForm } from '@/components/auth/registration-form';

export default function RegisterPage() {
  return (
    <RegistrationForm
      role={UserRole.INDIVIDUAL}
      title="Create your account"
      description="Open a personal Zentry account for government services, identity support, and wallet-based payments."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#0D1B3E] hover:text-[#132754]">
            Sign in
          </Link>
        </>
      }
    />
  );
}
