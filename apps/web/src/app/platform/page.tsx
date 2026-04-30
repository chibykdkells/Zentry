import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function PlatformEntryPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm mode="platform" />
    </Suspense>
  );
}
