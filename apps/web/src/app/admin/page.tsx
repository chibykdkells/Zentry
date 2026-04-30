import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function AdminEntryPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm mode="platform" />
    </Suspense>
  );
}
