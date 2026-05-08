/* eslint-disable @next/next/no-img-element */

'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, ChevronRight, ShieldCheck, Zap } from 'lucide-react';
import { formatNaira } from '@/lib/format';
import { useTenantStore } from '@/stores/tenant.store';
import { appendTenantContextToPath } from '@/lib/tenant-runtime';
import { useServiceCatalog } from '@/hooks/use-service-catalog';

interface TenantPortalHomeProps {
  tenantSlug: string;
}

const PASTEL_PALETTES = [
  { bg: 'bg-blue-50', border: 'border-blue-100', dot: 'bg-blue-400', text: 'text-blue-700' },
  { bg: 'bg-violet-50', border: 'border-violet-100', dot: 'bg-violet-400', text: 'text-violet-700' },
  { bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-400', text: 'text-emerald-700' },
  { bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-400', text: 'text-amber-700' },
  { bg: 'bg-rose-50', border: 'border-rose-100', dot: 'bg-rose-400', text: 'text-rose-700' },
  { bg: 'bg-cyan-50', border: 'border-cyan-100', dot: 'bg-cyan-400', text: 'text-cyan-700' },
  { bg: 'bg-orange-50', border: 'border-orange-100', dot: 'bg-orange-400', text: 'text-orange-700' },
  { bg: 'bg-pink-50', border: 'border-pink-100', dot: 'bg-pink-400', text: 'text-pink-700' },
];

export function TenantPortalHome({ tenantSlug }: TenantPortalHomeProps) {
  const tenant = useTenantStore((state) => state.tenant);
  const { services, loading } = useServiceCatalog({ tenantSlug });

  const brandName = tenant?.name ?? 'This business';
  const heading =
    tenant?.homepageHeading ?? `Access ${brandName} from one business portal`;
  const subheading =
    tenant?.homepageSubheading ??
    'Review services, understand the process, and continue when you are ready.';
  const steps = tenant?.homepageManualSteps?.length
    ? tenant.homepageManualSteps
    : [
        {
          title: 'Choose a service',
          description: 'Review the available services and pick the request you need.',
        },
        {
          title: 'Sign in or register',
          description: 'Create an account so the request stays tied to your portal profile.',
        },
        {
          title: 'Track your progress',
          description: 'Follow updates until manual processing is complete.',
        },
      ];

  const visibleServices = services.slice(0, 8);
  const loginHref = appendTenantContextToPath('/login', tenantSlug);
  const registerHref = appendTenantContextToPath('/register', tenantSlug);

  const brandInitial = brandName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f7f8fc]">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="bg-[#0D1B3E] px-5 pt-8 pb-16 sm:px-8 sm:pt-12">
        <div className="mx-auto max-w-5xl">

          {/* Brand bar */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {tenant?.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={brandName}
                  className="h-10 w-10 rounded-2xl object-cover ring-1 ring-white/20"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                  <span className="text-lg font-black text-[#F5A623]">{brandInitial}</span>
                </div>
              )}
              <span className="font-bold text-white">{brandName}</span>
            </div>
            <Link
              href={loginHref}
              className="rounded-xl border border-white/20 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/14"
            >
              Sign in
            </Link>
          </div>

          {/* Heading */}
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/60">
              <ShieldCheck size={12} className="text-[#F5A623]" />
              Secured portal
            </div>
            <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              {heading}
            </h1>
            <p className="mt-4 text-base leading-7 text-white/60 sm:text-lg">
              {subheading}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={registerHref}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#F5A623] px-5 py-3 text-sm font-bold text-[#0D1B3E] transition hover:bg-[#e8961a]"
              >
                Get started
                <ArrowRight size={15} />
              </Link>
              <Link
                href={loginHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
              >
                Sign in to my account
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content cards pulled up over the hero ─────────────── */}
      <div className="mx-auto -mt-8 max-w-5xl space-y-5 px-5 pb-10 sm:px-8">

        {/* How it works */}
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0D1B3E]/6">
              <Zap size={16} className="text-[#0D1B3E]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Process</p>
              <h2 className="text-base font-bold text-slate-900">How it works</h2>
            </div>
          </div>
          <div className="grid gap-0 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={`${step.title}-${i}`} className="px-6 py-5">
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#F5A623] text-xs font-black text-[#0D1B3E]">
                  {i + 1}
                </div>
                <p className="font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Services grid */}
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Catalogue</p>
              <h2 className="text-base font-bold text-slate-900">Available services</h2>
            </div>
            <Link
              href={registerHref}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Get started
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : visibleServices.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleServices.map((service, i) => {
                  const palette = PASTEL_PALETTES[i % PASTEL_PALETTES.length]!;
                  return (
                    <div
                      key={service.id}
                      className={`rounded-2xl border p-4 transition hover:shadow-sm ${palette.bg} ${palette.border}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${palette.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
                            {service.category.name}
                          </div>
                          <p className="font-semibold text-slate-900 truncate">{service.name}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">
                          {formatNaira(service.totalPrice)}
                        </span>
                      </div>
                      {service.description ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500 line-clamp-2">
                          {service.description}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-slate-400">
                No services are published yet. Check back soon.
              </div>
            )}
          </div>
        </section>

        {/* Trust footer */}
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, label: 'Escrow protection', note: 'Funds are held securely until the job is done.' },
              { icon: CheckCircle2, label: 'Verified operators', note: 'Only approved CBT centers can fulfill your requests.' },
              { icon: Zap, label: 'Real-time updates', note: 'Track every step of your request from submission to completion.' },
            ].map(({ icon: Icon, label, note }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0D1B3E]/6 text-[#0D1B3E]">
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-slate-400">
          Powered by ZenDocx · Fast. Trusted. Government Services, Simplified.
        </p>
      </div>
    </div>
  );
}
