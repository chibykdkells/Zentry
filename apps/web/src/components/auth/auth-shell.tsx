'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileCheck2, ShieldCheck, UserRound } from 'lucide-react';
import { useTenantStore } from '@/stores/tenant.store';

interface AuthShellProps {
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthShell({
  title,
  description,
  footer,
  children,
}: AuthShellProps) {
  const tenant = useTenantStore((state) => state.tenant);
  // Defer tenant reads until after hydration so server HTML (tenant = null)
  // and initial client render always match — prevents React hydration errors.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const resolvedTenant = mounted ? tenant : null;
  const brandName = resolvedTenant?.name ?? 'Zentry';
  const brandInitial = brandName.charAt(0).toUpperCase();

  const accessHighlights = [
    'Role-aware routing',
    'Email verification',
    'Cookie-backed sessions',
  ];

  return (
    <div className="min-h-screen bg-brand-canvas px-4 py-10 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="hidden rounded-[2rem] border border-brand-line bg-brand-navy p-8 text-white shadow-xl shadow-slate-200/60 lg:block">
            <Link href="/" className="inline-flex items-center gap-3">
              {resolvedTenant?.logoUrl ? (
                <img
                  src={resolvedTenant.logoUrl}
                  alt={brandName}
                  className="h-11 w-11 rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <span className="text-xl font-black text-brand-accent">
                    {brandInitial}
                  </span>
                </div>
              )}
              <span className="text-2xl font-black tracking-tight">{brandName}</span>
            </Link>

            <div className="mt-14 space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300">
                Account Access
              </p>
              <h2 className="text-4xl font-black leading-tight">
                Clear, secure access for every part of the {brandName} platform.
              </h2>
              <p className="max-w-md text-base leading-8 text-slate-300">
                Sign in to continue, or choose the right account path for
                personal use or CBT-center fulfillment.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {[
                {
                  title: 'Individual access',
                  description: 'Open a regular account for services, orders, and wallet activity.',
                  href: '/register',
                  icon: UserRound,
                },
                {
                  title: 'CBT center application',
                  description: 'Set up your fulfillment account and approval-ready profile.',
                  href: '/register/cbt',
                  icon: FileCheck2,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-white/20 hover:bg-white/8"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                      <Icon size={18} className="text-brand-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {item.description}
                      </p>
                    </div>
                    <ArrowRight size={16} className="mt-1 shrink-0 text-slate-400" />
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 text-sm text-slate-200">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <p className="leading-6">
                Your session uses access tokens in memory and httpOnly cookie-based
                refresh handling for a safer sign-in flow.
              </p>
            </div>
          </section>

          <section className="w-full">
            <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
              <Link href="/" className="flex items-center gap-3">
                {resolvedTenant?.logoUrl ? (
                  <img
                    src={resolvedTenant.logoUrl}
                    alt={brandName}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy">
                    <span className="text-lg font-black text-brand-accent">
                      {brandInitial}
                    </span>
                  </div>
                )}
                <div>
                  <span className="block text-2xl font-black tracking-tight text-brand-navy">
                    {brandName}
                  </span>
                  <span className="block text-xs font-medium uppercase tracking-[0.16em] text-brand-muted">
                    Secure access
                  </span>
                </div>
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-ink transition hover:bg-white"
              >
                Back home
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="rounded-[2rem] border border-brand-line bg-brand-surface p-8 shadow-xl shadow-slate-200/40">
              <div className="mb-5 flex flex-wrap gap-2">
                {accessHighlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-brand-line bg-brand-canvas px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted"
                  >
                    {highlight}
                  </span>
                ))}
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-brand-ink">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-brand-muted">
                {description}
              </p>

              <div className="mt-8">{children}</div>

              {footer ? (
                <div className="mt-6 border-t border-brand-line pt-5 text-left text-sm text-brand-muted md:text-center">
                  {footer}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
