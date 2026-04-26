'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthBootstrap } from './auth-bootstrap';
import { TenantBootstrap } from './tenant-bootstrap';
import { SocketBootstrap } from './socket-bootstrap';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { createAppQueryClient } from '@/lib/query-client';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap />
      <TenantBootstrap />
      <SocketBootstrap />
      {children}
      <InstallPrompt />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
          },
        }}
      />
    </QueryClientProvider>
  );
}
