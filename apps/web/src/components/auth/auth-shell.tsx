'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useTenantStore } from '@/stores/tenant.store';
import { appendTenantContextToPath } from '@/lib/tenant-runtime';

interface AuthShellProps {
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'platform';
}

const FEATURES = [
  { icon: '🔐', label: 'Escrow-protected payments' },
  { icon: '⚡', label: 'Real-time job updates' },
  { icon: '📲', label: 'Installable on any device' },
];

export function AuthShell({
  title,
  description,
  footer,
  children,
  variant = 'default',
}: AuthShellProps) {
  const tenant = useTenantStore((state) => state.tenant);
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
      ? appendTenantContextToPath('/', tenantSlug)
      : '/access-required';

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Left panel: brand panel ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col bg-[#0D1B3E] relative overflow-hidden">
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 25%, #F5A623 0%, transparent 50%), radial-gradient(circle at 75% 75%, #ffffff 0%, transparent 50%)',
          }}
        />

        {/* Top: logo */}
        <div className="relative z-10 px-10 pt-10">
          <Link href={authHomeHref} className="inline-flex items-center gap-3 group">
            {resolvedTenant?.logoUrl ? (
              <img
                src={resolvedTenant.logoUrl}
                alt={brandName}
                className="w-10 h-10 rounded-2xl object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center ring-1 ring-white/10 group-hover:bg-white/15 transition-colors">
                <span className="text-[#F5A623] font-black text-lg">{brandInitial}</span>
              </div>
            )}
            <span className="text-white font-bold text-lg tracking-tight">{brandName}</span>
          </Link>
        </div>

        {/* Center: brand showcase */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-10 text-center">
          {/* Large logo icon */}
          <div
            className="mb-8 flex items-center justify-center"
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05) inset',
            }}
          >
            {resolvedTenant?.logoUrl ? (
              <img
                src={resolvedTenant.logoUrl}
                alt={brandName}
                className="w-14 h-14 rounded-xl object-cover"
              />
            ) : (
              <span className="text-[#F5A623] font-black" style={{ fontSize: 44 }}>
                {brandInitial}
              </span>
            )}
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/40 mb-2">
            {isPlatformVariant ? 'Platform access' : 'Welcome to'}
          </p>
          <h2 className="text-4xl font-black text-white tracking-tight leading-tight mb-3">
            {brandName}
          </h2>
          <p className="text-sm leading-7 text-white/50 max-w-xs">
            {isPlatformVariant
              ? 'Manage tenants, provision admins, and operate the platform dashboard.'
              : 'Your complete government services marketplace. Secure, fast, and always available.'}
          </p>

          {/* Features */}
          <div className="mt-10 w-full max-w-xs flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-base">{f.icon}</span>
                <span className="text-sm font-medium text-white/70">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: security badge */}
        <div className="relative z-10 px-10 pb-10">
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}
          >
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-medium text-white/50">
              {isPlatformVariant
                ? 'Platform sessions are isolated from tenant portals'
                : 'Secured with httpOnly cookies and memory-only access tokens'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-8 bg-[#f7f8fc]">
        <div className="w-full max-w-[420px]">

          {/* Mobile header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <Link href={authHomeHref}>
              {resolvedTenant?.logoUrl ? (
                <img
                  src={resolvedTenant.logoUrl}
                  alt={brandName}
                  className="w-10 h-10 rounded-2xl object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-[#0D1B3E] flex items-center justify-center">
                  <span className="text-[#F5A623] font-black text-lg">{brandInitial}</span>
                </div>
              )}
            </Link>
            <div>
              <p className="font-black text-[#0D1B3E] text-lg leading-tight">{brandName}</p>
              <p className="text-xs text-slate-400 font-medium">
                {isPlatformVariant ? 'Platform access' : 'Secure portal'}
              </p>
            </div>
          </div>

          {/* Card */}
          <div
            className="bg-white px-7 py-8 sm:px-8 sm:py-9"
            style={{
              borderRadius: 28,
              border: '1px solid rgba(15,23,42,0.07)',
              boxShadow: '0 4px 24px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
            }}
          >
            {/* Card header */}
            <div className="mb-7">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
            </div>

            {/* Form content */}
            {children}

            {/* Footer */}
            {footer ? (
              <div className="mt-6 pt-5 border-t border-slate-100 text-sm text-slate-500 space-y-2">
                {footer}
              </div>
            ) : null}
          </div>

          {/* Below-card note */}
          <p className="mt-6 text-center text-xs text-slate-400">
            {isPlatformVariant
              ? 'For tenant users — sign in through your organization portal.'
              : 'Powered by ZenDocx · Fast. Trusted. Government Services, Simplified.'}
          </p>
        </div>
      </div>
    </div>
  );
}
