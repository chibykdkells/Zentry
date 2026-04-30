import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function PlatformLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm mode="platform" />
    </Suspense>
  );
}
