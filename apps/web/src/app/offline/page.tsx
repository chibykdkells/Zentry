'use client';

import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0D1B3E] text-amber-400">
          <WifiOff size={28} />
        </div>

        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
          Offline
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          You are temporarily offline
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Zentry could not reach the network right now. As soon as your
          connection returns, you can continue with your account, services, and
          wallet activity.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Go to home
          </Link>
        </div>
      </div>
    </main>
  );
}
