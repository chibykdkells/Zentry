'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  FileCheck2,
  ShieldCheck,
  UserRound,
  UserRoundCog,
} from 'lucide-react';
import { useTenantStore } from '@/stores/tenant.store';
import { appendTenantContextToPath } from '@/lib/tenant-runtime';

interface AuthShellProps {
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'platform';
}

export function AuthShell({
  title,
  description,
  footer,
  children,
  variant = 'default',
}: AuthShellProps) {
  const tenant = useTenantStore((state) => state.tenant);
  // Defer tenant reads until after hydration so server HTML (tenant = null)
  // and initial client render always match — prevents React hydration errors.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const resolvedTenant = mounted ? tenant : null;
  const brandName = resolvedTenant?.name ?? 'ZenDocx';
  const brandInitial = brandName.charAt(0).toUpperCase();
  const isPlatformVariant = variant === 'platform';
  const tenantSlug = resolvedTenant?.slug ?? null;
  const authHomeHref = isPlatformVariant
    ? '/platform'
    : tenantSlug
      ? appendTenantContextToPath('/login', tenantSlug)
      : '/access-required';

  const accessHighlights = [
    'Role-aware routing',
    'Email verification',
    'Cookie-backed sessions',
  ];

  const entryCards = isPlatformVariant
    ? [
        {
          title: 'Platform owner access',
          description:
            'Use the shared control layer to create tenants, provision tenant admins, and manage platform-wide operations.',
          href: '/platform/login',
          icon: UserRoundCog,
        },
        {
          title: 'Tenant user access',
          description:
            'End users, CBT centers, and tenant teams should only sign in through the exact portal URL shared by their organization.',
          icon: Building2,
        },
      ]
    : [
        {
          title: 'Tenant user access',
          description:
            'Create or use an account that belongs to this business portal for services, orders, and wallet activity.',
          href: '/register',
          icon: UserRound,
        },
        {
          title: 'CBT center access',
          description:
            'Create a CBT account for this business portal and complete the center approval flow.',
          href: '/register/cbt',
          icon: FileCheck2,
        },
      ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f7f9fd_45%,#ffffff_100%)] px-4 py-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="hidden overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(155deg,#0d1b3e_0%,#132754_52%,#10203c_100%)] p-10 text-white shadow-[0_28px_80px_rgba(13,27,62,0.24)] lg:block">
            <Link href={authHomeHref} className="inline-flex items-center gap-3">
              {resolvedTenant?.logoUrl ? (
                <img
                  src={resolvedTenant.logoUrl}
                  alt={brandName}
                  className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/15"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                  <span className="text-xl font-black text-brand-accent">
                    {brandInitial}
                  </span>
                </div>
              )}
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                  {isPlatformVariant ? 'Platform access' : 'Tenant portal'}
                </span>
                <span className="mt-1 block text-2xl font-black tracking-[-0.03em] text-white">
                  {brandName}
                </span>
              </div>
            </Link>

            <div className="mt-16 space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300">
                {isPlatformVariant ? 'Platform Access' : 'Account Access'}
              </p>
              <h2 className="max-w-xl text-[3.4rem] font-black leading-[0.98] tracking-[-0.05em]">
                {isPlatformVariant
                  ? `Secure access for the ${brandName} control layer.`
                  : `Clear, secure access for every part of the ${brandName} platform.`}
              </h2>
              <p className="max-w-lg text-base leading-8 text-slate-300">
                {isPlatformVariant
                  ? 'Platform owners use this shared sign-in point to reach the admin dashboard. Tenant users should stay on their organization portal.'
                  : 'Sign in to continue inside this business portal, or choose the account path that matches how you use this tenant workspace.'}
              </p>
            </div>

            <div className="mt-10 grid gap-3">
              {entryCards.map((item) => {
                const Icon = item.icon;
                const cardBody = (
                  <>
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                      <Icon size={18} className="text-brand-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {item.description}
                      </p>
                    </div>
                    {item.href ? (
                      <ArrowRight
                        size={16}
                        className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white"
                      />
                    ) : null}
                  </>
                );

                if (!item.href) {
                  return (
                    <div
                      key={item.title}
                      className="flex items-start gap-3 rounded-[1.6rem] border border-white/10 bg-white/6 px-4 py-4"
                    >
                      {cardBody}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={appendTenantContextToPath(item.href, tenantSlug)}
                    className="group flex items-start gap-3 rounded-[1.6rem] border border-white/10 bg-white/6 px-4 py-4 transition hover:border-white/20 hover:bg-white/10"
                  >
                    {cardBody}
                  </Link>
                );
              })}
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/6 p-5">
              <div className="flex flex-wrap gap-2">
                {accessHighlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 text-sm text-slate-200">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-300" />
              <p className="leading-6">
                {isPlatformVariant
                  ? 'Platform-owner sessions use the same token and cookie protections while keeping tenant access isolated to each business portal.'
                  : 'Your session uses access tokens in memory and httpOnly cookie-based refresh handling for a safer sign-in flow.'}
              </p>
            </div>
          </section>

          <section className="w-full">
            <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
              <Link href={authHomeHref} className="flex items-center gap-3">
                {resolvedTenant?.logoUrl ? (
                  <img
                    src={resolvedTenant.logoUrl}
                    alt={brandName}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy shadow-lg shadow-[#0D1B3E]/20">
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
                    {isPlatformVariant ? 'Platform access' : 'Secure access'}
                  </span>
                </div>
              </Link>
              <Link
                href={authHomeHref}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-ink transition hover:bg-white"
              >
                {isPlatformVariant ? 'Platform access' : 'Back to portal'}
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="rounded-[2.25rem] border border-white/70 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:p-10">
              <div className="mb-6 flex flex-wrap gap-2">
                {accessHighlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                  >
                    {highlight}
                  </span>
                ))}
              </div>

              <h1 className="text-[2.35rem] font-black leading-[1.02] tracking-[-0.04em] text-slate-950 md:text-[2.7rem]">
                {title}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
                {description}
              </p>

              <div className="mt-9">{children}</div>

              {footer ? (
                <div className="mt-7 border-t border-slate-100 pt-5 text-left text-sm text-slate-500 md:text-center">
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
